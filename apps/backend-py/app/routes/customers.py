import json
import re
import secrets
from typing import Any

import asyncpg
from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel, field_validator

from app.db.client import get_pool
from app.middleware.auth import require_auth

router = APIRouter()

SLUG_RE = re.compile(r"^[a-z0-9]+(?:-[a-z0-9]+)*$")
UUID_RE = re.compile(r"^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$", re.IGNORECASE)


def _generate_access_token() -> str:
    return secrets.token_hex(16)


class CreateCustomer(BaseModel):
    name: str
    slug: str
    dashboard_id: str | None = None
    brand_config: dict[str, Any] | None = None

    @field_validator("slug")
    @classmethod
    def validate_slug(cls, v: str) -> str:
        if not SLUG_RE.match(v):
            raise ValueError("slug must be lowercase letters, numbers, and hyphens only")
        return v


class UpdateCustomer(BaseModel):
    name: str | None = None
    slug: str | None = None
    dashboard_id: str | None = None
    brand_config: dict[str, Any] | None = None

    @field_validator("slug")
    @classmethod
    def validate_slug(cls, v: str | None) -> str | None:
        if v is not None and not SLUG_RE.match(v):
            raise ValueError("slug must be lowercase letters, numbers, and hyphens only")
        return v


@router.post("", status_code=201, dependencies=[Depends(require_auth)])
async def create_customer(body: CreateCustomer, pool: asyncpg.Pool = Depends(get_pool)):
    access_token = _generate_access_token()
    try:
        row = await pool.fetchrow(
            """INSERT INTO customers (name, slug, dashboard_id, brand_config, access_token)
               VALUES ($1, $2, $3, $4::jsonb, $5)
               RETURNING id, name, slug, dashboard_id, brand_config, access_token, created_at, updated_at""",
            body.name,
            body.slug,
            body.dashboard_id,
            body.brand_config or {},
            access_token,
        )
        return dict(row)
    except asyncpg.UniqueViolationError:
        raise HTTPException(status_code=409, detail=f'Slug "{body.slug}" is already taken')
    except asyncpg.ForeignKeyViolationError:
        raise HTTPException(status_code=400, detail="dashboard_id does not reference an existing dashboard")
    except Exception as exc:
        raise HTTPException(status_code=500, detail="Internal server error") from exc


@router.get("", dependencies=[Depends(require_auth)])
async def list_customers(pool: asyncpg.Pool = Depends(get_pool)):
    rows = await pool.fetch(
        "SELECT id, name, slug, dashboard_id, access_token, created_at FROM customers ORDER BY created_at DESC"
    )
    return [dict(r) for r in rows]


@router.get("/{slug}/dashboard")
async def get_customer_dashboard(slug: str, request: Request, pool: asyncpg.Pool = Depends(get_pool)):
    """Public endpoint — no auth required (but token-protected customers need ?token or header)."""
    customer = await pool.fetchrow("SELECT id, access_token FROM customers WHERE slug = $1", slug)
    if not customer:
        raise HTTPException(status_code=404, detail="Customer not found")

    if customer["access_token"] is not None:
        provided_token = (
            request.query_params.get("token")
            or request.headers.get("x-dashboard-token")
        )
        if not provided_token or provided_token != customer["access_token"]:
            raise HTTPException(status_code=401, detail="Invalid access token")

    row = await pool.fetchrow(
        """SELECT
             c.id          AS customer_id,
             c.name        AS customer_name,
             c.slug        AS customer_slug,
             c.brand_config,
             d.id          AS dashboard_id,
             d.name        AS dashboard_name,
             d.slug        AS dashboard_slug,
             d.config      AS dashboard_cfg,
             d.status      AS dashboard_status
           FROM customers c
           LEFT JOIN LATERAL (
             SELECT d.id, d.name, d.slug, d.config, d.status
             FROM dashboards d
             WHERE (d.id = c.dashboard_id OR d.id IN (
               SELECT dashboard_id FROM dashboard_assignments WHERE customer_id = c.id
             ))
             AND d.status = 'live'
             ORDER BY (d.id = c.dashboard_id) DESC, d.published_at DESC
             LIMIT 1
           ) d ON TRUE
           WHERE c.id = $1""",
        customer["id"],
    )

    if not row:
        raise HTTPException(status_code=404, detail="Customer not found")

    if not row["dashboard_id"] or row["dashboard_status"] != "live":
        raise HTTPException(status_code=404, detail="No live dashboard assigned to this customer")

    return {
        "customer": {
            "id": str(row["customer_id"]),
            "name": row["customer_name"],
            "slug": row["customer_slug"],
            "brand_config": row["brand_config"],
        },
        "dashboard": {
            "id": str(row["dashboard_id"]),
            "name": row["dashboard_name"],
            "slug": row["dashboard_slug"],
            "config": row["dashboard_cfg"],
        },
    }


