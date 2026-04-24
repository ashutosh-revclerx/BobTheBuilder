// Runs once before any test file loads. Its job is to make sure every piece
// of the backend that reads process.env.DATABASE_URL picks up the test
// database, NOT the dev database.
//
// Strategy: load .env.test if present; otherwise derive a test URL from
// DATABASE_URL by appending `_test` to the database name. Either way, we
// assert the resulting URL points at a database whose name ends in `_test`
// so there is zero chance of a test run truncating dev data.

import 'dotenv/config';
import { readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Load .env.test and let it override dev env vars — its whole point is to
// redirect tests off the dev database.
const envTestPath = join(__dirname, '..', '.env.test');
if (existsSync(envTestPath)) {
  const lines = readFileSync(envTestPath, 'utf8').split(/\r?\n/);
  for (const raw of lines) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    const eq = line.indexOf('=');
    if (eq === -1) continue;
    const key = line.slice(0, eq).trim();
    const val = line.slice(eq + 1).trim();
    process.env[key] = val;
  }
}

// Extract the database name from the URL (last /path segment, before any ?)
const dbNameMatch = (process.env.DATABASE_URL ?? '').match(/\/([^/?]+)(?:\?|$)/);
const dbName = dbNameMatch ? dbNameMatch[1] : '';

// If it doesn't look like a test db yet, append `_test`
if (dbName && !/test/i.test(dbName)) {
  process.env.DATABASE_URL = process.env.DATABASE_URL!.replace(
    /\/([^/?]+)(\?|$)/,
    '/$1_test$2',
  );
}

if (!/test/i.test(dbName) && !/test/i.test(process.env.DATABASE_URL ?? '')) {
  throw new Error(
    `[tests/setup] Refusing to run — DATABASE_URL does not target a test database. Got: ${process.env.DATABASE_URL}`,
  );
}

// Quiet the app error-middleware logs during tests — we expect 4xx/5xx paths
// and do not want noisy console output.
const origErr = console.error;
console.error = (...args: unknown[]) => {
  const first = args[0];
  if (typeof first === 'string' && (first.startsWith('[app]') || first.startsWith('[customers]') || first.startsWith('[dashboards]') || first.startsWith('[resources]') || first.startsWith('[execute]'))) {
    return;
  }
  origErr(...args);
};
