import json
from typing import Any

import asyncpg
import httpx
from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel, field_validator

from app.db.client import get_pool
from app.middleware.auth import require_auth
from app.utils.swagger_parser import parse_swagger_doc

router = APIRouter()

SAFE_COLS = "id, name, type, base_url, auth_type, (secret_ref IS NOT NULL) AS has_secret, created_at"

VALID_TYPES = ("REST", "postgresql", "agent")
VALID_AUTH_TYPES = ("none", "bearer", "api_key", "basic")


class CreateResource(BaseModel):
    name: str
    type: str
    base_url: str | None = None
    auth_type: str = "none"
    secret_ref: str | None = None

    @field_validator("type")
    @classmethod
    def validate_type(cls, v: str) -> str:
        if v not in VALID_TYPES:
            raise ValueError(f"type must be one of {VALID_TYPES}")
        return v

    @field_validator("auth_type")
    @classmethod
    def validate_auth_type(cls, v: str) -> str:
        if v not in VALID_AUTH_TYPES:
            raise ValueError(f"auth_type must be one of {VALID_AUTH_TYPES}")
        return v


class UpdateResource(BaseModel):
    name: str | None = None
    type: str | None = None
    base_url: str | None = None
    auth_type: str | None = None
    secret_ref: str | None = None

    @field_validator("type")
    @classmethod
    def validate_type(cls, v: str | None) -> str | None:
        if v is not None and v not in VALID_TYPES:
            raise ValueError(f"type must be one of {VALID_TYPES}")
        return v


class ImportSwagger(BaseModel):
    swaggerUrl: str
    resourceName: str
    baseUrl: str
    authType: str = "none"
    secretRef: str | None = None


@router.post("", status_code=201, dependencies=[Depends(require_auth)])
async def create_resource(body: CreateResource, pool: asyncpg.Pool = Depends(get_pool)):
    if body.type in ("REST", "agent") and not body.base_url:
        raise HTTPException(status_code=400, detail="base_url is required for REST and agent resource types")

    try:
        row = await pool.fetchrow(
            f"""INSERT INTO resources (name, type, base_url, auth_type, secret_ref)
                VALUES ($1, $2, $3, $4, $5)
                RETURNING {SAFE_COLS}""",
            body.name, body.type, body.base_url, body.auth_type, body.secret_ref,
        )
        return dict(row)
    except asyncpg.UniqueViolationError:
        raise HTTPException(status_code=409, detail=f'Resource name "{body.name}" is already taken')
    except Exception as exc:
        raise HTTPException(status_code=500, detail="Internal server error") from exc


@router.get("", dependencies=[Depends(require_auth)])
async def list_resources(pool: asyncpg.Pool = Depends(get_pool)):
    rows = await pool.fetch(f"SELECT {SAFE_COLS} FROM resources ORDER BY name ASC")
    return [dict(r) for r in rows]


@router.post("/import-swagger", dependencies=[Depends(require_auth)])
async def import_swagger(body: ImportSwagger, pool: asyncpg.Pool = Depends(get_pool)):
    try:
        async with httpx.AsyncClient(timeout=30) as client:
            resp = await client.get(body.swaggerUrl)
        if not resp.is_success:
            raise HTTPException(status_code=400, detail="Could not fetch Swagger docs")
        doc = resp.json()
    except HTTPException:
        raise
    except Exception:
        raise HTTPException(status_code=400, detail="Could not fetch Swagger docs")

    endpoints = parse_swagger_doc(doc)
    if not endpoints:
        raise HTTPException(status_code=400, detail="No endpoints found in docs")

    async with pool.acquire() as conn:
        async with conn.transaction():
            row = await conn.fetchrow(
                """INSERT INTO resources (name, type, base_url, auth_type, secret_ref)
                   VALUES ($1, 'REST', $2, $3, $4)
                   ON CONFLICT (name) DO UPDATE
                     SET base_url   = EXCLUDED.base_url,
                         auth_type  = EXCLUDED.auth_type,
                         secret_ref = EXCLUDED.secret_ref
                   RETURNING id, name""",
                body.resourceName, body.baseUrl, body.authType, body.secretRef,
            )
            resource_id = str(row["id"])

            await conn.execute("DELETE FROM resource_endpoints WHERE resource_id = $1", resource_id)

            for ep in endpoints:
                await conn.execute(
                    """INSERT INTO resource_endpoints (resource_id, method, path, summary, parameters, request_body)
                       VALUES ($1, $2, $3, $4, $5::jsonb, $6::jsonb)""",
                    resource_id,
                    ep["method"],
                    ep["path"],
                    ep["summary"],
                    ep["parameters"],
                    ep["request_body"],
                )

    return {
        "success": True,
        "resource": {"id": resource_id, "name": row["name"]},
        "endpointsImported": len(endpoints),
    }


