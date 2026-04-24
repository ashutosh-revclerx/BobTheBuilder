import { readdir, readFile } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { pool } from '../src/db/client.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const MIGRATIONS_DIR = join(__dirname, '..', 'src', 'db', 'migrations');

/**
 * Ensure migrations are applied to the test database. Safe to call many
 * times — each migration checks its own pre-conditions via the migrations
 * tracking table.
 */
export async function runMigrations(): Promise<void> {
  const client = await pool.connect();
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS migrations (
        name TEXT PRIMARY KEY,
        run_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);
    const { rows: applied } = await client.query<{ name: string }>(
      'SELECT name FROM migrations ORDER BY name',
    );
    const appliedSet = new Set(applied.map((r) => r.name));
    const files = (await readdir(MIGRATIONS_DIR)).filter((f) => f.endsWith('.sql')).sort();
    for (const file of files) {
      if (appliedSet.has(file)) continue;
      const sql = await readFile(join(MIGRATIONS_DIR, file), 'utf8');
      await client.query('BEGIN');
      try {
        await client.query(sql);
        await client.query('INSERT INTO migrations (name) VALUES ($1)', [file]);
        await client.query('COMMIT');
      } catch (e) {
        await client.query('ROLLBACK');
        throw e;
      }
    }
  } finally {
    client.release();
  }
}

/**
 * Wipe all data between tests. Order matters — child FK tables first.
 * `RESTART IDENTITY CASCADE` clears any dependent rows that might still
 * reference these tables (belt + suspenders).
 */
export async function truncateAll(): Promise<void> {
  await pool.query(
    `TRUNCATE TABLE query_logs, customers, dashboards, resources RESTART IDENTITY CASCADE`,
  );
}

export async function closePool(): Promise<void> {
  await pool.end();
}
