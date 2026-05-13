"""Dashboards route — port of `src/routes/dashboards.ts`.

Note: /generate calls the in-process LLM module directly (no HTTP hop).
This is one of the wins from the migration plan §4.
"""

from __future__ import annotations

import asyncio
import json
import re
import time
from typing import Any, Literal

import asyncpg
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import JSONResponse, Response
from pydantic import BaseModel, Field

from ..auth.deps import require_auth
from ..config import settings
from ..db.pool import get_pool
from ..logger import create_logger
from ._helpers import (
    PG_INVALID_UUID,
    PG_UNIQUE_VIOLATION,
    pg_code,
    row_to_dict,
    rows_to_list,
)

log = create_logger("dashboards")
router = APIRouter(dependencies=[Depends(require_auth)])

_UUID_RE = re.compile(
    r"^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$", re.IGNORECASE
)


# ─── Pydantic schemas ────────────────────────────────────────────────────────


class ConfigSchema(BaseModel):
    model_config = {"extra": "allow"}
    components: list[Any]
    queries: list[Any]


class CreateSchema(BaseModel):
    name: str = Field(min_length=1)
    slug: str | None = None
    config: ConfigSchema
    status: Literal["draft", "live"] = "draft"


class UpdateSchema(BaseModel):
    name: str | None = Field(default=None, min_length=1)
    slug: str | None = None
    config: ConfigSchema | None = None
    status: Literal["draft", "live"] | None = None


class PublishSchema(BaseModel):
    status: Literal["draft", "live"]


class AssignSchema(BaseModel):
    customer_ids: list[str]


class GenerateSchema(BaseModel):
    prompt: str = Field(min_length=3)
    resourceIds: list[str] = []
    docsUrls: list[str] = []
    variantCount: int = Field(default=4, ge=1, le=8)


# ─── Helpers ─────────────────────────────────────────────────────────────────


def _to_slug(name: str) -> str:
    s = name.lower().strip()
    s = re.sub(r"[^a-z0-9\s-]", "", s)
    s = re.sub(r"\s+", "-", s)
    s = re.sub(r"-+", "-", s)
    s = re.sub(r"^-|-$", "", s)
    return s


# ─── Routes ──────────────────────────────────────────────────────────────────


@router.post("")
@router.post("/")
async def create_dashboard(body: CreateSchema):
    pool = get_pool()
    base_slug = body.slug or _to_slug(body.name)
    slug = base_slug
    config_json = json.dumps(body.config.model_dump())

    for attempt in range(10):
        try:
            row = await pool.fetchrow(
                """INSERT INTO dashboards (name, slug, config, status)
                   VALUES ($1, $2, $3::jsonb, $4)
                   RETURNING id, name, slug, config, status, created_at, updated_at""",
                body.name,
                slug,
                config_json,
                body.status,
            )
            return JSONResponse(status_code=201, content=row_to_dict(row))
        except asyncpg.PostgresError as err:
            if pg_code(err) == PG_UNIQUE_VIOLATION:
                slug = f"{base_slug}-{attempt + 1}"
                continue
            log.error("create:", err)
            raise HTTPException(status_code=500, detail="Internal server error")

    raise HTTPException(
        status_code=409, detail="Could not generate a unique slug after 10 attempts"
    )


