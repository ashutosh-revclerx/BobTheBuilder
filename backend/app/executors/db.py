"""Read-only DB executor — port of `src/executors/dbExecutor.ts`.

Two defence layers (same as Node):
1. WRITE_RE regex blocks obvious mutations before the query runs.
2. BEGIN READ ONLY transaction has the DB itself enforce it.
"""

from __future__ import annotations

import re
from typing import Any

import asyncpg

_WRITE_RE = re.compile(
    r"\b(INSERT|UPDATE|DELETE|DROP|ALTER|TRUNCATE|CREATE|REPLACE|GRANT|REVOKE|MERGE|COPY)\b",
    re.IGNORECASE,
)


async def db_executor(
    *,
    connection_string: str,
    query: str,
    params: list[Any] | None = None,
) -> dict[str, Any]:
    if not connection_string:
        return {
            "success": False,
            "error": (
                "No connection string resolved for this resource — check secret_ref "
                "and the corresponding env variable"
            ),
        }

    if _WRITE_RE.search(query):
        return {
            "success": False,
            "error": (
                "Write operations are not permitted. Only SELECT queries are allowed "
                "through the execute API."
            ),
        }

    try:
        conn = await asyncpg.connect(dsn=connection_string)
    except Exception as e:
        return {"success": False, "error": str(e)}

    try:
        # Defence layer 2: read-only transaction
        async with conn.transaction(readonly=True):
            rows = await conn.fetch(query, *(params or []))
            return {"success": True, "data": [dict(r) for r in rows]}
    except Exception as e:
        return {"success": False, "error": str(e)}
    finally:
        await conn.close()
