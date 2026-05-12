"""Execute route — port of `src/routes/execute.ts`.

Dispatches to the appropriate executor (REST / postgresql / agent) based on
the resource type. Also handles file uploads via /upload.
"""

from __future__ import annotations

import asyncio
import base64
import time
from typing import Any, Literal

import asyncpg
import httpx
from fastapi import APIRouter, Depends, File, Form, HTTPException, Header, Request, UploadFile
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field

from ..auth.deps import require_auth
from ..db.pool import get_pool
from ..executors.agent import agent_executor
from ..executors.db import db_executor
from ..executors.rest import rest_executor
from ..http_client import get_client
from ..logger import create_logger
from ..utils.env_secret import resolve_env_secret

log = create_logger("execute")
router = APIRouter(dependencies=[Depends(require_auth)])

_MAX_UPLOAD_SIZE = 50 * 1024 * 1024  # 50 MB


class ExecuteSchema(BaseModel):
    resource: str = Field(min_length=1)
    endpoint: str = Field(min_length=1)
    method: Literal["GET", "POST", "PUT", "PATCH", "DELETE"] = "GET"
    params: dict[str, Any] | None = None
    body: dict[str, Any] | None = None
    dashboardId: str | None = None
    pollUrlTemplate: str | None = None


async def _log_query(
    dashboard_id: str | None,
    resource_name: str,
    endpoint: str,
    status: str,
    duration_ms: int,
) -> None:
    """Fire-and-forget query log — never blocks the response."""
    try:
        pool = get_pool()
        await pool.execute(
            """INSERT INTO query_logs (dashboard_id, resource_name, endpoint, status, duration_ms)
               VALUES ($1, $2, $3, $4, $5)""",
            dashboard_id,
            resource_name,
            endpoint,
            status,
            duration_ms,
        )
    except Exception as err:
        log.error("query_log insert failed:", err)


def _schedule_log_query(
    dashboard_id: str | None,
    resource_name: str,
    endpoint: str,
    status: str,
    duration_ms: int,
) -> None:
    asyncio.create_task(
        _log_query(dashboard_id, resource_name, endpoint, status, duration_ms)
    )


@router.post("")
@router.post("/")
async def execute(body: ExecuteSchema):
    start_ms = time.time()
    pool = get_pool()

    # 1. Look up resource — only place secret_ref is read
    try:
        resource = await pool.fetchrow(
            """SELECT id, name, type, base_url, auth_type, secret_ref
               FROM resources
               WHERE name = $1""",
            body.resource,
        )
    except asyncpg.PostgresError as err:
        log.error("resource lookup failed:", err)
        return JSONResponse(
            status_code=500, content={"success": False, "error": "Internal server error"}
        )

    if not resource:
        return JSONResponse(
            status_code=404,
            content={"success": False, "error": f'Resource "{body.resource}" not found'},
        )

    # 2. Resolve secret placeholder → real env value
    resolved_secret = resolve_env_secret(resource["secret_ref"])

    # 3. Dispatch
    result: dict[str, Any]
    try:
        if resource["type"] == "REST":
            if not resource["base_url"]:
                result = {
                    "success": False,
                    "error": f'Resource "{body.resource}" has no base_url configured',
                }
            else:
                result = await rest_executor(
                    base_url=resource["base_url"],
                    auth_type=resource["auth_type"],
                    resolved_secret=resolved_secret,
                    endpoint=body.endpoint,
                    method=body.method,
                    params=body.params,
                    body=body.body,
                )
        elif resource["type"] == "agent":
            if not resource["base_url"]:
                result = {
                    "success": False,
                    "error": f'Resource "{body.resource}" has no base_url configured',
                }
            else:
                result = await agent_executor(
                    base_url=resource["base_url"],
                    auth_type=resource["auth_type"],
                    resolved_secret=resolved_secret,
                    endpoint=body.endpoint,
                    params=body.params,
                    body=body.body,
                    poll_url_template=body.pollUrlTemplate,
                )
        elif resource["type"] == "postgresql":
            sql_params: list[Any] = []
            if body.params:
                # Positional params: { "1": "val1", "2": "val2" } → ["val1", "val2"]
                sorted_keys = sorted(body.params.keys(), key=lambda k: int(k))
                sql_params = [body.params[k] for k in sorted_keys]
            result = await db_executor(
                connection_string=resolved_secret or "",
                query=body.endpoint,
                params=sql_params,
            )
        else:
            result = {"success": False, "error": f"Unsupported resource type: {resource['type']}"}
    except Exception as err:
        result = {"success": False, "error": str(err)}

    duration_ms = int((time.time() - start_ms) * 1000)
    _schedule_log_query(
        body.dashboardId,
        body.resource,
        body.endpoint,
        "success" if result.get("success") else "error",
        duration_ms,
    )

    return result


