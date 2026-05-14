"""Single asyncpg connection pool, created in FastAPI lifespan.

Mirrors the Node `pool` singleton from `src/db/client.ts`. Performance-critical
— per the migration plan, this MUST be created once and shared across the app.
"""

from __future__ import annotations

import asyncpg

from ..config import settings
from ..logger import create_logger

log = create_logger("db")

_pool: asyncpg.Pool | None = None


async def init_pool() -> asyncpg.Pool:
    """Create the pool. Called from app lifespan startup."""
    global _pool
    if _pool is not None:
        return _pool
    if not settings.database_url:
        raise RuntimeError("DATABASE_URL is not set")

    _pool = await asyncpg.create_pool(
        dsn=settings.database_url,
        min_size=2,
        max_size=20,
        # Disable statement cache for queries with dynamic JSONB params; safest
        # default for a generalist pool.
        statement_cache_size=0,
    )
    log.info("asyncpg pool created (min=2 max=20)")
    return _pool


async def close_pool() -> None:
    """Drain and close the pool. Called from app lifespan shutdown."""
    global _pool
    if _pool is not None:
        await _pool.close()
        _pool = None
        log.info("asyncpg pool closed")


def get_pool() -> asyncpg.Pool:
    """Synchronous accessor — only safe after init_pool() has run."""
    if _pool is None:
        raise RuntimeError("DB pool is not initialised yet")
    return _pool