@router.get("/{resource_id}/schema", dependencies=[Depends(require_auth)])
async def get_resource_schema(resource_id: str, pool: asyncpg.Pool = Depends(get_pool)):
    try:
        row = await pool.fetchrow(f"SELECT {SAFE_COLS} FROM resources WHERE id = $1::uuid", resource_id)
    except asyncpg.InvalidTextRepresentationError:
        raise HTTPException(status_code=400, detail="Invalid resource ID")

    if not row:
        raise HTTPException(status_code=404, detail="Resource not found")
    if row["type"] != "postgresql":
        raise HTTPException(status_code=400, detail="Schema introspection only supports PostgreSQL")

    table_rows = await pool.fetch(
        "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_type = 'BASE TABLE' ORDER BY table_name ASC"
    )

    tables = []
    for t in table_rows:
        col_rows = await pool.fetch(
            "SELECT column_name, data_type FROM information_schema.columns WHERE table_name = $1 AND table_schema = 'public' ORDER BY ordinal_position ASC",
            t["table_name"],
        )
        tables.append({
            "name": t["table_name"],
            "columns": [{"name": c["column_name"], "type": c["data_type"]} for c in col_rows],
        })

    return {"tables": tables}


@router.post("/{resource_id}/preview", dependencies=[Depends(require_auth)])
async def preview_resource(resource_id: str, request: Request, pool: asyncpg.Pool = Depends(get_pool)):
    try:
        row = await pool.fetchrow(f"SELECT {SAFE_COLS} FROM resources WHERE id = $1::uuid", resource_id)
    except asyncpg.InvalidTextRepresentationError:
        raise HTTPException(status_code=400, detail="Invalid resource ID")

    if not row:
        raise HTTPException(status_code=404, detail="Resource not found")

    try:
        body = await request.json()
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid JSON")

    sql: str | None = body.get("sql")
    params: list = body.get("params") or []
    if not sql:
        raise HTTPException(status_code=400, detail="sql is required")

    try:
        result = await pool.fetch(sql + " LIMIT 5", *params)
        return {"rows": [dict(r) for r in result]}
    except Exception as exc:
        raise HTTPException(status_code=400, detail=str(exc))


@router.get("/{resource_id}/endpoints", dependencies=[Depends(require_auth)])
async def get_resource_endpoints(resource_id: str, pool: asyncpg.Pool = Depends(get_pool)):
    try:
        rows = await pool.fetch(
            "SELECT id, method, path, summary, parameters FROM resource_endpoints WHERE resource_id = $1::uuid ORDER BY path ASC, method ASC",
            resource_id,
        )
        return [dict(r) for r in rows]
    except asyncpg.InvalidTextRepresentationError:
        raise HTTPException(status_code=400, detail="Invalid resource ID")
    except Exception as exc:
        raise HTTPException(status_code=500, detail="Internal server error") from exc


@router.get("/{resource_id}", dependencies=[Depends(require_auth)])
async def get_resource(resource_id: str, pool: asyncpg.Pool = Depends(get_pool)):
    try:
        row = await pool.fetchrow(f"SELECT {SAFE_COLS} FROM resources WHERE id = $1::uuid", resource_id)
    except asyncpg.InvalidTextRepresentationError:
        raise HTTPException(status_code=400, detail="Invalid resource ID")

    if not row:
        raise HTTPException(status_code=404, detail="Resource not found")
    return dict(row)


@router.put("/{resource_id}", dependencies=[Depends(require_auth)])
async def update_resource(resource_id: str, body: UpdateResource, pool: asyncpg.Pool = Depends(get_pool)):
    data = body.model_dump(exclude_none=True)
    if not data:
        raise HTTPException(status_code=400, detail="No fields provided to update")

    set_clauses: list[str] = []
    values: list[Any] = []
    i = 1

    for field in ("name", "type", "base_url", "auth_type", "secret_ref"):
        val = getattr(body, field)
        if val is not None:
            set_clauses.append(f"{field} = ${i}")
            values.append(val)
            i += 1

    values.append(resource_id)

    try:
        row = await pool.fetchrow(
            f"""UPDATE resources SET {', '.join(set_clauses)}
                WHERE id = ${i}::uuid
                RETURNING {SAFE_COLS}""",
            *values,
        )
    except asyncpg.UniqueViolationError:
        raise HTTPException(status_code=409, detail="Resource name is already taken")
    except asyncpg.InvalidTextRepresentationError:
        raise HTTPException(status_code=400, detail="Invalid resource ID")
    except Exception as exc:
        raise HTTPException(status_code=500, detail="Internal server error") from exc

    if not row:
        raise HTTPException(status_code=404, detail="Resource not found")
    return dict(row)


@router.delete("/{resource_id}", status_code=204, dependencies=[Depends(require_auth)])
async def delete_resource(resource_id: str, pool: asyncpg.Pool = Depends(get_pool)):
    try:
        result = await pool.execute("DELETE FROM resources WHERE id = $1::uuid", resource_id)
        if result == "DELETE 0":
            raise HTTPException(status_code=404, detail="Resource not found")
    except HTTPException:
        raise
    except asyncpg.InvalidTextRepresentationError:
        raise HTTPException(status_code=400, detail="Invalid resource ID")
    except Exception as exc:
        raise HTTPException(status_code=500, detail="Internal server error") from exc
