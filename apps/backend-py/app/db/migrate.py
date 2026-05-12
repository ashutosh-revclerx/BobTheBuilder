"""
Runs .sql migration files in the sibling Node backend's migrations directory,
tracking applied migrations in a `migrations` table. Safe to run on every
startup — already-applied files are skipped.
"""
import asyncio
import os
import re
from pathlib import Path

import asyncpg

HERE = Path(__file__).parent
# Migrations live in the Node backend's src/db/migrations — reuse them directly.
MIGRATIONS_DIR = HERE.parent.parent.parent / "backend" / "src" / "db" / "migrations"


async def run_migrations(pool: asyncpg.Pool) -> None:
    async with pool.acquire() as conn:
        await conn.execute(
            """
            CREATE TABLE IF NOT EXISTS migrations (
                name   TEXT        PRIMARY KEY,
                run_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
            )
            """
        )

        sql_files = sorted(
            f for f in MIGRATIONS_DIR.iterdir()
            if f.suffix == ".sql"
        )

        for sql_file in sql_files:
            already_applied = await conn.fetchval(
                "SELECT 1 FROM migrations WHERE name = $1",
                sql_file.name,
            )
            if already_applied:
                continue

            sql = sql_file.read_text(encoding="utf-8")
            print(f"[migrate] applying {sql_file.name}")
            async with conn.transaction():
                await conn.execute(sql)
                await conn.execute(
                    "INSERT INTO migrations (name) VALUES ($1)",
                    sql_file.name,
                )
            print(f"[migrate] applied  {sql_file.name}")


if __name__ == "__main__":
    import asyncpg
    from app.config import settings

    async def main() -> None:
        pool = await asyncpg.create_pool(dsn=settings.database_url)
        await run_migrations(pool)
        await pool.close()

    asyncio.run(main())
