"""Resources route — port of `src/routes/resources.ts`.

Endpoints (mounted under /api/v1/resources):
  POST   /                  create resource
  GET    /                  list
  POST   /import-swagger    bulk import endpoints from a Swagger/OpenAPI URL
  GET    /:id/schema        DB schema introspection (postgresql resources)
  POST   /:id/preview       preview SQL query (max 5 rows)
  GET    /:id/endpoints     list imported endpoints
  GET    /:id               read one
  PUT    /:id               update
  DELETE /:id               delete
"""

from __future__ import annotations

import json
from typing import Any, Literal
from urllib.parse import urlparse, urlunparse

import asyncpg
import httpx
from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import JSONResponse, Response
from pydantic import BaseModel, Field, field_validator, model_validator

from ..auth.deps import require_auth
from ..db.pool import get_pool
from ..http_client import get_client
from ..logger import create_logger
from ..utils.swagger_parser import parse_swagger_doc
from ._helpers import (
    PG_INVALID_UUID,
    PG_UNIQUE_VIOLATION,
    pg_code,
    row_to_dict,
    rows_to_list,
)

log = create_logger("resources")
router = APIRouter(dependencies=[Depends(require_auth)])

_TYPES = ("REST", "postgresql", "agent")
_AUTH_TYPES = ("none", "bearer", "api_key", "basic")

_SAFE_COLS = (
    "id, name, type, base_url, auth_type, poll_url_template, "
    "(secret_ref IS NOT NULL) AS has_secret, created_at"
)

_COMMON_SPEC_PATHS = (
    "/openapi.json",
    "/swagger.json",
    "/v3/api-docs",
    "/api-docs",
    "/swagger/v1/swagger.json",
)


def _error(status_code: int, message: str, **extra: Any) -> JSONResponse:
    return JSONResponse(status_code=status_code, content={"error": message, **extra})


def _localhost_variants(url: str) -> list[str]:
    parsed = urlparse(url)
    if parsed.hostname not in {"localhost", "127.0.0.1"}:
        return []
    netloc = parsed.netloc.replace(parsed.hostname, "host.docker.internal", 1)
    return [urlunparse(parsed._replace(netloc=netloc))]


def _spec_candidates(swagger_url: str) -> list[str]:
    parsed = urlparse(swagger_url)
    candidates = [swagger_url, *_localhost_variants(swagger_url)]
    if parsed.scheme and parsed.netloc:
        origin = f"{parsed.scheme}://{parsed.netloc}"
        for path in _COMMON_SPEC_PATHS:
            candidates.append(origin + path)
        if parsed.path:
            parent = parsed.path.rstrip("/").rsplit("/", 1)[0]
            for name in ("openapi.json", "swagger.json", "v3/api-docs", "api-docs"):
                candidates.append(origin + (parent + "/" + name if parent else "/" + name))

    seen: set[str] = set()
    unique: list[str] = []
    for candidate in candidates:
        if candidate not in seen:
            seen.add(candidate)
            unique.append(candidate)
    return unique


def _unwrap_swagger_doc(doc: Any) -> Any:
    if not isinstance(doc, dict):
        return doc
    if isinstance(doc.get("paths"), dict):
        return doc
    for key in ("data", "result", "spec", "openapi", "swagger"):
        nested = doc.get(key)
        if isinstance(nested, dict):
            unwrapped = _unwrap_swagger_doc(nested)
            if isinstance(unwrapped, dict) and isinstance(unwrapped.get("paths"), dict):
                return unwrapped
    return doc


async def _fetch_swagger_doc(
    client: httpx.AsyncClient, swagger_url: str
) -> tuple[Any | None, str | None]:
    last_error: str | None = None
    for url in _spec_candidates(swagger_url):
        try:
            response = await client.get(
                url,
                timeout=30.0,
                follow_redirects=True,
                headers={"Accept": "application/json, text/yaml, */*"},
            )
        except httpx.HTTPError as exc:
            last_error = f"Could not fetch Swagger docs from {url}: {exc}"
            continue

        if response.status_code >= 400:
            last_error = f"Swagger docs returned {response.status_code} from {url}"
            continue

        try:
            return _unwrap_swagger_doc(response.json()), None
        except Exception:
            last_error = f"Fetched {url}, but the response was not JSON"
            continue

    return None, last_error or "Could not fetch Swagger docs"


