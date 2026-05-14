"""Customers route — port of `src/routes/customers.ts`.

Authentication: standard `require_auth` for all admin routes; the public-facing
GET /:slug/dashboard is exempt and gated by per-customer access_token instead.
"""

from __future__ import annotations

import json
import secrets
import re
from typing import Any, Literal

import asyncpg
from fastapi import APIRouter, Depends, HTTPException, Header, Query, Request
from fastapi.responses import JSONResponse, Response
from pydantic import BaseModel, Field, field_validator

from ..auth.deps import require_auth
from ..db.pool import get_pool
from ..logger import create_logger
from ._helpers import (
    PG_FOREIGN_KEY,
    PG_INVALID_UUID,
    PG_UNIQUE_VIOLATION,
    pg_code,
    row_to_dict,
    rows_to_list,
)

log = create_logger("customers")
router = APIRouter()

_SLUG_RE = re.compile(r"^[a-z0-9]+(?:-[a-z0-9]+)*$")
_UUID_RE = re.compile(
    r"^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$", re.IGNORECASE
)


# ─── Pydantic schemas ────────────────────────────────────────────────────────


class CreateSchema(BaseModel):
    name: str = Field(min_length=1)
    slug: str
    dashboard_id: str | None = None
    brand_config: dict[str, Any] | None = None

    @field_validator("slug")
    @classmethod
    def _slug_must_match(cls, v: str) -> str:
        if not _SLUG_RE.match(v):
            raise ValueError(
                "slug must be lowercase letters, numbers, and hyphens only"
            )
        return v


class UpdateSchema(BaseModel):
    name: str | None = Field(default=None, min_length=1)
    slug: str | None = None
    dashboard_id: str | None = None
    brand_config: dict[str, Any] | None = None

    @field_validator("slug")
    @classmethod
    def _slug_must_match(cls, v: str | None) -> str | None:
        if v is not None and not _SLUG_RE.match(v):
            raise ValueError(
                "slug must be lowercase letters, numbers, and hyphens only"
            )
        return v


def _generate_access_token() -> str:
    return secrets.token_hex(16)


# ─── Auth-gated admin routes ─────────────────────────────────────────────────


@router.post("", dependencies=[Depends(require_auth)])
@router.post("/", dependencies=[Depends(require_auth)])
async def create_customer(body: CreateSchema):
    access_token = _generate_access_token()
    pool = get_pool()
    try:
        row = await pool.fetchrow(
            """INSERT INTO customers (name, slug, dashboard_id, brand_config, access_token)
               VALUES ($1, $2, $3, $4::jsonb, $5)
               RETURNING id, name, slug, dashboard_id, brand_config, access_token,
                         created_at, updated_at""",
            body.name,
            body.slug,
            body.dashboard_id,
            json.dumps(body.brand_config or {}),
            access_token,
        )
        return JSONResponse(status_code=201, content=row_to_dict(row))
    except asyncpg.PostgresError as err:
        code = pg_code(err)
        if code == PG_UNIQUE_VIOLATION:
            return JSONResponse(
                status_code=409, content={"error": f'Slug "{body.slug}" is already taken'}
            )
        if code == PG_FOREIGN_KEY:
            return JSONResponse(
                status_code=400,
                content={"error": "dashboard_id does not reference an existing dashboard"},
            )
        log.error("create:", err)
        raise HTTPException(status_code=500, detail="Internal server error")


@router.get("", dependencies=[Depends(require_auth)])
@router.get("/", dependencies=[Depends(require_auth)])
async def list_customers():
    pool = get_pool()
    try:
        rows = await pool.fetch(
            """SELECT id, name, slug, dashboard_id, access_token, created_at
               FROM customers
               ORDER BY created_at DESC"""
        )
        return rows_to_list(rows)
    except asyncpg.PostgresError as err:
        log.error("list:", err)
        raise HTTPException(status_code=500, detail="Internal server error")


# ─── Public customer dashboard view ──────────────────────────────────────────
# This route is exempt from require_auth — it's the customer-facing endpoint.
# Access is gated by the per-customer access_token (if set).


@router.get("/{slug}/dashboard")
async def get_customer_dashboard(
    slug: str,
    token: str | None = Query(default=None),
    x_dashboard_token: str | None = Header(default=None, alias="x-dashboard-token"),
):
    pool = get_pool()
    try:
        customer_row = await pool.fetchrow(
            "SELECT id, access_token FROM customers WHERE slug = $1", slug
        )
        if not customer_row:
            raise HTTPException(status_code=404, detail="Customer not found")

        if customer_row["access_token"] is not None:
            provided = token or x_dashboard_token
            if not provided or provided != customer_row["access_token"]:
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
            customer_row["id"],
        )

        if not row:
            raise HTTPException(status_code=404, detail="Customer not found")

        if not row["dashboard_id"] or row["dashboard_status"] != "live":
            raise HTTPException(
                status_code=404, detail="No live dashboard assigned to this customer"
            )

        return {
            "customer": {
                "id": str(row["customer_id"]),
                "name": row["customer_name"],
                "slug": row["customer_slug"],
                "brand_config": row_to_dict({"brand_config": row["brand_config"]})["brand_config"]
                if not isinstance(row["brand_config"], (dict, list))
                else row["brand_config"],
            },
            "dashboard": {
                "id": str(row["dashboard_id"]),
                "name": row["dashboard_name"],
                "slug": row["dashboard_slug"],
                "config": row_to_dict({"config": row["dashboard_cfg"]})["config"]
                if not isinstance(row["dashboard_cfg"], (dict, list))
                else row["dashboard_cfg"],
            },
        }
    except HTTPException:
        raise
    except asyncpg.PostgresError as err:
        log.error("slug→dashboard:", err)
        raise HTTPException(status_code=500, detail="Internal server error")


