import asyncio
import base64
import logging
from typing import Any

import httpx

log = logging.getLogger("agentExec")

POLL_INTERVAL_S = 2.0
MAX_TOTAL_S = 60.0
MAX_POLL_ATTEMPTS = 30


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


def _extract_detail(body: Any) -> str:
    if isinstance(body, dict):
        return str(body.get("detail") or body.get("error") or body.get("message") or "")[:200]
    if isinstance(body, str):
        return body[:200]
    return ""


async def agent_executor(
    base_url: str,
    auth_type: str | None,
    resolved_secret: str | None,
    endpoint: str,
    params: dict[str, Any] | None = None,
    body: dict[str, Any] | None = None,
    poll_url_template: str | None = None,
) -> dict[str, Any]:
    base = base_url.rstrip("/")
    path = endpoint if endpoint.startswith("/") else f"/{endpoint}"
    kick_url = f"{base}{path}"

    headers = _build_headers(auth_type, resolved_secret)

    async with httpx.AsyncClient(timeout=30.0) as client:
        # 1. Kick off the job
        log.info("kickoff → %s", kick_url)
        try:
            resp = await client.post(
                kick_url,
                headers=headers,
                params={k: str(v) for k, v in (params or {}).items()},
                json=body or {},
            )
        except Exception as exc:
            return {"success": False, "error": f"Agent kickoff failed ({kick_url}): {exc}"}

        if not resp.is_success:
            try:
                raw = resp.json()
            except Exception:
                raw = resp.text
            detail = _extract_detail(raw)
            msg = (
                f"Agent kickoff returned {resp.status_code} {resp.reason_phrase} — {detail}"
                if detail
                else f"Agent kickoff returned {resp.status_code} {resp.reason_phrase}"
            )
            return {"success": False, "error": msg}

        try:
            kickoff_json: dict = resp.json()
        except Exception:
            return {"success": False, "error": "Agent kickoff returned non-JSON response"}

        job_id: str | None = kickoff_json.get("jobId") or kickoff_json.get("job_id")
        if not isinstance(job_id, str) or not job_id:
            return {"success": False, "error": "Agent kickoff did not return a jobId"}

        # Resolve poll URL
        poll_url_from_resp: str | None = (
            kickoff_json.get("poll_url")
            or kickoff_json.get("pollUrl")
            or kickoff_json.get("result_url")
        )
        if poll_url_from_resp:
            poll_url = (
                poll_url_from_resp
                if poll_url_from_resp.startswith("http")
                else f"{base}/{poll_url_from_resp.lstrip('/')}"
            )
        elif poll_url_template:
            resolved = poll_url_template.replace("{{jobId}}", job_id)
            poll_url = resolved if resolved.startswith("http") else f"{base}/{resolved.lstrip('/')}"
        else:
            poll_url = f"{base}/public/result/{job_id}"
            log.warning("poll_url fallback → %s", poll_url)

        log.info("polling → %s", poll_url)

        # 2. Poll for completion
        import time
        started_at = time.monotonic()
        for attempt in range(1, MAX_POLL_ATTEMPTS + 1):
            if time.monotonic() - started_at >= MAX_TOTAL_S:
                return {"success": False, "error": "Agent timed out after 60s"}

            await asyncio.sleep(POLL_INTERVAL_S)

            try:
                poll_resp = await client.get(poll_url, headers=headers)
            except Exception as exc:
                return {"success": False, "error": f"Agent poll failed: {exc}"}

            if not poll_resp.is_success:
                try:
                    raw = poll_resp.json()
                except Exception:
                    raw = poll_resp.text
                detail = _extract_detail(raw)
                msg = (
                    f"Agent poll returned {poll_resp.status_code} {poll_resp.reason_phrase} (url: {poll_url}) — {detail}"
                    if detail
                    else f"Agent poll returned {poll_resp.status_code} {poll_resp.reason_phrase} (url: {poll_url})"
                )
                return {"success": False, "error": msg}

            try:
                poll_json: dict = poll_resp.json()
            except Exception:
                return {"success": False, "error": "Agent poll returned non-JSON response"}

            status = str(poll_json.get("status") or "").lower()
            if status in ("complete", "completed", "success", "done"):
                return {"success": True, "data": poll_json.get("result") or poll_json}
            if status in ("error", "failed"):
                return {
                    "success": False,
                    "error": poll_json.get("error") or poll_json.get("message") or "Agent reported an error",
                }
            # queued / running / processing → keep polling

    return {"success": False, "error": "Agent timed out after 30 poll attempts"}
