# Codebase Restructure Log

This document records every change made during the architectural review and refactoring of the BTB dashboard builder monorepo. Use it to replicate the same improvements on a fresh branch or a new project with a similar stack.

---

## Stack

| Layer | Tech |
|---|---|
| Frontend | React 19 + TypeScript + Vite |
| Backend | Node.js + Express 4 + TypeScript |
| LLM Service | Python 3.12 + FastAPI + Uvicorn |
| Database | PostgreSQL 16 |
| State | Zustand |
| Validation | Zod 4.x (backend), Zod 3.x (shared — mismatch, deferred) |
| Monorepo | npm workspaces (`apps/*`, `packages/*`) |

---

## Changes Applied

### 1. Frontend — Centralize API Base URL

**Problem:** `const API_BASE = 'http://localhost:3001'` was hardcoded in 13 separate files. Any non-local deployment silently broke all API calls.

**Fix:** Create a single source of truth backed by a Vite env var.

**New file: `apps/frontend/src/config/api.ts`**
```ts
export const API_BASE: string =
  (import.meta.env.VITE_API_BASE as string | undefined)?.replace(/\/$/, '') ??
  'http://localhost:3001';
```

**New file: `apps/frontend/.env.example`**
```
# Backend API base URL — no trailing slash.
# Defaults to http://localhost:3001 when not set (see src/config/api.ts).
# VITE_API_BASE=http://localhost:3001
```

**Updated files** — removed the local `const API_BASE = '...'` declaration and added:
```ts
import { API_BASE } from '../config/api';       // pages/
import { API_BASE } from '../../config/api';    // components/ and services/
```

Files updated:
- `src/pages/DashboardList.tsx`
- `src/pages/BuilderPage.tsx`
- `src/pages/CustomerView.tsx`
- `src/pages/GeneratePage.tsx`
- `src/pages/ResourcesPage.tsx`
- `src/pages/TemplatePicker.tsx`
- `src/services/assistantService.ts`
- `src/services/exportService.ts`
- `src/components/ui/EndpointPicker.tsx`
- `src/components/editor/AssignmentModal.tsx`
- `src/components/editor/DataTab.tsx`
- `src/components/editor/PublishToggle.tsx`
- `src/components/dashboard-components/FileUpload.tsx`
- `src/engine/queryEngine.ts`

---

### 2. Backend — Centralize Environment Parsing

**Problem:** `readPositiveIntEnv`, `LLM_SERVICE_URL`, and timeout constants were copy-pasted identically in both `dashboards.ts` and `assistant.ts`.

**Fix:** Extract to a single config module.

**New file: `apps/backend/src/config/env.ts`**
```ts
function readPositiveInt(name: string, fallback: number): number {
  const raw = process.env[name];
  if (!raw) return fallback;
  const parsed = Number(raw);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

export const env = {
  port:             readPositiveInt('PORT', 3001),
  llmServiceUrl:    (process.env.LLM_SERVICE_URL ?? 'http://localhost:8000').replace(/\/$/, ''),
  llmTimeoutMs:     readPositiveInt('LLM_TIMEOUT_MS', 180_000),
  llmChatTimeoutMs: readPositiveInt('LLM_CHAT_TIMEOUT_MS', 60_000),
  corsOrigin:       process.env.CORS_ORIGIN ?? '*',
  logLevel:         process.env.LOG_LEVEL ?? 'info',
} as const;
```

Both `dashboards.ts` and `assistant.ts` now import `env` from `'../config/env.js'` and remove their local duplicates.

**New file: `apps/backend/.env.example`**
```
DATABASE_URL=postgresql://dashboard_user:dashboard_pass@localhost:5432/dashboard_db
PORT=3001
LLM_SERVICE_URL=http://localhost:8000
LLM_TIMEOUT_MS=180000
LLM_CHAT_TIMEOUT_MS=60000
NEXUS_API_KEY=your_nexus_api_key_here
# CORS_ORIGIN=https://app.yourdomain.com
# LOG_LEVEL=info
```

---

### 3. Backend — Consistent Structured Logging

**Problem:** All four route files used raw `console.error()`/`console.info()` bypassing the existing `createLogger` utility, so `LOG_LEVEL` was ignored and log lines had no scope prefix.

**Fix:** Add `createLogger` to every route file.

Pattern applied to all four files:
```ts
import { createLogger } from '../utils/logger.js';
const log = createLogger('<scope>');

// replace every console.error/console.info with:
log.error('operation:', err);
log.info('message');
```

Scopes used: `dashboards`, `assistant`, `customers`, `resources`

Files updated:
- `apps/backend/src/routes/dashboards.ts`
- `apps/backend/src/routes/assistant.ts`
- `apps/backend/src/routes/customers.ts`
- `apps/backend/src/routes/resources.ts`

---

### 4. Backend — Fix Transaction Safety in Dashboard Assignments

**Problem:** `/api/dashboards/:id/assign` used `pool.query('BEGIN')` which does not guarantee all subsequent queries run on the same database connection. This can silently run queries outside the transaction.

**Fix:** Check out a dedicated client from the pool.

