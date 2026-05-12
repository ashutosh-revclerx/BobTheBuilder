"""Migration runner — port of `src/db/migrate.ts`.

Run as a module:
    python -m app.db.migrate

Reads SQL files from app/db/migrations/, applies them in lexicographic order,
each inside its own transaction, tracking applied files in a `migrations`
table. Idempotent: re-running is safe.
"""

from __future__ import annotations

import asyncio
import sys
from pathlib import Path

import asyncpg

from ..config import settings

MIGRATIONS_DIR = Path(__file__).resolve().parent / "migrations"


async def run() -> int:
    conn = await asyncpg.connect(dsn=settings.database_url)
    try:
        await conn.execute("SELECT pg_advisory_lock(80671001)")
        await conn.execute(
            """
            CREATE EXTENSION IF NOT EXISTS pgcrypto;

            CREATE TABLE IF NOT EXISTS migrations (
              name   TEXT        PRIMARY KEY,
              run_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
            )
            """
        )

        applied_rows = await conn.fetch("SELECT name FROM migrations ORDER BY name")
        applied = {r["name"] for r in applied_rows}

        files = sorted(p.name for p in MIGRATIONS_DIR.glob("*.sql"))

        ran = 0
        for file in files:
            if file in applied:
                print(f"[migrate] skip  {file}")
                continue

            sql = (MIGRATIONS_DIR / file).read_text(encoding="utf-8")

            async with conn.transaction():
                await conn.execute(sql)
                await conn.execute("INSERT INTO migrations (name) VALUES ($1)", file)
            print(f"[migrate] ran   {file}")
            ran += 1

        print(f"[migrate] done — {ran} migration(s) applied.")
        return 0
    finally:
        try:
            await conn.execute("SELECT pg_advisory_unlock(80671001)")
        except Exception:
            pass
        await conn.close()


def main() -> None:
    try:
        sys.exit(asyncio.run(run()))
    except Exception as e:
        print(f"[migrate] Fatal: {e}", file=sys.stderr)
        sys.exit(1)


if __name__ == "__main__":
    main()
