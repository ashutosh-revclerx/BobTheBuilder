"""Shared httpx.AsyncClient — created once in lifespan, reused everywhere.

Performance-critical (MIGRATION_PLAN §7). Creating an AsyncClient per request
adds ~10ms of TCP/TLS overhead each, and breaks connection reuse to upstreams
like the auth provider and external REST resources.
"""

from __future__ import annotations

import httpx

_client: httpx.AsyncClient | None = None


async def init_client() -> httpx.AsyncClient:
    global _client
    if _client is not None:
        return _client
    _client = httpx.AsyncClient(
        timeout=httpx.Timeout(30.0, connect=10.0),
        limits=httpx.Limits(max_keepalive_connections=20, max_connections=100),
        # http2 disabled by default; opt-in via env if needed.
    )
    return _client


async def close_client() -> None:
    global _client
    if _client is not None:
        await _client.aclose()
        _client = None


def get_client() -> httpx.AsyncClient:
    if _client is None:
        raise RuntimeError("HTTP client is not initialised yet")
    return _client
