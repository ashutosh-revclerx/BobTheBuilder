import re
from typing import Any

import asyncpg

WRITE_RE = re.compile(
    r"\b(INSERT|UPDATE|DELETE|DROP|ALTER|TRUNCATE|CREATE|REPLACE|GRANT|REVOKE|MERGE|COPY)\b",
    re.IGNORECASE,
)


async def db_executor(
    connection_string: str,
    query: str,
    params: list[Any] | None = None,
) -> dict[str, Any]:
    if not connection_string:
        return {
            "success": False,
            "error": "No connection string resolved for this resource — check secret_ref and the corresponding env variable",
        }

    if WRITE_RE.search(query):
        return {
            "success": False,
            "error": "Write operations are not permitted. Only SELECT queries are allowed through the execute API.",
        }

    conn: asyncpg.Connection | None = None
    try:
        conn = await asyncpg.connect(dsn=connection_string)
        await conn.execute("BEGIN READ ONLY")
        rows = await conn.fetch(query, *(params or []))
        await conn.execute("COMMIT")
        return {"success": True, "data": [dict(r) for r in rows]}
    except Exception as exc:
        if conn:
            try:
                await conn.execute("ROLLBACK")
            except Exception:
                pass
        return {"success": False, "error": str(exc)}
    finally:
        if conn:
            try:
                await conn.close()
            except Exception:
                pass