@router.get("")
@router.get("/")
async def list_dashboards():
    pool = get_pool()
    try:
        rows = await pool.fetch(
            """SELECT
                 d.id, d.name, d.slug, d.status, d.created_at, d.updated_at,
                 COALESCE(
                   (
                     SELECT jsonb_agg(jsonb_build_object('id', sub.id, 'name', sub.name, 'slug', sub.slug))
                     FROM (
                       SELECT c.id, c.name, c.slug
                       FROM customers c
                       JOIN dashboard_assignments da
                         ON da.customer_id = c.id AND da.dashboard_id = d.id
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
        return rows_to_list(rows)
    except asyncpg.PostgresError as err:
        log.error("list:", err)
        raise HTTPException(status_code=500, detail="Internal server error")


@router.post("/generate")
async def generate_dashboard(body: GenerateSchema):
    started = time.time()
    log.info(
        f"generate request prompt_len={len(body.prompt)} "
        f"resource_ids={len(body.resourceIds)} docs={len(body.docsUrls)} "
        f"variants={body.variantCount}"
    )

    pool = get_pool()
    resources_payload: list[dict[str, Any]] = []
    if body.resourceIds:
        try:
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
            for r in rows:
                endpoints = r["endpoints"]
                if isinstance(endpoints, str):
                    try:
                        endpoints = json.loads(endpoints)
                    except Exception:
                        endpoints = []
                resources_payload.append(
                    {
                        "id": str(r["id"]),
                        "name": r["name"],
                        "type": r["type"],
                        "base_url": r["base_url"],
                        "endpoints": endpoints or [],
                    }
                )
        except asyncpg.PostgresError as err:
            log.error("generate resource lookup:", err)
            raise HTTPException(
                status_code=500, detail="Could not load resources for the LLM"
            )

    # In-process LLM call — no HTTP hop.
    from ..llm.facade import generate_variants

    try:
        upstream_started = time.time()
        result = await asyncio.wait_for(
            generate_variants(
                prompt=body.prompt,
                resources=resources_payload,
                docs_urls=body.docsUrls,
                variant_count=body.variantCount,
            ),
            timeout=settings.llm_timeout_s,
        )
        upstream_ms = int((time.time() - upstream_started) * 1000)
        total_ms = int((time.time() - started) * 1000)
        log.info(f"generate success upstream_ms={upstream_ms} total_ms={total_ms}")
        return result
    except asyncio.TimeoutError:
        seconds = int(settings.llm_timeout_s)
        log.error(f"generate timeout timeout_s={settings.llm_timeout_s}")
        raise HTTPException(
            status_code=504, detail=f"LLM generation took longer than {seconds} seconds"
        )
    except Exception as err:
        log.error("generate proxy error:", err)
        raise HTTPException(status_code=502, detail="Could not run LLM generation")


@router.get("/{dashboard_id}")
async def get_dashboard(dashboard_id: str):
    pool = get_pool()
    try:
        row = await pool.fetchrow(
            """SELECT id, name, slug, config, status, created_at, updated_at
               FROM dashboards
               WHERE id = $1""",
            dashboard_id,
        )
    except asyncpg.PostgresError as err:
        if pg_code(err) == PG_INVALID_UUID:
            raise HTTPException(status_code=400, detail="Invalid dashboard ID")
        log.error("get:", err)
        raise HTTPException(status_code=500, detail="Internal server error")
    if not row:
        raise HTTPException(status_code=404, detail="Dashboard not found")
    return row_to_dict(row)


@router.put("/{dashboard_id}")
async def update_dashboard(dashboard_id: str, body: UpdateSchema):
    data = body.model_dump(exclude_unset=True)
    if not data:
        raise HTTPException(status_code=400, detail="No fields provided to update")

    base_slug = data.get("slug")
    if base_slug is None and "name" in data:
        base_slug = _to_slug(data["name"])
    current_slug = base_slug

    pool = get_pool()
    for attempt in range(10):
        set_clauses: list[str] = []
        values: list[Any] = []
        i = 1

        if "name" in data:
            set_clauses.append(f"name = ${i}")
            values.append(data["name"])
            i += 1
        if current_slug is not None:
            set_clauses.append(f"slug = ${i}")
            values.append(current_slug)
            i += 1
        if "config" in data:
            set_clauses.append(f"config = ${i}::jsonb")
            values.append(json.dumps(data["config"]))
            i += 1
        if "status" in data:
            set_clauses.append(f"status = ${i}")
            values.append(data["status"])
            i += 1
        set_clauses.append("updated_at = NOW()")
        values.append(dashboard_id)

        try:
            row = await pool.fetchrow(
                f"""UPDATE dashboards
                    SET {', '.join(set_clauses)}
                    WHERE id = ${i}
                    RETURNING id, name, slug, config, status, created_at, updated_at""",
                *values,
            )
            if not row:
                raise HTTPException(status_code=404, detail="Dashboard not found")
            return row_to_dict(row)
        except asyncpg.PostgresError as err:
            code = pg_code(err)
            if code == PG_UNIQUE_VIOLATION:
                if base_slug is not None:
                    current_slug = f"{base_slug}-{attempt + 1}"
                    continue
                raise HTTPException(status_code=409, detail="Slug is already taken")
            if code == PG_INVALID_UUID:
                raise HTTPException(status_code=400, detail="Invalid dashboard ID")
            log.error("update:", err)
            raise HTTPException(status_code=500, detail="Internal server error")

    raise HTTPException(
        status_code=409, detail="Could not generate a unique slug after 10 attempts"
    )


@router.patch("/{dashboard_id}/publish")
async def publish_dashboard(dashboard_id: str, body: PublishSchema):
    published_clause = "NOW()" if body.status == "live" else "NULL"
    pool = get_pool()
    try:
        row = await pool.fetchrow(
            f"""UPDATE dashboards
                SET status = $1, published_at = {published_clause}, updated_at = NOW()
                WHERE id = $2
                RETURNING id, name, slug, config, status, published_at, created_at, updated_at""",
            body.status,
            dashboard_id,
        )
    except asyncpg.PostgresError as err:
        if pg_code(err) == PG_INVALID_UUID:
            raise HTTPException(status_code=400, detail="Invalid dashboard ID")
        log.error("publish:", err)
        raise HTTPException(status_code=500, detail="Internal server error")
    if not row:
        raise HTTPException(status_code=404, detail="Dashboard not found")
    return row_to_dict(row)


@router.post("/{dashboard_id}/assign")
async def assign_dashboard(dashboard_id: str, body: AssignSchema):
    pool = get_pool()
    try:
        dash = await pool.fetchrow(
            "SELECT id FROM dashboards WHERE id = $1", dashboard_id
        )
        if not dash:
            raise HTTPException(status_code=404, detail="Dashboard not found")

        async with pool.acquire() as conn:
            async with conn.transaction():
                await conn.execute(
                    "DELETE FROM dashboard_assignments WHERE dashboard_id = $1",
                    dashboard_id,
                )
                if body.customer_ids:
                    await conn.execute(
                        """INSERT INTO dashboard_assignments (dashboard_id, customer_id)
                           SELECT $1, UNNEST($2::uuid[])""",
                        dashboard_id,
                        body.customer_ids,
                    )

        rows = await pool.fetch(
            """SELECT c.id, c.name, c.slug
               FROM customers c
               JOIN dashboard_assignments da ON da.customer_id = c.id
               WHERE da.dashboard_id = $1
               ORDER BY c.name ASC""",
            dashboard_id,
        )
        return rows_to_list(rows)
    except HTTPException:
        raise
    except asyncpg.PostgresError as err:
        if pg_code(err) == PG_INVALID_UUID:
            raise HTTPException(status_code=400, detail="Invalid ID")
        log.error("assign:", err)
        raise HTTPException(status_code=500, detail="Internal server error")


@router.get("/{dashboard_id}/customers")
async def get_dashboard_customers(dashboard_id: str):
    pool = get_pool()
    try:
        if _UUID_RE.match(dashboard_id):
            resolved_id = dashboard_id
        else:
            dash = await pool.fetchrow(
                "SELECT id FROM dashboards WHERE slug = $1", dashboard_id
            )
            if not dash:
                raise HTTPException(status_code=404, detail="Dashboard not found")
            resolved_id = str(dash["id"])

        rows = await pool.fetch(
            """SELECT c.id, c.name, c.slug
               FROM customers c
               JOIN dashboard_assignments da ON da.customer_id = c.id
               WHERE da.dashboard_id = $1
               ORDER BY c.name ASC""",
            resolved_id,
        )
        return rows_to_list(rows)
    except HTTPException:
        raise
    except asyncpg.PostgresError as err:
        if pg_code(err) == PG_INVALID_UUID:
            raise HTTPException(status_code=400, detail="Invalid dashboard ID")
        log.error("get assigned customers:", err)
        raise HTTPException(status_code=500, detail="Internal server error")


@router.delete("/{dashboard_id}")
async def delete_dashboard(dashboard_id: str):
    pool = get_pool()
    try:
        result = await pool.execute(
            "DELETE FROM dashboards WHERE id = $1", dashboard_id
        )
        affected = int(result.split()[-1]) if result and result.startswith("DELETE") else 0
        if not affected:
            raise HTTPException(status_code=404, detail="Dashboard not found")
        return Response(status_code=204)
    except asyncpg.PostgresError as err:
        code = pg_code(err)
        if code == PG_INVALID_UUID:
            raise HTTPException(status_code=400, detail="Invalid dashboard ID")
        if code == "23503":
            raise HTTPException(
                status_code=409,
                detail="Dashboard is still referenced — unassign any customers first",
            )
        log.error("delete:", err)
        raise HTTPException(status_code=500, detail="Internal server error")
