"""Shared route helpers — pg error codes, JSON normalisation, etc.

Mirrors the Node `pgCode`, `PG_UNIQUE_VIOLATION` constants used across routes.
"""

from __future__ import annotations

import json
from datetime import date, datetime, timezone
from typing import Any
from uuid import UUID

import asyncpg

PG_UNIQUE_VIOLATION = "23505"
PG_INVALID_UUID = "22P02"
PG_FOREIGN_KEY = "23503"


def pg_code(err: BaseException) -> str | None:
    """Extract the SQLSTATE code from an asyncpg exception, mirroring pgCode()."""
    if isinstance(err, asyncpg.PostgresError):
        return getattr(err, "sqlstate", None)
    return None


def _default(obj: Any) -> Any:
    if isinstance(obj, (datetime, date)):
        # Match JS toISOString() — milliseconds + Z suffix
        if isinstance(obj, datetime):
            if obj.tzinfo is None:
                obj = obj.replace(tzinfo=timezone.utc)
            return obj.astimezone(timezone.utc).isoformat(timespec="milliseconds").replace(
                "+00:00", "Z"
            )
        return obj.isoformat()
    if isinstance(obj, UUID):
        return str(obj)
    raise TypeError(f"Object of type {type(obj).__name__} is not JSON serializable")


def to_jsonable(value: Any) -> Any:
    """Recursively convert asyncpg row values into JSON-serialisable primitives.

    asyncpg returns: datetime (timestamptz), UUID, etc. JSONB columns come
    back as plain Python objects (dict/list/str), but only when no codec
    overrides are set. We normalise everything here so FastAPI's default
    encoder doesn't choke.
    """
    if isinstance(value, asyncpg.Record):
        return {k: to_jsonable(v) for k, v in value.items()}
    if isinstance(value, dict):
        return {k: to_jsonable(v) for k, v in value.items()}
    if isinstance(value, list):
        return [to_jsonable(v) for v in value]
    if isinstance(value, (datetime, date, UUID)):
        return _default(value)
    if isinstance(value, str):
        # JSONB columns sometimes come back as already-parsed dicts, but with
        # statement_cache_size=0 + no type codec set, asyncpg returns them as
        # strings. Try parsing once.
        if (value.startswith("{") and value.endswith("}")) or (
            value.startswith("[") and value.endswith("]")
        ):
            try:
                return json.loads(value)
            except Exception:
                return value
        return value
    return value


def row_to_dict(row: asyncpg.Record | None) -> dict[str, Any] | None:
    if row is None:
        return None
    return {k: to_jsonable(v) for k, v in row.items()}


def rows_to_list(rows: list[asyncpg.Record]) -> list[dict[str, Any]]:
    return [{k: to_jsonable(v) for k, v in r.items()} for r in rows]