# ─── Auth-gated single-customer routes ───────────────────────────────────────


@router.get("/{customer_id}", dependencies=[Depends(require_auth)])
async def get_customer(customer_id: str):
    pool = get_pool()
    try:
        row = await pool.fetchrow(
            """SELECT id, name, slug, dashboard_id, brand_config, access_token,
                      created_at, updated_at
               FROM customers
               WHERE id = $1""",
            customer_id,
        )
    except asyncpg.PostgresError as err:
        if pg_code(err) == PG_INVALID_UUID:
            raise HTTPException(status_code=400, detail="Invalid customer ID")
        log.error("get:", err)
        raise HTTPException(status_code=500, detail="Internal server error")
    if not row:
        raise HTTPException(status_code=404, detail="Customer not found")
    return row_to_dict(row)


@router.put("/{customer_id}", dependencies=[Depends(require_auth)])
async def update_customer(customer_id: str, body: UpdateSchema):
    data = body.model_dump(exclude_unset=True)
    if not data:
        raise HTTPException(status_code=400, detail="No fields provided to update")

    set_clauses: list[str] = []
    values: list[Any] = []
    i = 1
    for k in ("name", "slug", "dashboard_id"):
        if k in data:
            set_clauses.append(f"{k} = ${i}")
            values.append(data[k])
            i += 1
    if "brand_config" in data:
        set_clauses.append(f"brand_config = ${i}::jsonb")
        values.append(json.dumps(data["brand_config"] or {}))
        i += 1
    set_clauses.append("updated_at = NOW()")
    values.append(customer_id)

    pool = get_pool()
    try:
        row = await pool.fetchrow(
            f"""UPDATE customers
                SET {', '.join(set_clauses)}
                WHERE id = ${i}
                RETURNING id, name, slug, dashboard_id, brand_config, access_token,
                          created_at, updated_at""",
            *values,
        )
    except asyncpg.PostgresError as err:
        code = pg_code(err)
        if code == PG_UNIQUE_VIOLATION:
            raise HTTPException(status_code=409, detail="Slug is already taken")
        if code == PG_FOREIGN_KEY:
            raise HTTPException(
                status_code=400,
                detail="dashboard_id does not reference an existing dashboard",
            )
        if code == PG_INVALID_UUID:
            raise HTTPException(status_code=400, detail="Invalid customer ID")
        log.error("update:", err)
        raise HTTPException(status_code=500, detail="Internal server error")
    if not row:
        raise HTTPException(status_code=404, detail="Customer not found")
    return row_to_dict(row)


@router.delete("/{customer_id}", dependencies=[Depends(require_auth)])
async def delete_customer(customer_id: str):
    pool = get_pool()
    try:
        result = await pool.execute("DELETE FROM customers WHERE id = $1", customer_id)
        affected = int(result.split()[-1]) if result and result.startswith("DELETE") else 0
        if not affected:
            raise HTTPException(status_code=404, detail="Customer not found")
        return Response(status_code=204)
    except asyncpg.PostgresError as err:
        if pg_code(err) == PG_INVALID_UUID:
            raise HTTPException(status_code=400, detail="Invalid customer ID")
        log.error("delete:", err)
        raise HTTPException(status_code=500, detail="Internal server error")


@router.get("/{customer_id}/dashboards", dependencies=[Depends(require_auth)])
async def get_customer_dashboards(customer_id: str):
    pool = get_pool()
    try:
        rows = await pool.fetch(
            """SELECT d.id, d.name, d.slug, d.status, d.published_at
               FROM dashboards d
               JOIN dashboard_assignments da ON da.dashboard_id = d.id
               WHERE da.customer_id = $1 AND d.status = 'live'
               ORDER BY d.published_at DESC""",
            customer_id,
        )
        return rows_to_list(rows)
    except asyncpg.PostgresError as err:
        if pg_code(err) == PG_INVALID_UUID:
            raise HTTPException(status_code=400, detail="Invalid customer ID")
        log.error("list dashboards:", err)
        raise HTTPException(status_code=500, detail="Internal server error")


@router.post("/{customer_id}/rotate-token", dependencies=[Depends(require_auth)])
async def rotate_token(customer_id: str):
    new_token = _generate_access_token()
    pool = get_pool()
    try:
        row = await pool.fetchrow(
            """UPDATE customers
               SET access_token = $1, updated_at = NOW()
               WHERE id = $2
               RETURNING id, name, slug, dashboard_id, brand_config, access_token,
                         created_at, updated_at""",
            new_token,
            customer_id,
        )
    except asyncpg.PostgresError as err:
        if pg_code(err) == PG_INVALID_UUID:
            raise HTTPException(status_code=400, detail="Invalid customer ID")
        log.error("rotate-token:", err)
        raise HTTPException(status_code=500, detail="Internal server error")
    if not row:
        raise HTTPException(status_code=404, detail="Customer not found")
    return row_to_dict(row)


@router.post("/{customer_id}/clear-token", dependencies=[Depends(require_auth)])
async def clear_token(customer_id: str):
    pool = get_pool()
    try:
        row = await pool.fetchrow(
            """UPDATE customers
               SET access_token = NULL, updated_at = NOW()
               WHERE id = $1
               RETURNING id, name, slug, dashboard_id, brand_config, access_token,
                         created_at, updated_at""",
            customer_id,
        )
    except asyncpg.PostgresError as err:
        if pg_code(err) == PG_INVALID_UUID:
            raise HTTPException(status_code=400, detail="Invalid customer ID")
        log.error("clear-token:", err)
        raise HTTPException(status_code=500, detail="Internal server error")
    if not row:
        raise HTTPException(status_code=404, detail="Customer not found")
    return row_to_dict(row)
