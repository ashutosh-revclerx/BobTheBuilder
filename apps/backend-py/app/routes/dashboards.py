import asyncio
import json
import re
from typing import Any

import asyncpg
import httpx
from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel, field_validator

from app.config import settings
from app.db.client import get_pool
from app.middleware.auth import require_auth

router = APIRouter()

PG_UNIQUE_VIOLATION = "23505"
PG_INVALID_UUID = "22P02"
PG_FOREIGN_KEY = "23503"

UUID_RE = re.compile(r"^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$", re.IGNORECASE)


def _to_slug(name: str) -> str:
    s = name.lower().strip()
    s = re.sub(r"[^a-z0-9\s-]", "", s)
    s = re.sub(r"\s+", "-", s)
    s = re.sub(r"-+", "-", s)
    return s.strip("-")


def _pg_code(exc: Exception) -> str | None:
    return getattr(exc, "pgcode", None) or getattr(exc, "sqlstate", None)


class DashboardConfig(BaseModel):
    components: list[Any]
    queries: list[Any]
    model_config = {"extra": "allow"}


class CreateDashboard(BaseModel):
    name: str
    slug: str | None = None
    config: DashboardConfig
    status: str = "draft"

    @field_validator("status")
    @classmethod
    def validate_status(cls, v: str) -> str:
        if v not in ("draft", "live"):
            raise ValueError("status must be 'draft' or 'live'")
        return v


class UpdateDashboard(BaseModel):
    name: str | None = None
    slug: str | None = None
    config: DashboardConfig | None = None
    status: str | None = None

    @field_validator("status")
    @classmethod
    def validate_status(cls, v: str | None) -> str | None:
        if v is not None and v not in ("draft", "live"):
            raise ValueError("status must be 'draft' or 'live'")
        return v


class GenerateRequest(BaseModel):
    prompt: str
    resourceIds: list[str] = []
    docsUrls: list[str] = []
    variantCount: int = 4

    @field_validator("prompt")
    @classmethod
    def prompt_min(cls, v: str) -> str:
        if len(v) < 3:
            raise ValueError("prompt must be at least 3 characters")
        return v

    @field_validator("variantCount")
    @classmethod
    def variant_range(cls, v: int) -> int:
        if not (1 <= v <= 8):
            raise ValueError("variantCount must be between 1 and 8")
        return v


@router.post("", status_code=201, dependencies=[Depends(require_auth)])
async def create_dashboard(body: CreateDashboard, pool: asyncpg.Pool = Depends(get_pool)):
    slug = body.slug or _to_slug(body.name)
    base_slug = slug

    for attempt in range(10):
        try:
            row = await pool.fetchrow(
                """INSERT INTO dashboards (name, slug, config, status)
                   VALUES ($1, $2, $3::jsonb, $4)
                   RETURNING id, name, slug, config, status, created_at, updated_at""",
                body.name,
                slug,
                body.config.model_dump(),
                body.status,
            )
            return dict(row)
        except asyncpg.UniqueViolationError:
            attempt_n = attempt + 1
            slug = f"{base_slug}-{attempt_n}"
        except Exception as exc:
            raise HTTPException(status_code=500, detail="Internal server error") from exc

    raise HTTPException(status_code=409, detail="Could not generate a unique slug after 10 attempts")


@router.get("", dependencies=[Depends(require_auth)])
async def list_dashboards(pool: asyncpg.Pool = Depends(get_pool)):
    rows = await pool.fetch(
        """SELECT
             d.id, d.name, d.slug, d.status, d.created_at, d.updated_at,
             COALESCE(
               (
                 SELECT jsonb_agg(jsonb_build_object('id', sub.id, 'name', sub.name, 'slug', sub.slug))
                 FROM (
                   SELECT c.id, c.name, c.slug
                   FROM customers c
                   JOIN dashboard_assignments da ON da.customer_id = c.id AND da.dashboard_id = d.id
                   UNION
                   SELECT c.id, c.name, c.slug
                   FROM customers c
                   WHERE c.dashboard_id = d.id
                 ) sub
               ),
               '[]'::jsonb
             ) AS assigned_customers
           FROM dashboards d
           ORDER BY d.updated_at DESC, d.created_at DESC"""
    )
    return [dict(r) for r in rows]