# ─── Pydantic schemas ────────────────────────────────────────────────────────


class ImportSwaggerSchema(BaseModel):
    swaggerUrl: str
    resourceName: str = Field(min_length=1)
    baseUrl: str
    authType: Literal["none", "bearer", "api_key", "basic"] = "none"
    secretRef: str | None = None
    resourceType: Literal["REST", "agent"] = "REST"
    pollUrlTemplate: str | None = None


class CreateSchema(BaseModel):
    name: str = Field(min_length=1)
    type: Literal["REST", "postgresql", "agent"]
    base_url: str | None = None
    auth_type: Literal["none", "bearer", "api_key", "basic"] = "none"
    secret_ref: str | None = None
    poll_url_template: str | None = None

    @model_validator(mode="after")
    def _check_base_url(self):
        if self.type in ("REST", "agent") and not self.base_url:
            raise ValueError("base_url is required for REST and agent resource types")
        return self


class UpdateSchema(BaseModel):
    name: str | None = Field(default=None, min_length=1)
    type: Literal["REST", "postgresql", "agent"] | None = None
    base_url: str | None = None
    auth_type: Literal["none", "bearer", "api_key", "basic"] | None = None
    secret_ref: str | None = None
    poll_url_template: str | None = None

    @model_validator(mode="after")
    def _check_base_url(self):
        if self.type in ("REST", "agent") and self.base_url is not None and not self.base_url:
            raise ValueError("base_url cannot be empty for REST/agent types")
        return self


# ─── Routes ──────────────────────────────────────────────────────────────────


@router.post("")
@router.post("/")
async def create_resource(body: CreateSchema):
    pool = get_pool()
    try:
        row = await pool.fetchrow(
            f"""INSERT INTO resources (name, type, base_url, auth_type, secret_ref, poll_url_template)
                VALUES ($1, $2, $3, $4, $5, $6)
                RETURNING {_SAFE_COLS}""",
            body.name,
            body.type,
            body.base_url,
            body.auth_type,
            body.secret_ref,
            body.poll_url_template,
        )
        return JSONResponse(status_code=201, content=row_to_dict(row))
    except asyncpg.PostgresError as err:
        if pg_code(err) == PG_UNIQUE_VIOLATION:
            return JSONResponse(
                status_code=409,
                content={"error": f'Resource name "{body.name}" is already taken'},
            )
        log.error("create:", err)
        raise HTTPException(status_code=500, detail="Internal server error")


@router.get("")
@router.get("/")
async def list_resources():
    pool = get_pool()
    try:
        rows = await pool.fetch(
            f"SELECT {_SAFE_COLS} FROM resources ORDER BY name ASC"
        )
        return rows_to_list(rows)
    except asyncpg.PostgresError as err:
        log.error("list:", err)
        raise HTTPException(status_code=500, detail="Internal server error")


