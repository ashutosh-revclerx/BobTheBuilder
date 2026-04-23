import { Client } from 'pg';
import type { ExecutorResult } from './restExecutor.js';

export interface DbExecutorInput {
  connectionString: string;
  query:            string;
  params?:          unknown[];
}

// Any keyword that mutates schema or data.
// Checked before the query runs as a fast-fail; BEGIN READ ONLY is the
// authoritative enforcement layer that catches anything this misses.
const WRITE_RE = /\b(INSERT|UPDATE|DELETE|DROP|ALTER|TRUNCATE|CREATE|REPLACE|GRANT|REVOKE|MERGE|COPY)\b/i;

export async function dbExecutor(input: DbExecutorInput): Promise<ExecutorResult> {
  const { connectionString, query, params = [] } = input;

  if (!connectionString) {
    return { success: false, error: 'No connection string resolved for this resource — check secret_ref and the corresponding env variable' };
  }

  if (WRITE_RE.test(query)) {
    return {
      success: false,
      error:   'Write operations are not permitted. Only SELECT queries are allowed through the execute API.',
    };
  }

  const client = new Client({ connectionString });

  try {
    await client.connect();

    // Defence layer 2: run inside a read-only transaction so the database itself
    // enforces the constraint even if the regex above is somehow bypassed.
    await client.query('BEGIN READ ONLY');
    const result = await client.query(query, params);
    await client.query('COMMIT');

    return { success: true, data: result.rows };
  } catch (err) {
    // Roll back cleanly on query errors (no-op if the transaction never opened)
    try { await client.query('ROLLBACK'); } catch { /* ignore */ }
    return { success: false, error: (err as Error).message };
  } finally {
    try { await client.end(); } catch { /* ignore */ }
  }
}