@router.post("/generate", dependencies=[Depends(require_auth)])
async def generate_dashboard(body: GenerateRequest, pool: asyncpg.Pool = Depends(get_pool)):
    resources_payload: list[dict] = []

    if body.resourceIds:
        rows = await pool.fetch(
            """SELECT
                 r.id, r.name, r.type, r.base_url,
                 COALESCE(
                   jsonb_agg(
                     jsonb_build_object('method', e.method, 'path', e.path, 'summary', e.summary)
                     ORDER BY e.path, e.method
                   ) FILTER (WHERE e.id IS NOT NULL),
                   '[]'::jsonb
                 ) AS endpoints
               FROM resources r
               LEFT JOIN resource_endpoints e ON e.resource_id = r.id
               WHERE r.id = ANY($1::uuid[])
               GROUP BY r.id""",
            body.resourceIds,
        )
        resources_payload = [
            {
                "id": str(r["id"]),
                "name": r["name"],
                "type": r["type"],
                "base_url": r["base_url"],
                "endpoints": r["endpoints"] or [],
            }
            for r in rows
        ]

    timeout_s = settings.llm_timeout_ms / 1000
    llm_url = settings.llm_service_url.rstrip("/")

    try:
        async with httpx.AsyncClient(timeout=timeout_s) as client:
            resp = await client.post(
                f"{llm_url}/generate",
                json={
                    "prompt": body.prompt,
                    "resources": resources_payload,
                    "docsUrls": body.docsUrls,
                    "variantCount": body.variantCount,
                },
            )
        if not resp.is_success:
            try:
                detail = resp.json().get("detail") or resp.text
            except Exception:
                detail = resp.text
            raise HTTPException(status_code=502, detail=str(detail))
        return resp.json()
    except httpx.TimeoutException:
        secs = int(timeout_s)
        raise HTTPException(status_code=504, detail=f"LLM service took longer than {secs} seconds")
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=502, detail="Could not reach the LLM service") from exc


@router.get("/{dashboard_id}", dependencies=[Depends(require_auth)])
async def get_dashboard(dashboard_id: str, pool: asyncpg.Pool = Depends(get_pool)):
    try:
        row = await pool.fetchrow(
            "SELECT id, name, slug, config, status, created_at, updated_at FROM dashboards WHERE id = $1::uuid",
            dashboard_id,
        )
    except asyncpg.InvalidTextRepresentationError:
        raise HTTPException(status_code=400, detail="Invalid dashboard ID")
    except Exception as exc:
        raise HTTPException(status_code=500, detail="Internal server error") from exc

    if not row:
        raise HTTPException(status_code=404, detail="Dashboard not found")
    return dict(row)


@router.put("/{dashboard_id}", dependencies=[Depends(require_auth)])
async def update_dashboard(dashboard_id: str, body: UpdateDashboard, pool: asyncpg.Pool = Depends(get_pool)):
    data = body.model_dump(exclude_none=True)
    if not data:
        raise HTTPException(status_code=400, detail="No fields provided to update")

    base_slug: str | None = body.slug or (_to_slug(body.name) if body.name else None)
    current_slug = base_slug

    for attempt in range(10):
        set_clauses: list[str] = []
        values: list[Any] = []
        i = 1

        if body.name is not None:
            set_clauses.append(f"name = ${i}")
            values.append(body.name)
            i += 1
        if current_slug is not None:
            set_clauses.append(f"slug = ${i}")
            values.append(current_slug)
            i += 1
        if body.config is not None:
            set_clauses.append(f"config = ${i}::jsonb")
            values.append(body.config.model_dump())
            i += 1
        if body.status is not None:
            set_clauses.append(f"status = ${i}")
            values.append(body.status)
            i += 1

        set_clauses.append("updated_at = NOW()")
        values.append(dashboard_id)

        try:
            row = await pool.fetchrow(
                f"""UPDATE dashboards SET {', '.join(set_clauses)}
                    WHERE id = ${i}::uuid
                    RETURNING id, name, slug, config, status, created_at, updated_at""",
                *values,
            )
        except asyncpg.UniqueViolationError:
            if base_slug:
                current_slug = f"{base_slug}-{attempt + 1}"
                continue
            raise HTTPException(status_code=409, detail="Slug is already taken")
        except asyncpg.InvalidTextRepresentationError:
            raise HTTPException(status_code=400, detail="Invalid dashboard ID")
        except Exception as exc:
            raise HTTPException(status_code=500, detail="Internal server error") from exc

        if not row:
            raise HTTPException(status_code=404, detail="Dashboard not found")
        return dict(row)

    raise HTTPException(status_code=409, detail="Could not generate a unique slug after 10 attempts")