@router.post("/import-swagger")
async def import_swagger(body: ImportSwaggerSchema):
    client = get_client()
    doc, fetch_error = await _fetch_swagger_doc(client, body.swaggerUrl)
    if doc is None:
        log.warn(f"import-swagger fetch failed url={body.swaggerUrl} error={fetch_error}")
        return _error(400, fetch_error or "Could not fetch Swagger docs")

    endpoints = parse_swagger_doc(doc)
    if not endpoints:
        log.warn(f"import-swagger no endpoints url={body.swaggerUrl}")
        return _error(
            400,
            "No endpoints found in docs",
            hint="Use the raw OpenAPI/Swagger JSON URL, not the Swagger UI HTML page.",
        )

    pool = get_pool()
    async with pool.acquire() as conn:
        try:
            async with conn.transaction():
                resource_row = await conn.fetchrow(
                    """INSERT INTO resources
                         (name, type, base_url, auth_type, secret_ref, poll_url_template)
                       VALUES ($1, $2, $3, $4, $5, $6)
                       ON CONFLICT (name) DO UPDATE
                         SET type              = EXCLUDED.type,
                             base_url          = EXCLUDED.base_url,
                             auth_type         = EXCLUDED.auth_type,
                             secret_ref        = EXCLUDED.secret_ref,
                             poll_url_template = EXCLUDED.poll_url_template
                       RETURNING id, name""",
                    body.resourceName,
                    body.resourceType,
                    body.baseUrl,
                    body.authType,
                    body.secretRef,
                    body.pollUrlTemplate,
                )
                resource_id = resource_row["id"]

                await conn.execute(
                    "DELETE FROM resource_endpoints WHERE resource_id = $1",
                    resource_id,
                )

                if endpoints:
                    rows = [
                        (
                            resource_id,
                            ep["method"],
                            ep["path"],
                            ep["summary"],
                            json.dumps(ep["parameters"]),
                            json.dumps(ep["requestBody"]),
                        )
                        for ep in endpoints
                    ]
                    await conn.executemany(
                        """INSERT INTO resource_endpoints
                             (resource_id, method, path, summary, parameters, request_body)
                           VALUES ($1, $2, $3, $4, $5::jsonb, $6::jsonb)""",
                        rows,
                    )

            return {
                "success": True,
                "resource": {"id": str(resource_row["id"]), "name": resource_row["name"]},
                "endpointsImported": len(endpoints),
            }
        except asyncpg.PostgresError as err:
            log.error("import-swagger:", err)
            return _error(500, "Internal server error")


@router.get("/{resource_id}/schema")
async def get_resource_schema(resource_id: str):
    pool = get_pool()
    try:
        resource_row = await pool.fetchrow(
            f"SELECT {_SAFE_COLS} FROM resources WHERE id = $1", resource_id
        )
    except asyncpg.PostgresError as err:
        if pg_code(err) == PG_INVALID_UUID:
            raise HTTPException(status_code=400, detail="Invalid resource ID")
        log.error("schema:", err)
        raise HTTPException(status_code=500, detail="Internal server error")
    if not resource_row:
        raise HTTPException(status_code=404, detail="Resource not found")
    if resource_row["type"] != "postgresql":
        raise HTTPException(
            status_code=400, detail="Schema introspection only supports PostgreSQL"
        )

    try:
        table_rows = await pool.fetch(
            """SELECT table_name FROM information_schema.tables
               WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
               ORDER BY table_name ASC"""
        )
        tables: list[dict[str, Any]] = []
        for t in table_rows:
            col_rows = await pool.fetch(
                """SELECT column_name, data_type FROM information_schema.columns
                   WHERE table_name = $1 AND table_schema = 'public'
                   ORDER BY ordinal_position ASC""",
                t["table_name"],
            )
            tables.append(
                {
                    "name": t["table_name"],
                    "columns": [
                        {"name": c["column_name"], "type": c["data_type"]} for c in col_rows
                    ],
                }
            )
        return {"tables": tables}
    except asyncpg.PostgresError as err:
        log.error("schema:", err)
        raise HTTPException(status_code=500, detail="Internal server error")


@router.post("/{resource_id}/preview")
async def preview_query(resource_id: str, request: Request):
    from ..utils.env_secret import resolve_env_secret

    pool = get_pool()
    try:
        # Fetch the *full* row (including secret_ref) so we can connect to the
        # resource's own database, not the internal dashboard DB.
        resource_row = await pool.fetchrow(
            "SELECT id, name, type, base_url, auth_type, secret_ref FROM resources WHERE id = $1",
            resource_id,
        )
    except asyncpg.PostgresError as err:
        if pg_code(err) == PG_INVALID_UUID:
            raise HTTPException(status_code=400, detail="Invalid resource ID")
        log.error("preview:", err)
        return JSONResponse(
            status_code=500, content={"error": "Internal server error"}
        )
    if not resource_row:
        raise HTTPException(status_code=404, detail="Resource not found")
    if resource_row["type"] != "postgresql":
        raise HTTPException(status_code=400, detail="Preview is only supported for PostgreSQL resources")

    connection_string = resolve_env_secret(resource_row["secret_ref"])
    if not connection_string:
        return JSONResponse(
            status_code=400,
            content={
                "error": "No connection string resolved for this resource — check secret_ref and the corresponding env variable"
            },
        )

    try:
        payload = await request.json()
    except Exception:
        payload = {}
    sql = payload.get("sql", "").strip()
    params: list[Any] = payload.get("params") or []
    if not sql:
        raise HTTPException(status_code=400, detail="sql is required")

    # Run against the *resource's* external database in a read-only transaction,
    # capped at 5 rows (same as the Node implementation).
    try:
        conn = await asyncpg.connect(dsn=connection_string)
    except Exception as err:
        return JSONResponse(
            status_code=400,
            content={"error": f"Could not connect to resource database: {err}"},
        )

    try:
        async with conn.transaction(readonly=True):
            rows = await conn.fetch(sql + " LIMIT 5", *params)
            return {"rows": [dict(r) for r in rows]}
    except Exception as err:
        log.error("preview query failed:", err)
        return JSONResponse(
            status_code=400, content={"error": "Query failed", "details": str(err)}
        )
    finally:
        await conn.close()


