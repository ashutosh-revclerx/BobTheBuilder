"""Execute route — port of `src/routes/execute.ts`.

Dispatches to the appropriate executor (REST / postgresql / agent) based on
the resource type. Also handles file uploads via /upload.
"""

from __future__ import annotations

import asyncio
import base64
import re
import time
from typing import Any, Literal

import asyncpg
import httpx
from fastapi import APIRouter, Header, Request, UploadFile
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field

from ..auth.nervesparks import AuthError, extract_bearer_token, verify_access_token
from ..db.pool import get_pool
from ..executors.agent import agent_executor
from ..executors.db import db_executor
from ..executors.rest import rest_executor
from ..http_client import get_client
from ..logger import create_logger
from ..utils.env_secret import resolve_env_secret

log = create_logger("execute")
router = APIRouter()

_MAX_UPLOAD_SIZE = 50 * 1024 * 1024  # 50 MB


class ExecuteSchema(BaseModel):
    queryName: str | None = None
    resource: str = Field(min_length=1)
    endpoint: str = Field(min_length=1)
    method: Literal["GET", "POST", "PUT", "PATCH", "DELETE"] = "GET"
    params: dict[str, Any] | None = None
    body: dict[str, Any] | None = None
    dashboardId: str | None = None
    pollUrlTemplate: str | None = None


def _template_matches(template: str | None, resolved: str) -> bool:
    if not template:
        return False
    if template == resolved:
        return True
    if "{" not in template:
        return False

    pattern = re.escape(template)
    pattern = re.sub(r"\\\{\\\{.*?\\\}\\\}", r".+", pattern)
    pattern = re.sub(r"\\\{[^{}]+\\\}", r"[^/]+", pattern)
    return bool(re.fullmatch(pattern, resolved))


def _query_is_allowed(config: Any, body: ExecuteSchema) -> bool:
    if not isinstance(config, dict):
        return False
    if body.queryName and body.queryName.endswith(":progress"):
        return _progress_query_is_allowed(config, body)

    queries = config.get("queries")
    if not isinstance(queries, list):
        return False

    for query in queries:
        if not isinstance(query, dict):
            continue
        if body.queryName and query.get("name") != body.queryName:
            continue
        if query.get("resource") != body.resource:
            continue
        configured_method = str(query.get("method") or "GET").upper()
        if configured_method != body.method.upper():
            continue
        if _template_matches(str(query.get("endpoint") or ""), body.endpoint):
            return True
    return False


def _progress_query_is_allowed(config: Any, body: ExecuteSchema) -> bool:
    if not isinstance(config, dict):
        return False
    component_id = (body.queryName or "").removesuffix(":progress")
    components = config.get("components")
    if not isinstance(components, list):
        return False

    for component in components:
        if not isinstance(component, dict):
            continue
        if component.get("id") != component_id or component.get("type") != "FileUpload":
            continue
        data = component.get("data")
        if not isinstance(data, dict):
            continue
        if data.get("resourceName") != body.resource:
            continue
        if _template_matches(str(data.get("progressEndpoint") or ""), body.endpoint):
            return True
    return False


def _upload_is_allowed(config: Any, *, resource_id: str, resource_name: str, endpoint_path: str) -> bool:
    if not isinstance(config, dict):
        return False
    components = config.get("components")
    if not isinstance(components, list):
        return False

    for component in components:
        if not isinstance(component, dict) or component.get("type") != "FileUpload":
            continue
        data = component.get("data")
        if not isinstance(data, dict):
            continue
        same_resource = (
            bool(resource_id and data.get("resourceId") == resource_id)
            or bool(resource_name and data.get("resourceName") == resource_name)
        )
        if same_resource and _template_matches(str(data.get("endpointPath") or ""), endpoint_path):
            return True
    return False


_UUID_RE_LOG = re.compile(
    r"^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$", re.IGNORECASE
)


async def _load_public_dashboard_config(dashboard_id: str | None, dashboard_token: str | None) -> Any | None:
    """Load the dashboard config if the given (id-or-slug, token) pair is valid.

    Accepts either the dashboard UUID or its slug — the frontend's customer
    view sometimes only has one or the other at call time.
    """
    if not dashboard_id or not dashboard_token:
        return None
    pool = get_pool()
    # Cast the candidate to text in SQL so asyncpg never tries to coerce a slug
    # into UUID. The `d.id::text = $1 OR d.slug = $1` branch handles both forms
    # without two round trips.
    try:
        row = await pool.fetchrow(
            """SELECT d.config
               FROM dashboards d
               WHERE (d.id::text = $1 OR d.slug = $1)
                 AND d.status = 'live'
                 AND EXISTS (
                   SELECT 1
                   FROM customers c
                   WHERE c.access_token = $2
                     AND (
                       c.dashboard_id = d.id
                       OR EXISTS (
                         SELECT 1
                         FROM dashboard_assignments da
                         WHERE da.customer_id = c.id
                           AND da.dashboard_id = d.id
                       )
                     )
                 )""",
            dashboard_id,
            dashboard_token,
        )
    except asyncpg.PostgresError as err:
        log.error("public dashboard auth lookup failed:", err)
        return None
    return row["config"] if row else None