```ts
const client = await pool.connect();
try {
  await client.query('BEGIN');

  await client.query(
    'DELETE FROM dashboard_assignments WHERE dashboard_id = $1',
    [dashboardId],
  );

  if (customer_ids.length > 0) {
    await client.query(
      `INSERT INTO dashboard_assignments (dashboard_id, customer_id)
       SELECT $1, UNNEST($2::uuid[])`,
      [dashboardId, customer_ids],
    );
  }

  await client.query('COMMIT');
} catch (e) {
  await client.query('ROLLBACK');
  throw e;
} finally {
  client.release();
}
```

**Bonus:** The N+1 loop of sequential `INSERT` statements was replaced with a single `UNNEST`-based bulk insert (shown above).

---

### 5. Backend — CORS and Payload Size

**Problem:** CORS allowed all origins unconditionally in production; `express.json()` used the Express default (100 kB) which is too small for large dashboard configs.

**Fix in `apps/backend/src/app.ts`:**
```ts
app.use(cors({ origin: process.env.CORS_ORIGIN ?? '*' }));
app.use(express.json({ limit: '10mb' }));
```

Set `CORS_ORIGIN=https://your-frontend.com` in production to lock down origins.

---

### 6. Docker — PostgreSQL Healthcheck

**Problem:** pgAdmin could start before the postgres container was ready to accept connections, causing startup failures.

**Fix in `docker-compose.yml`:**
```yaml
postgres:
  # ... existing config ...
  healthcheck:
    test: ["CMD-SHELL", "pg_isready -U dashboard_user -d dashboard_db"]
    interval: 5s
    timeout: 5s
    retries: 10
    start_period: 10s

pgadmin:
  depends_on:
    postgres:
      condition: service_healthy
```

---

### 7. LLM Service — Relocated to Top-Level App

**Problem:** The Python LLM service lived at `apps/backend/services/llm/` — nested inside the Node backend, implying it was a backend sub-module. It is an independent microservice.

**Fix:** Move it to its own top-level app directory.

```bash
git mv apps/backend/services/llm apps/llm-service
```

Git history is fully preserved with `git mv`.

**Updated `docker-compose.yml`:**
```yaml
llm:
  build: ./apps/llm-service
  env_file:
    - ./apps/llm-service/.env
  volumes:
    - ./apps/llm-service/app:/service/app
```

**Updated `.gitignore`:**
```gitignore
# Python (LLM service — now at apps/llm-service/)
apps/llm-service/.venv/
apps/llm-service/.env
apps/llm-service/.env.*
!apps/llm-service/.env.example
```

---

### 8. Remove `@btb/shared` from Backend Dependencies

**Problem:** `@btb/shared` was listed in `apps/backend/package.json` dependencies but no backend source file imported from it.

**Fix:** Remove the unused dependency from `apps/backend/package.json`.

```diff
-  "@btb/shared": "*",
   "cors": "^2.8.5",
```

---

### 9. Remove Dead `apps/backend-py/` Directory

**Problem:** An earlier Python backend migration attempt left `apps/backend-py/` on disk as untracked files, causing confusion about which backend was active.

**Fix:**
- Delete the directory from disk
- Add to `.gitignore` so it can't be accidentally committed if it reappears after a branch switch:

```gitignore
# Deprecated Python backend (not committed, safe to ignore if it reappears)
apps/backend-py/
```

---

## Deferred (Not Applied — Recommended Next Steps)

These improvements were identified but deferred to avoid scope creep. Each is a separate PR-sized task.

| Priority | Task | Reason deferred |
|---|---|---|
| Critical | **Add JWT auth middleware to Node backend** — all API routes are currently public | Requires coordination on which JWT provider/secret to use |
| High | **Sync `packages/shared` types** — only 7 of 18 component types are declared | Risk of breaking imports across frontend |
| High | **Fix Zod version mismatch** — backend uses Zod 4.x, `packages/shared` uses Zod 3.x | Shared package rewrite needed |
| Medium | **Add DB indexes** — `dashboard_assignments.dashboard_id` and `customers.dashboard_id` have no indexes | Requires new migration file |
| Medium | **Make LLM service handlers `async def`** — currently sync, blocks Uvicorn thread pool | Python service change |
| Low | **Add CI pipeline** — no GitHub Actions; zero test coverage | Needs test suite first |

---

## Final Directory Structure

```
BTB/
├── apps/
│   ├── backend/           # Node.js + Express API (port 3001)
│   │   └── src/
│   │       ├── config/
│   │       │   └── env.ts         ← NEW: centralized env parsing
│   │       ├── routes/
│   │       ├── executors/
│   │       ├── db/
│   │       └── utils/
│   ├── frontend/          # React + Vite (port 5173)
│   │   └── src/
│   │       ├── config/
│   │       │   └── api.ts         ← NEW: centralized API base URL
│   │       ├── pages/
│   │       ├── components/
│   │       ├── services/
│   │       └── engine/
│   └── llm-service/       # Python FastAPI (port 8000) ← MOVED from apps/backend/services/llm
│       └── app/
├── packages/
│   └── shared/            # Shared TypeScript types (stale — see deferred tasks)
├── docker-compose.yml
├── .gitignore
└── RESTRUCTURE.md         ← this file
```