@router.get("/{resource_id}/endpoints")
async def list_endpoints(resource_id: str):
    pool = get_pool()
    try:
        rows = await pool.fetch(
            """SELECT id, method, path, summary, parameters
               FROM resource_endpoints
               WHERE resource_id = $1
               ORDER BY path ASC, method ASC""",
            resource_id,
        )
        return rows_to_list(rows)
    except asyncpg.PostgresError as err:
        if pg_code(err) == PG_INVALID_UUID:
            raise HTTPException(status_code=400, detail="Invalid resource ID")
        log.error("endpoints:", err)
        raise HTTPException(status_code=500, detail="Internal server error")


@router.get("/{resource_id}")
async def get_resource(resource_id: str):
    pool = get_pool()
    try:
        row = await pool.fetchrow(
            f"SELECT {_SAFE_COLS} FROM resources WHERE id = $1", resource_id
        )
    except asyncpg.PostgresError as err:
        if pg_code(err) == PG_INVALID_UUID:
            raise HTTPException(status_code=400, detail="Invalid resource ID")
        log.error("get:", err)
        raise HTTPException(status_code=500, detail="Internal server error")
    if not row:
        raise HTTPException(status_code=404, detail="Resource not found")
    return row_to_dict(row)


@router.put("/{resource_id}")
async def update_resource(resource_id: str, body: UpdateSchema):
    data = body.model_dump(exclude_unset=True)
    if not data:
        raise HTTPException(status_code=400, detail="No fields provided to update")

    set_clauses: list[str] = []
    values: list[Any] = []
    i = 1
    for k in ("name", "type", "base_url", "auth_type", "secret_ref", "poll_url_template"):
        if k in data:
            set_clauses.append(f"{k} = ${i}")
            values.append(data[k])
            i += 1
    values.append(resource_id)

    pool = get_pool()
    try:
        row = await pool.fetchrow(
            f"""UPDATE resources
                SET {', '.join(set_clauses)}
                WHERE id = ${i}
                RETURNING {_SAFE_COLS}""",
            *values,
        )
    except asyncpg.PostgresError as err:
        code = pg_code(err)
        if code == PG_UNIQUE_VIOLATION:
            raise HTTPException(status_code=409, detail="Resource name is already taken")
        if code == PG_INVALID_UUID:
            raise HTTPException(status_code=400, detail="Invalid resource ID")
        log.error("update:", err)
        raise HTTPException(status_code=500, detail="Internal server error")
    if not row:
        raise HTTPException(status_code=404, detail="Resource not found")
    return row_to_dict(row)


@router.delete("/{resource_id}")
async def delete_resource(resource_id: str):
    pool = get_pool()
    try:
        result = await pool.execute(
            "DELETE FROM resources WHERE id = $1", resource_id
        )
        # asyncpg returns "DELETE N" on success
        affected = int(result.split()[-1]) if result and result.startswith("DELETE") else 0
        if not affected:
            raise HTTPException(status_code=404, detail="Resource not found")
        return Response(status_code=204)
    except asyncpg.PostgresError as err:
        if pg_code(err) == PG_INVALID_UUID:
            raise HTTPException(status_code=400, detail="Invalid resource ID")
        log.error("delete:", err)
        raise HTTPException(status_code=500, detail="Internal server error")