async def _is_authorized(
    *,
    authorization: str | None,
    dashboard_id: str | None,
    dashboard_token: str | None,
    body: ExecuteSchema | None = None,
    upload_resource_id: str = "",
    upload_resource_name: str = "",
    upload_endpoint_path: str = "",
) -> bool:
    token = extract_bearer_token(authorization)
    if token:
        try:
            await verify_access_token(token, get_client())
            return True
        except AuthError:
            pass

    config = await _load_public_dashboard_config(dashboard_id, dashboard_token)
    if body is not None:
        return _query_is_allowed(config, body)
    return _upload_is_allowed(
        config,
        resource_id=upload_resource_id,
        resource_name=upload_resource_name,
        endpoint_path=upload_endpoint_path,
    )


async def _log_query(
    dashboard_id: str | None,
    resource_name: str,
    endpoint: str,
    status: str,
    duration_ms: int,
) -> None:
    """Fire-and-forget query log — never blocks the response.

    `dashboard_id` may be a slug when called from the customer-facing dashboard
    (frontend doesn't always have the UUID handy). The `query_logs.dashboard_id`
    column is UUID-typed, so we null it out unless it parses as a UUID — keeps
    the row but avoids polluting logs with DataError noise.
    """
    if dashboard_id and not _UUID_RE_LOG.match(dashboard_id):
        dashboard_id = None
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
async def execute(
    body: ExecuteSchema,
    authorization: str | None = Header(default=None),
    x_dashboard_token: str | None = Header(default=None, alias="x-dashboard-token"),
    x_btb_dashboard_id: str | None = Header(default=None, alias="x-btb-dashboard-id"),
):
    dashboard_id = body.dashboardId or x_btb_dashboard_id
    if not await _is_authorized(
        authorization=authorization,
        dashboard_id=dashboard_id,
        dashboard_token=x_dashboard_token,
        body=body,
    ):
        return JSONResponse(status_code=401, content={"success": False, "error": "Unauthorized"})

    start_ms = time.time()
    pool = get_pool()

    # 1. Look up resource — only place secret_ref is read
    try:
        resource = await pool.fetchrow(
            """SELECT id, name, type, base_url, auth_type, secret_ref, poll_url_template
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
                    # Query-level template wins; otherwise fall back to the
                    # template stored on the resource itself.
                    poll_url_template=body.pollUrlTemplate or resource["poll_url_template"],
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
        dashboard_id,
        body.resource,
        body.endpoint,
        "success" if result.get("success") else "error",
        duration_ms,
    )

    return result


@router.post("/upload")
async def upload_file(
    request: Request,
    authorization: str | None = Header(default=None),
    x_dashboard_token: str | None = Header(default=None, alias="x-dashboard-token"),
    x_btb_dashboard_id: str | None = Header(default=None, alias="x-btb-dashboard-id"),
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
        log.warn(
            f"upload 400 missing-headers: resource_id={bool(resource_id)} "
            f"resource_name={bool(resource_name)} endpoint_path={bool(endpoint_path)} "
            f"— configure the FileUpload component's Data panel"
        )
        return JSONResponse(
            status_code=400,
            content={
                "success": False,
                "error": (
                    "Missing x-btb-resource-id or x-btb-resource-name, "
                    "or missing x-btb-endpoint-path header. "
                    "Open the FileUpload in the builder → Data tab → "
                    "select Resource and Upload endpoint."
                ),
            },
        )

    if not await _is_authorized(
        authorization=authorization,
        dashboard_id=x_btb_dashboard_id,
        dashboard_token=x_dashboard_token,
        upload_resource_id=resource_id,
        upload_resource_name=resource_name,
        upload_endpoint_path=endpoint_path,
    ):
        return JSONResponse(status_code=401, content={"success": False, "error": "Unauthorized"})

    try:
        form = await request.form()
    except Exception as parse_err:
        log.error(f"upload form parse failed: {parse_err}")
        return JSONResponse(
            status_code=400,
            content={
                "success": False,
                "error": f"Could not parse multipart body: {parse_err}",
            },
        )

    # Duck-typed file detection. `form.multi_items()` returns Starlette's
    # `starlette.datastructures.UploadFile`, but `fastapi.UploadFile` is a
    # different subclass — isinstance would silently miss every file.
    files: list[UploadFile] = []
    body_fields: dict[str, str] = {}
    for k, v in form.multi_items():
        if hasattr(v, "filename") and hasattr(v, "read"):
            files.append(v)  # type: ignore[arg-type]
        elif isinstance(v, str):
            body_fields[k] = v

    if not files:
        # Diagnostic: surface what actually arrived so the cause is obvious in
        # the next failed upload. Most common: Content-Type isn't multipart
        # (form-data), browser sent an empty body, or nginx truncated it.
        keys_seen = list(form.keys())
        types_seen = [type(v).__name__ for _, v in form.multi_items()]
        ct = request.headers.get("content-type", "<none>")
        cl = request.headers.get("content-length", "<none>")
        log.warn(
            f"upload 400 no-files: content_type={ct!r} content_length={cl} "
            f"form_keys={keys_seen} value_types={types_seen} expected_field_name={field_name!r}"
        )
        return JSONResponse(
            status_code=400,
            content={
                "success": False,
                "error": "No files in request",
                "debug": {
                    "content_type": ct,
                    "content_length": cl,
                    "form_keys": keys_seen,
                    "expected_field_name": field_name,
                },
            },
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

    # Allow REST + agent uploads. Both are single-POST multipart at the upload
    # itself; agent endpoints typically return a jobId synchronously and the
    # FileUpload component polls a separate progressEndpoint via /execute.
    if resource["type"] not in ("REST", "agent") or not resource["base_url"]:
        return JSONResponse(
            status_code=400,
            content={
                "success": False,
                "error": "Upload is only supported for REST and agent resources with a base_url",
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