@router.post("/upload")
async def upload_file(
    request: Request,
    x_btb_resource_id: str | None = Header(default=None, alias="x-btb-resource-id"),
    x_btb_resource_name: str | None = Header(default=None, alias="x-btb-resource-name"),
    x_btb_endpoint_path: str | None = Header(default=None, alias="x-btb-endpoint-path"),
    x_btb_field_name: str | None = Header(default="file", alias="x-btb-field-name"),
):
    resource_id = (x_btb_resource_id or "").strip()
    resource_name = (x_btb_resource_name or "").strip()
    endpoint_path = (x_btb_endpoint_path or "").strip()
    field_name = (x_btb_field_name or "file").strip() or "file"

    if (not resource_id and not resource_name) or not endpoint_path:
        return JSONResponse(
            status_code=400,
            content={
                "success": False,
                "error": (
                    "Missing x-btb-resource-id or x-btb-resource-name, "
                    "or missing x-btb-endpoint-path header"
                ),
            },
        )

    form = await request.form()
    files: list[UploadFile] = []
    body_fields: dict[str, str] = {}
    for k, v in form.multi_items():
        if isinstance(v, UploadFile):
            files.append(v)
        elif isinstance(v, str):
            body_fields[k] = v

    if not files:
        return JSONResponse(
            status_code=400, content={"success": False, "error": "No files in request"}
        )

    # Enforce 50 MB cap (matches Node multer limit)
    for f in files:
        content = await f.read()
        if len(content) > _MAX_UPLOAD_SIZE:
            return JSONResponse(
                status_code=413,
                content={"success": False, "error": "File exceeds 50 MB limit"},
            )
        # Re-seed the file's buffer so we can read again below
        await f.seek(0)

    pool = get_pool()
    try:
        if resource_id:
            resource = await pool.fetchrow(
                """SELECT id, name, type, base_url, auth_type, secret_ref
                   FROM resources WHERE id = $1""",
                resource_id,
            )
            lookup_label = f"id: {resource_id}"
        else:
            resource = await pool.fetchrow(
                """SELECT id, name, type, base_url, auth_type, secret_ref
                   FROM resources WHERE name = $1""",
                resource_name,
            )
            lookup_label = f"name: {resource_name}"
    except asyncpg.PostgresError as err:
        log.error("upload resource lookup failed:", err)
        return JSONResponse(
            status_code=500, content={"success": False, "error": "Internal server error"}
        )

    if not resource:
        return JSONResponse(
            status_code=404,
            content={
                "success": False,
                "error": f"Resource not found (looked up by {lookup_label})",
            },
        )

    if resource["type"] != "REST" or not resource["base_url"]:
        return JSONResponse(
            status_code=400,
            content={
                "success": False,
                "error": "Upload is only supported for REST resources with a base_url",
            },
        )

    resolved_secret = resolve_env_secret(resource["secret_ref"])

    # Build multipart form
    files_payload: list[tuple[str, tuple[str | None, bytes, str | None]]] = []
    for f in files:
        content = await f.read()
        files_payload.append(
            (
                f.filename and field_name or field_name,  # field name
                (f.filename, content, f.content_type or "application/octet-stream"),
            )
        )

    headers: dict[str, str] = {}
    if resource["auth_type"] == "bearer" and resolved_secret:
        headers["Authorization"] = f"Bearer {resolved_secret}"
    elif resource["auth_type"] == "api_key" and resolved_secret:
        headers["X-API-Key"] = resolved_secret
    elif resource["auth_type"] == "basic" and resolved_secret:
        headers["Authorization"] = "Basic " + base64.b64encode(
            resolved_secret.encode("utf-8")
        ).decode("ascii")

    url = resource["base_url"].rstrip("/")
    url += endpoint_path if endpoint_path.startswith("/") else f"/{endpoint_path}"
    start_ms = time.time()
    client = get_client()

    try:
        upstream = await client.post(
            url, headers=headers, files=files_payload, data=body_fields, timeout=120.0
        )
        text = upstream.text
        try:
            payload: Any = upstream.json()
        except Exception:
            payload = text

        duration_ms = int((time.time() - start_ms) * 1000)
        _schedule_log_query(
            None,
            resource["name"],
            endpoint_path,
            "success" if upstream.status_code < 400 else "error",
            duration_ms,
        )

        if upstream.status_code >= 400:
            return JSONResponse(
                status_code=upstream.status_code,
                content={"success": False, "error": payload},
            )
        return {"success": True, "data": payload}
    except httpx.HTTPError as err:
        log.error("upload proxy failed:", err)
        duration_ms = int((time.time() - start_ms) * 1000)
        _schedule_log_query(None, resource["name"], endpoint_path, "error", duration_ms)
        return JSONResponse(
            status_code=502, content={"success": False, "error": str(err)}
        )
