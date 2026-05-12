"""REST executor — port of `src/executors/restExecutor.ts`.

Uses the shared httpx.AsyncClient for outbound calls (no per-call client
construction overhead).
"""

from __future__ import annotations

import base64
from typing import Any
from urllib.parse import urlencode, urljoin

import httpx

from ..http_client import get_client

_TIMEOUT_S = 30.0


async def rest_executor(
    *,
    base_url: str,
    auth_type: str | None,
    resolved_secret: str | None,
    endpoint: str,
    method: str,
    params: dict[str, Any] | None = None,
    body: dict[str, Any] | None = None,
) -> dict[str, Any]:
    base = base_url.rstrip("/")
    path = endpoint if endpoint.startswith("/") else "/" + endpoint
    url = base + path
    if params:
        url = f"{url}?{urlencode({k: str(v) for k, v in params.items()})}"

    headers: dict[str, str] = {
        "Content-Type": "application/json",
        "Accept": "application/json",
    }
    if resolved_secret:
        if auth_type == "bearer":
            headers["Authorization"] = f"Bearer {resolved_secret}"
        elif auth_type == "api_key":
            headers["X-API-Key"] = resolved_secret
        elif auth_type == "basic":
            encoded = base64.b64encode(resolved_secret.encode("utf-8")).decode("ascii")
            headers["Authorization"] = f"Basic {encoded}"

    has_body = body is not None and method.upper() not in ("GET", "HEAD")
    client = get_client()

    try:
        response = await client.request(
            method.upper(),
            url,
            headers=headers,
            json=body if has_body else None,
            timeout=_TIMEOUT_S,
        )
    except httpx.TimeoutException:
        return {"success": False, "error": "Request timed out after 30 seconds"}
    except httpx.HTTPError as e:
        return {"success": False, "error": str(e)}

    ct = response.headers.get("content-type", "")
    if "application/json" in ct:
        try:
            data: Any = response.json()
        except Exception:
            data = response.text
    else:
        data = response.text

    if response.status_code >= 400:
        detail = ""
        if isinstance(data, dict):
            detail = str(data.get("detail") or data.get("error") or data.get("message") or "")[:200]
        elif isinstance(data, str):
            detail = data[:200]
        suffix = f" — {detail}" if detail else ""
        return {
            "success": False,
            "error": f"Upstream returned {response.status_code} {response.reason_phrase}{suffix}",
            "data": data,
        }

    return {"success": True, "data": data}