@router.get("/{customer_id}", dependencies=[Depends(require_auth)])
async def get_customer(customer_id: str, pool: asyncpg.Pool = Depends(get_pool)):
    try:
        row = await pool.fetchrow(
            "SELECT id, name, slug, dashboard_id, brand_config, access_token, created_at, updated_at FROM customers WHERE id = $1::uuid",
            customer_id,
        )
    except asyncpg.InvalidTextRepresentationError:
        raise HTTPException(status_code=400, detail="Invalid customer ID")
    if not row:
        raise HTTPException(status_code=404, detail="Customer not found")
    return dict(row)


@router.put("/{customer_id}", dependencies=[Depends(require_auth)])
async def update_customer(customer_id: str, body: UpdateCustomer, pool: asyncpg.Pool = Depends(get_pool)):
    data = body.model_dump(exclude_none=True)
    if not data:
        raise HTTPException(status_code=400, detail="No fields provided to update")

    set_clauses: list[str] = []
    values: list[Any] = []
    i = 1

    if body.name is not None:
        set_clauses.append(f"name = ${i}")
        values.append(body.name)
        i += 1
    if body.slug is not None:
        set_clauses.append(f"slug = ${i}")
        values.append(body.slug)
        i += 1
    if body.dashboard_id is not None:
        set_clauses.append(f"dashboard_id = ${i}")
        values.append(body.dashboard_id)
        i += 1
    if body.brand_config is not None:
        set_clauses.append(f"brand_config = ${i}::jsonb")
        values.append(body.brand_config)
        i += 1

    set_clauses.append("updated_at = NOW()")
    values.append(customer_id)

    try:
        row = await pool.fetchrow(
            f"""UPDATE customers SET {', '.join(set_clauses)}
                WHERE id = ${i}::uuid
                RETURNING id, name, slug, dashboard_id, brand_config, access_token, created_at, updated_at""",
            *values,
        )
    except asyncpg.UniqueViolationError:
        raise HTTPException(status_code=409, detail="Slug is already taken")
    except asyncpg.ForeignKeyViolationError:
        raise HTTPException(status_code=400, detail="dashboard_id does not reference an existing dashboard")
    except asyncpg.InvalidTextRepresentationError:
        raise HTTPException(status_code=400, detail="Invalid customer ID")
    except Exception as exc:
        raise HTTPException(status_code=500, detail="Internal server error") from exc

    if not row:
        raise HTTPException(status_code=404, detail="Customer not found")
    return dict(row)


@router.delete("/{customer_id}", status_code=204, dependencies=[Depends(require_auth)])
async def delete_customer(customer_id: str, pool: asyncpg.Pool = Depends(get_pool)):
    try:
        result = await pool.execute("DELETE FROM customers WHERE id = $1::uuid", customer_id)
        if result == "DELETE 0":
            raise HTTPException(status_code=404, detail="Customer not found")
    except HTTPException:
        raise
    except asyncpg.InvalidTextRepresentationError:
        raise HTTPException(status_code=400, detail="Invalid customer ID")
    except Exception as exc:
        raise HTTPException(status_code=500, detail="Internal server error") from exc


@router.get("/{customer_id}/dashboards", dependencies=[Depends(require_auth)])
async def list_customer_dashboards(customer_id: str, pool: asyncpg.Pool = Depends(get_pool)):
    try:
        rows = await pool.fetch(
            """SELECT d.id, d.name, d.slug, d.status, d.published_at
               FROM dashboards d
               JOIN dashboard_assignments da ON da.dashboard_id = d.id
               WHERE da.customer_id = $1::uuid AND d.status = 'live'
               ORDER BY d.published_at DESC""",
            customer_id,
        )
        return [dict(r) for r in rows]
    except asyncpg.InvalidTextRepresentationError:
        raise HTTPException(status_code=400, detail="Invalid customer ID")
    except Exception as exc:
        raise HTTPException(status_code=500, detail="Internal server error") from exc


@router.post("/{customer_id}/rotate-token", dependencies=[Depends(require_auth)])
async def rotate_token(customer_id: str, pool: asyncpg.Pool = Depends(get_pool)):
    new_token = _generate_access_token()
    try:
        row = await pool.fetchrow(
            """UPDATE customers SET access_token = $1, updated_at = NOW()
               WHERE id = $2::uuid
               RETURNING id, name, slug, dashboard_id, brand_config, access_token, created_at, updated_at""",
            new_token, customer_id,
        )
    except asyncpg.InvalidTextRepresentationError:
        raise HTTPException(status_code=400, detail="Invalid customer ID")
    if not row:
        raise HTTPException(status_code=404, detail="Customer not found")
    return dict(row)


@router.post("/{customer_id}/clear-token", dependencies=[Depends(require_auth)])
async def clear_token(customer_id: str, pool: asyncpg.Pool = Depends(get_pool)):
    try:
        row = await pool.fetchrow(
            """UPDATE customers SET access_token = NULL, updated_at = NOW()
               WHERE id = $1::uuid
               RETURNING id, name, slug, dashboard_id, brand_config, access_token, created_at, updated_at""",
            customer_id,
        )
    except asyncpg.InvalidTextRepresentationError:
        raise HTTPException(status_code=400, detail="Invalid customer ID")
    if not row:
        raise HTTPException(status_code=404, detail="Customer not found")
    return dict(row)