@router.patch("/{dashboard_id}/publish", dependencies=[Depends(require_auth)])
async def publish_dashboard(dashboard_id: str, request: Request, pool: asyncpg.Pool = Depends(get_pool)):
    try:
        body = await request.json()
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid JSON")

    status = body.get("status")
    if status not in ("draft", "live"):
        raise HTTPException(status_code=400, detail="Invalid status")

    published_at_expr = "NOW()" if status == "live" else "NULL"

    try:
        row = await pool.fetchrow(
            f"""UPDATE dashboards
                SET status = $1, published_at = {published_at_expr}, updated_at = NOW()
                WHERE id = $2::uuid
                RETURNING id, name, slug, config, status, published_at, created_at, updated_at""",
            status,
            dashboard_id,
        )
    except asyncpg.InvalidTextRepresentationError:
        raise HTTPException(status_code=400, detail="Invalid dashboard ID")
    except Exception as exc:
        raise HTTPException(status_code=500, detail="Internal server error") from exc

    if not row:
        raise HTTPException(status_code=404, detail="Dashboard not found")
    return dict(row)


@router.post("/{dashboard_id}/assign", dependencies=[Depends(require_auth)])
async def assign_customers(dashboard_id: str, request: Request, pool: asyncpg.Pool = Depends(get_pool)):
    try:
        body = await request.json()
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid JSON")

    customer_ids: list[str] = body.get("customer_ids", [])
    if not isinstance(customer_ids, list):
        raise HTTPException(status_code=400, detail="customer_ids must be an array")

    try:
        async with pool.acquire() as conn:
            async with conn.transaction():
                # Validate dashboard exists
                dash_exists = await conn.fetchval("SELECT 1 FROM dashboards WHERE id = $1::uuid", dashboard_id)
                if not dash_exists:
                    raise HTTPException(status_code=404, detail="Dashboard not found")

                await conn.execute("DELETE FROM dashboard_assignments WHERE dashboard_id = $1::uuid", dashboard_id)
                for cid in customer_ids:
                    await conn.execute(
                        "INSERT INTO dashboard_assignments (dashboard_id, customer_id) VALUES ($1::uuid, $2::uuid)",
                        dashboard_id,
                        cid,
                    )

        rows = await pool.fetch(
            """SELECT c.id, c.name, c.slug
               FROM customers c
               JOIN dashboard_assignments da ON da.customer_id = c.id
               WHERE da.dashboard_id = $1::uuid
               ORDER BY c.name ASC""",
            dashboard_id,
        )
        return [dict(r) for r in rows]
    except HTTPException:
        raise
    except asyncpg.InvalidTextRepresentationError:
        raise HTTPException(status_code=400, detail="Invalid ID")
    except Exception as exc:
        raise HTTPException(status_code=500, detail="Internal server error") from exc


@router.get("/{dashboard_id}/customers", dependencies=[Depends(require_auth)])
async def get_dashboard_customers(dashboard_id: str, pool: asyncpg.Pool = Depends(get_pool)):
    # Accept UUID or slug
    is_uuid = bool(UUID_RE.match(dashboard_id))
    try:
        if is_uuid:
            d_id = dashboard_id
        else:
            row = await pool.fetchrow("SELECT id FROM dashboards WHERE slug = $1", dashboard_id)
            if not row:
                raise HTTPException(status_code=404, detail="Dashboard not found")
            d_id = str(row["id"])

        rows = await pool.fetch(
            """SELECT c.id, c.name, c.slug
               FROM customers c
               JOIN dashboard_assignments da ON da.customer_id = c.id
               WHERE da.dashboard_id = $1::uuid
               ORDER BY c.name ASC""",
            d_id,
        )
        return [dict(r) for r in rows]
    except HTTPException:
        raise
    except asyncpg.InvalidTextRepresentationError:
        raise HTTPException(status_code=400, detail="Invalid dashboard ID")
    except Exception as exc:
        raise HTTPException(status_code=500, detail="Internal server error") from exc


@router.delete("/{dashboard_id}", status_code=204, dependencies=[Depends(require_auth)])
async def delete_dashboard(dashboard_id: str, pool: asyncpg.Pool = Depends(get_pool)):
    try:
        result = await pool.execute("DELETE FROM dashboards WHERE id = $1::uuid", dashboard_id)
        if result == "DELETE 0":
            raise HTTPException(status_code=404, detail="Dashboard not found")
    except HTTPException:
        raise
    except asyncpg.ForeignKeyViolationError:
        raise HTTPException(status_code=409, detail="Dashboard is still referenced — unassign any customers first")
    except asyncpg.InvalidTextRepresentationError:
        raise HTTPException(status_code=400, detail="Invalid dashboard ID")
    except Exception as exc:
        raise HTTPException(status_code=500, detail="Internal server error") from exc
