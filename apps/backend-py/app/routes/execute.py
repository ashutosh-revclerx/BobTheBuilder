import asyncio
import base64
import os
import re
import time
from typing import Any

import asyncpg
import httpx
from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel

from app.db.client import get_pool
from app.executors.agent_executor import agent_executor
from app.executors.db_executor import db_executor
from app.executors.rest_executor import rest_executor
from app.middleware.auth import require_auth

router = APIRouter()


def _resolve_env_secret(secret_ref: str | None) -> str | None:
    if not secret_ref:
        return None
    match = re.fullmatch(r"\{\{env\.([A-Z0-9_]+)\}\}", secret_ref, re.IGNORECASE)
    if not match:
        return secret_ref
    return os.environ.get(match.group(1))


def _log_query(
    pool: asyncpg.Pool,
    dashboard_id: str | None,
    resource_name: str,
    endpoint: str,
    status: str,
    duration_ms: int,
) -> None:
    asyncio.create_task(
        pool.execute(
            """INSERT INTO query_logs (dashboard_id, resource_name, endpoint, status, duration_ms)
               VALUES ($1, $2, $3, $4, $5)""",
            dashboard_id,
            resource_name,
            endpoint,
            status,
            duration_ms,
        )
    )


class ExecuteBody(BaseModel):
    resource: str
    endpoint: str
    method: str = "GET"
    params: dict[str, Any] | None = None
    body: dict[str, Any] | None = None
    dashboardId: str | None = None
    pollUrlTemplate: str | None = None


@router.post("", dependencies=[Depends(require_auth)])
async def execute(body: ExecuteBody, pool: asyncpg.Pool = Depends(get_pool)):
    if body.method not in ("GET", "POST", "PUT", "PATCH", "DELETE"):
        raise HTTPException(status_code=400, detail="Invalid method")

    start_ms = int(time.time() * 1000)

    try:
        row = await pool.fetchrow(
            "SELECT id, name, type, base_url, auth_type, secret_ref FROM resources WHERE name = $1",
            body.resource,
        )
    except Exception as exc:
        raise HTTPException(status_code=500, detail="Internal server error") from exc

    if not row:
        raise HTTPException(status_code=404, detail=f'Resource "{body.resource}" not found')

    resolved_secret = _resolve_env_secret(row["secret_ref"])
    result: dict[str, Any]
    resource_type = row["type"]

    if resource_type == "REST":
        if not row["base_url"]:
            result = {"success": False, "error": f'Resource "{body.resource}" has no base_url configured'}
        else:
            result = await rest_executor(
                base_url=row["base_url"],
                auth_type=row["auth_type"],
                resolved_secret=resolved_secret,
                endpoint=body.endpoint,
                method=body.method,
                params=body.params,
                body=body.body,
            )

    elif resource_type == "agent":
        if not row["base_url"]:
            result = {"success": False, "error": f'Resource "{body.resource}" has no base_url configured'}
        else:
            result = await agent_executor(
                base_url=row["base_url"],
                auth_type=row["auth_type"],
                resolved_secret=resolved_secret,
                endpoint=body.endpoint,
                params=body.params,
                body=body.body,
                poll_url_template=body.pollUrlTemplate,
            )

    elif resource_type == "postgresql":
        sql_params: list[Any] = []
        if body.params:
            sql_params = [body.params[k] for k in sorted(body.params.keys(), key=int)]
        result = await db_executor(
            connection_string=resolved_secret or "",
            query=body.endpoint,
            params=sql_params,
        )
    else:
        result = {"success": False, "error": f"Unsupported resource type: {resource_type}"}

    duration_ms = int(time.time() * 1000) - start_ms
    _log_query(
        pool,
        body.dashboardId,
        body.resource,
        body.endpoint,
        "success" if result.get("success") else "error",
        duration_ms,
    )

    return result


@router.post("/upload", dependencies=[Depends(require_auth)])
async def upload(request: Request, pool: asyncpg.Pool = Depends(get_pool)):
    resource_id = request.headers.get("x-btb-resource-id", "").strip()
    resource_name = request.headers.get("x-btb-resource-name", "").strip()
    endpoint_path = request.headers.get("x-btb-endpoint-path", "").strip()
    field_name = request.headers.get("x-btb-field-name", "file").strip() or "file"

    if (not resource_id and not resource_name) or not endpoint_path:
        raise HTTPException(
            status_code=400,
            detail="Missing x-btb-resource-id or x-btb-resource-name, or missing x-btb-endpoint-path header",
        )

    form = await request.form()

    # Collect file objects and read their bytes eagerly
    file_parts: list[tuple[str, bytes, str]] = []
    for key, val in form.multi_items():
        if hasattr(val, "read"):
            content = await val.read()
            filename = getattr(val, "filename", None) or key
            content_type = getattr(val, "content_type", None) or "application/octet-stream"
            file_parts.append((filename, content, content_type))

    if not file_parts:
        raise HTTPException(status_code=400, detail="No files in request")

    if resource_id:
        row = await pool.fetchrow(
            "SELECT id, name, type, base_url, auth_type, secret_ref FROM resources WHERE id = $1::uuid",
            resource_id,
        )
    else:
        row = await pool.fetchrow(
            "SELECT id, name, type, base_url, auth_type, secret_ref FROM resources WHERE name = $1",
            resource_name,
        )

    if not row:
        label = f"id: {resource_id}" if resource_id else f"name: {resource_name}"
        raise HTTPException(status_code=404, detail=f"Resource not found (looked up by {label})")

    if row["type"] != "REST" or not row["base_url"]:
        raise HTTPException(status_code=400, detail="Upload is only supported for REST resources with a base_url")

    resolved_secret = _resolve_env_secret(row["secret_ref"])

    headers: dict[str, str] = {}
    if row["auth_type"] == "bearer" and resolved_secret:
        headers["Authorization"] = f"Bearer {resolved_secret}"
    elif row["auth_type"] == "api_key" and resolved_secret:
        headers["X-API-Key"] = resolved_secret
    elif row["auth_type"] == "basic" and resolved_secret:
        encoded = base64.b64encode(resolved_secret.encode()).decode()
        headers["Authorization"] = f"Basic {encoded}"

    url = row["base_url"].rstrip("/") + (
        endpoint_path if endpoint_path.startswith("/") else f"/{endpoint_path}"
    )

    # Forward non-file form fields
    data_fields = {
        k: v for k, v in form.multi_items()
        if isinstance(v, str)
    }

    httpx_files = [(field_name, (filename, content, ct)) for filename, content, ct in file_parts]

    start_ms = int(time.time() * 1000)
    try:
        async with httpx.AsyncClient(timeout=60) as client:
            resp = await client.post(url, headers=headers, files=httpx_files, data=data_fields)
    except Exception as exc:
        raise HTTPException(status_code=502, detail=str(exc))

    try:
        payload: Any = resp.json()
    except Exception:
        payload = resp.text

    if not resp.is_success:
        raise HTTPException(status_code=resp.status_code, detail=payload)

    return {"success": True, "data": payload}
