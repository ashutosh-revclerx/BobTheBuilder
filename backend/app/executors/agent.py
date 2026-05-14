"""Agent executor — port of `src/executors/agentExecutor.ts`.

Kicks off a job at a REST endpoint, then polls a status URL until completion
(or timeout). Uses asyncio.sleep — never blocks the event loop.
"""

from __future__ import annotations

import asyncio
import base64
import json as _json
from typing import Any
from urllib.parse import urlencode

import httpx

from ..http_client import get_client
from ..logger import create_logger

log = create_logger("agentExec")

_POLL_INTERVAL_S = 2.0
_MAX_TOTAL_S = 60.0
_MAX_POLL_ATTEMPTS = 30


def _build_auth_headers(auth_type: str | None, resolved_secret: str | None) -> dict[str, str]:
    h: dict[str, str] = {"Content-Type": "application/json", "Accept": "application/json"}
    if not resolved_secret:
        return h
    if auth_type == "bearer":
        h["Authorization"] = f"Bearer {resolved_secret}"
    elif auth_type == "api_key":
        h["X-API-Key"] = resolved_secret
    elif auth_type == "basic":
        h["Authorization"] = "Basic " + base64.b64encode(resolved_secret.encode("utf-8")).decode(
            "ascii"
        )
    return h


def _extract_detail(raw_text: str) -> str:
    if not raw_text:
        return ""
    try:
        parsed = _json.loads(raw_text)
    except Exception:
        return raw_text[:200]
    if isinstance(parsed, dict):
        return str(
            parsed.get("detail") or parsed.get("error") or parsed.get("message") or ""
        )[:200] or _json.dumps(parsed)[:200]
    return raw_text[:200]


async def agent_executor(
    *,
    base_url: str,
    auth_type: str | None,
    resolved_secret: str | None,
    endpoint: str,
    params: dict[str, Any] | None = None,
    body: dict[str, Any] | None = None,
    poll_url_template: str | None = None,
) -> dict[str, Any]:
    base = base_url.rstrip("/")
    path = endpoint if endpoint.startswith("/") else "/" + endpoint
    kick_url = base + path
    if params:
        kick_url = f"{kick_url}?{urlencode({k: str(v) for k, v in params.items()})}"

    headers = _build_auth_headers(auth_type, resolved_secret)
    client = get_client()

    # ── 1. Kick off the job ──────────────────────────────────────────────────
    log.info(f"kickoff → {kick_url}")
    try:
        kickoff = await client.post(kick_url, headers=headers, json=body or {})
    except httpx.HTTPError as e:
        return {"success": False, "error": f"Agent kickoff failed ({kick_url}): {e}"}

    if kickoff.status_code >= 400:
        detail = _extract_detail(kickoff.text)
        suffix = f" — {detail}" if detail else ""
        return {
            "success": False,
            "error": f"Agent kickoff returned {kickoff.status_code} {kickoff.reason_phrase}{suffix}",
        }

    try:
        kickoff_json = kickoff.json()
    except Exception:
        return {"success": False, "error": "Agent kickoff returned non-JSON response"}

    raw_job_id = kickoff_json.get("jobId") or kickoff_json.get("job_id") or kickoff_json.get("id")
    job_id = str(raw_job_id) if raw_job_id is not None else ""
    if not job_id:
        return {"success": False, "error": "Agent kickoff did not return a jobId"}

    # ── 2. Resolve poll URL ──────────────────────────────────────────────────
    poll_url_from_response = (
        kickoff_json.get("poll_url")
        or kickoff_json.get("pollUrl")
        or kickoff_json.get("result_url")
    )

    log.info("kickoff response:", kickoff_json)

    if poll_url_from_response:
        if poll_url_from_response.startswith("http"):
            poll_url = poll_url_from_response
        else:
            prefix = "" if poll_url_from_response.startswith("/") else "/"
            poll_url = f"{base}{prefix}{poll_url_from_response}"
        log.info(f"poll_url from response → {poll_url}")
    elif poll_url_template:
        resolved_template = (
            poll_url_template
            .replace("{{jobId}}", job_id)
            .replace("{{job_id}}", job_id)
            .replace("{jobId}", job_id)
            .replace("{job_id}", job_id)
        )
        if resolved_template.startswith("http"):
            poll_url = resolved_template
        else:
            prefix = "" if resolved_template.startswith("/") else "/"
            poll_url = f"{base}{prefix}{resolved_template}"
        log.info(f"poll_url from template → {poll_url}")
    else:
        from urllib.parse import quote
        poll_url = f"{base}/public/result/{quote(job_id)}"
        log.warn(f"poll_url fallback → {poll_url} (consider configuring pollUrlTemplate)")

    # ── 3. Poll ──────────────────────────────────────────────────────────────
    started_at = asyncio.get_event_loop().time()
    for _ in range(_MAX_POLL_ATTEMPTS):
        if asyncio.get_event_loop().time() - started_at >= _MAX_TOTAL_S:
            return {"success": False, "error": "Agent timed out after 60s"}

        await asyncio.sleep(_POLL_INTERVAL_S)

        try:
            poll = await client.get(poll_url, headers=headers)
        except httpx.HTTPError as e:
            return {"success": False, "error": f"Agent poll failed: {e}"}

        if poll.status_code >= 400:
            detail = _extract_detail(poll.text)
            suffix = f" — {detail}" if detail else ""
            return {
                "success": False,
                "error": (
                    f"Agent poll returned {poll.status_code} {poll.reason_phrase} "
                    f"(url: {poll_url}){suffix}"
                ),
            }

        try:
            poll_json = poll.json()
        except Exception:
            return {"success": False, "error": "Agent poll returned non-JSON response"}

        status = str(poll_json.get("status") or "").lower()

        if status in ("complete", "completed", "success", "done"):
            return {"success": True, "data": poll_json.get("result", poll_json)}
        if status in ("error", "failed"):
            return {
                "success": False,
                "error": poll_json.get("error") or poll_json.get("message") or "Agent reported an error",
            }
        # queued / running / processing → keep polling

    return {"success": False, "error": "Agent timed out after 30 poll attempts"}
