import base64
from typing import Any

import httpx

TIMEOUT_S = 30.0


def _build_headers(auth_type: str | None, resolved_secret: str | None) -> dict[str, str]:
    headers = {"Content-Type": "application/json", "Accept": "application/json"}
    if not resolved_secret:
        return headers
    if auth_type == "bearer":
        headers["Authorization"] = f"Bearer {resolved_secret}"
    elif auth_type == "api_key":
        headers["X-API-Key"] = resolved_secret
    elif auth_type == "basic":
        encoded = base64.b64encode(resolved_secret.encode()).decode()
        headers["Authorization"] = f"Basic {encoded}"
    return headers


async def rest_executor(
    base_url: str,
    auth_type: str | None,
    resolved_secret: str | None,
    endpoint: str,
    method: str,
    params: dict[str, Any] | None = None,
    body: dict[str, Any] | None = None,
) -> dict[str, Any]:
    base = base_url.rstrip("/")
    path = endpoint if endpoint.startswith("/") else f"/{endpoint}"
    url = f"{base}{path}"

    headers = _build_headers(auth_type, resolved_secret)
    has_body = body is not None and method not in ("GET", "HEAD")

    try:
        async with httpx.AsyncClient(timeout=TIMEOUT_S) as client:
            resp = await client.request(
                method=method,
                url=url,
                headers=headers,
                params={k: str(v) for k, v in (params or {}).items()},
                json=body if has_body else None,
            )

        ct = resp.headers.get("content-type", "")
        try:
            data: Any = resp.json() if "application/json" in ct else resp.text
        except Exception:
            data = resp.text

        if not resp.is_success:
            detail = ""
            if isinstance(data, dict):
                detail = str(data.get("detail") or data.get("error") or data.get("message") or "")[:200]
            elif isinstance(data, str):
                detail = data[:200]
            error_msg = (
                f"Upstream returned {resp.status_code} {resp.reason_phrase} — {detail}"
                if detail
                else f"Upstream returned {resp.status_code} {resp.reason_phrase}"
            )
            return {"success": False, "error": error_msg, "data": data}

        return {"success": True, "data": data}

    except httpx.TimeoutException:
        return {"success": False, "error": "Request timed out after 30 seconds"}
    except Exception as exc:
        return {"success": False, "error": str(exc)}
