# Backend Migration Plan — Node → Python (unified with LLM service)

**Status:** Draft — not yet executed.
**Owner:** TBD
**Target branch:** `feature/backend-python-v2` (new branch off current working branch)

---

## 1. Goals

1. Replace the Node/Express backend with a **single Python (FastAPI) backend** that absorbs the existing LLM service. One process, one container, one deployable.
2. Preserve the **public API contract** exactly so the frontend ships unchanged: same `/api/v1/*` paths, same JSON shapes, same auth flow, same error codes.
3. **Meet or beat current Node performance.** The previous Python attempt (`backend/python` branch) was rejected because it was significantly slower. This rewrite is engineered specifically to avoid that outcome — see [§7 Performance Requirements](#7-performance-requirements).

## 2. Non-goals

- Schema changes to Postgres (the existing 10 migrations carry over verbatim).
- New features. This is a 1:1 port. Behavior changes happen in follow-up PRs.
- Frontend changes (apart from possibly bumping a dependency).
- Touching the auth provider (NerveSparks JWKS continues to work as-is).

---

## 3. Current state (what we're replacing)

| Component                                 | Lines | Notes                                                       |
| ----------------------------------------- | ----- | ----------------------------------------------------------- |
| `apps/backend/src/routes/*.ts` (6 files)  | 1,866 | dashboards, resources, customers, execute, assistant, auth  |
| `apps/backend/src/executors/*.ts`         |   334 | REST, DB, Agent                                             |
| `apps/backend/src/auth/nervesparks.ts`    |   241 | JWKS-backed RS256 JWT verification                          |
| `apps/backend/src/app.ts`                 |    67 | Express factory                                             |
| **Total Node backend**                    | **~2,500** | All TypeScript                                           |
| `apps/llm-service/app/*.py`               | 3,623 | Already Python — reuse 80%+ as-is                           |
| `apps/backend/src/db/migrations/*.sql`    |    10 | SQL files — no migration needed                             |

**Prior attempt:** Branch `backend/python` exists (also `origin/backend/python`). Step 1 below requires reviewing it to identify what caused the slowdown — likely candidates: sync DB driver, sync route handlers, per-request `httpx.Client` instances, no JWKS caching.

---

## 4. Target architecture

```
                              ┌─────────────────────────────┐
                              │ Browser (React SPA)         │
                              └──────────────┬──────────────┘
                                             │ /api/v1/*
                                             ▼
                              ┌─────────────────────────────┐
                              │ nginx :80   (unchanged)     │
                              │ proxies /api → backend:3001 │
                              └──────────────┬──────────────┘
                                             │
                                             ▼
   ┌──────────────────────────────────────────────────────────────────────┐
   │ FastAPI + Uvicorn :3001        (new unified Python backend)          │
   │                                                                      │
   │  ┌───────────────────┐  ┌──────────────────┐  ┌──────────────────┐   │
   │  │ Routes            │  │ Auth middleware  │  │ LLM module       │   │
   │  │ /auth, /dashboards│  │ JWKS verification│  │ (in-process)     │   │
   │  │ /resources, etc.  │  │ requireAuth dep  │  │ gemini → openai  │   │
   │  └─────────┬─────────┘  └──────────────────┘  └────────┬─────────┘   │
   │            │                                            │             │
   │            └─────────────────┬──────────────────────────┘             │
   │                              ▼                                        │
   │                  ┌──────────────────────┐                             │
   │                  │ asyncpg pool         │                             │
   │                  │ httpx.AsyncClient    │  (shared, app-scoped)       │
   │                  │ JWKS cache (in-mem)  │                             │
   │                  └──────────────────────┘                             │
   └──────────────────────────────────────────────────────────────────────┘
                                  │
                                  ▼
                       ┌────────────────────┐
                       │ Postgres 16        │  (unchanged)
                       └────────────────────┘
```

- **One process** — FastAPI app exposes both backend routes and LLM endpoints.
- **LLM is an internal module**, not an HTTP service. The assistant and generate routes call Python functions directly — eliminating the current HTTP hop between Node→Python.
- **Shared resources** are app-scoped (Postgres pool, HTTP client, JWKS cache) — created once in `lifespan`, reused across requests.

---

## 5. Tech choices

| Concern              | Choice                              | Why                                                          |
| -------------------- | ----------------------------------- | ------------------------------------------------------------ |
| Web framework        | **FastAPI**                         | Already in use for LLM service; native async; OpenAPI gen    |
| ASGI server          | **Uvicorn** with `--workers N`      | Production-grade; matches current LLM setup                  |
| DB driver            | **`asyncpg`**                       | Fastest async Postgres driver in Python; raw SQL fits current style |
| HTTP client          | **`httpx.AsyncClient`** (shared)    | Async; HTTP/2; connection pooling                            |
| Validation           | **Pydantic v2**                     | FastAPI native; replaces Zod                                 |
| JWT/JWKS             | **`pyjwt[crypto]`** + manual JWKS cache | Direct equivalent of current Node `crypto` + cache impl |
| Settings             | **`pydantic-settings`**             | Type-safe env parsing; replaces `src/config/env.ts`          |
| Logging              | stdlib `logging` + structlog (optional) | Scoped logger pattern matching current Node `createLogger` |
| Package management   | **`uv`** (or `pip` + `requirements.txt`) | `uv` is faster; either works. Decision in §11.          |
| Linter/formatter     | `ruff` + `ruff format`              | One tool, fast                                               |
| Type checker         | `mypy` (CI only, not required to merge) | Same posture as backend TS strict mode                   |

---

## 6. Target directory layout

```
apps/backend/                       # repurposed — was Node, now Python
├── app/
│   ├── __init__.py
│   ├── main.py                     # FastAPI app + lifespan (DB pool, HTTP client, JWKS)
│   ├── config.py                   # pydantic-settings; replaces env.ts
│   ├── logger.py                   # scoped logger factory
│   ├── db/
│   │   ├── __init__.py
│   │   ├── pool.py                 # asyncpg pool singleton
│   │   ├── migrate.py              # migration runner (port of migrate.ts)
│   │   └── migrations/             # SQL files copied verbatim from current backend
│   ├── auth/
│   │   ├── __init__.py
│   │   ├── nervesparks.py          # JWKS fetch + cache + RS256 verify
│   │   ├── deps.py                 # FastAPI deps: require_auth, require_auth_unless_public_customer_dashboard
│   │   └── proxy.py                # /auth/login etc. — proxies upstream NerveSparks
│   ├── routes/
│   │   ├── __init__.py
│   │   ├── dashboards.py
│   │   ├── resources.py
│   │   ├── customers.py
│   │   ├── execute.py
│   │   └── assistant.py            # calls llm.chat directly (no HTTP)
│   ├── executors/
│   │   ├── __init__.py
│   │   ├── rest.py
│   │   ├── db.py
│   │   └── agent.py
│   ├── llm/                        # absorbed from apps/llm-service/app/
│   │   ├── __init__.py
│   │   ├── gemini.py
│   │   ├── openai.py
│   │   ├── chat.py
│   │   ├── variants.py
│   │   ├── prompts.py
│   │   ├── archetypes.py
│   │   ├── component_capabilities.py
│   │   ├── design_enrichment.py
│   │   ├── schemas.py
│   │   └── tools.py
│   ├── schemas/                    # Pydantic request/response models per route
│   │   ├── dashboards.py
│   │   ├── resources.py
│   │   └── ...
│   └── utils/
│       ├── __init__.py
│       ├── swagger_parser.py       # port of utils/swaggerParser.ts
│       └── env_secret.py           # resolveEnvSecret() equivalent
├── tests/                          # pytest — minimal smoke tests
│   ├── test_health.py
│   ├── test_auth.py
│   └── test_dashboards_crud.py
├── pyproject.toml                  # or requirements.txt — see §11
├── Dockerfile                      # rewritten for Python
└── .env.example
```

The directory `apps/llm-service/` is deleted at cutover (its content lives in `apps/backend/app/llm/`).

---

## 7. Performance requirements

These are **hard requirements**, not nice-to-haves. The previous Python attempt was rejected for being slow. Every line of code we write must respect these.

### Mandatory practices

| Rule                                                                       | Why                                                              |
| -------------------------------------------------------------------------- | ---------------------------------------------------------------- |
| **Every route handler is `async def`**                                     | Sync handlers block the event loop                               |
| **Every DB call uses `asyncpg`**, never `psycopg` sync                     | Sync DB calls block; asyncpg is the fastest async option         |
| **One `asyncpg.Pool`** created in `lifespan`, never per-request            | Connection churn destroys throughput                             |
| **One `httpx.AsyncClient`** at app scope, injected via dep                 | Creating a Client per request adds ~10ms of overhead each        |
| **JWKS cached in-memory** with 6h TTL (matches current Node impl)          | Fetching JWKS on every request is ~50–200ms                      |
| **LLM is in-process**, not HTTP                                            | Eliminates ~5–20ms HTTP hop per LLM call                         |
| **No `time.sleep` / `requests` / `urllib`** in async code paths            | Blocking calls inside async = stalled event loop                 |
| **Use `asyncio.gather`** for independent DB queries (e.g. customers list + dashboards list) | Latency reduces from O(n) to O(1) for parallelizable work |
| **Uvicorn with `--workers $(nproc)` in production** (no `--reload`)       | Single-worker dev = good; single-worker prod = bottleneck        |

### Performance budget (acceptance criteria for cutover)

Measured against `apps/backend` Node on the same machine, same DB, same data:

| Endpoint                              | Node baseline | Python target |
| ------------------------------------- | ------------- | ------------- |
| `GET  /health`                        | ≤ 10 ms p99   | ≤ 10 ms p99   |
| `GET  /api/v1/dashboards` (50 rows)   | x ms p99      | ≤ 1.10 × x    |
| `POST /api/v1/execute` (REST passthrough) | x ms p99  | ≤ 1.10 × x    |
| `POST /api/v1/assistant/chat`         | x ms p99      | ≤ 0.95 × x (faster — no HTTP hop) |

Method: 200-iteration `wrk` or `bombardier` runs against the Node and Python builds, same machine, same warm cache. The Node numbers are captured in step 8.0 before any Python work starts.

---

## 8. Execution plan (phased)

### Phase 0 — Pre-flight (½ day)

- [ ] **Branch off:** `git checkout -b feature/backend-python-v2`
- [ ] **Review `backend/python` branch.** `git diff feature/backend-P2..origin/backend/python -- apps/backend-py` (or wherever the prior attempt lives). Write down 2-3 specific things that made it slow. **Do not start coding until this is done.**
- [ ] **Capture Node baselines.** Run `bombardier`/`wrk` against the running Node stack for the endpoints in §7's budget table. Save numbers to `docs/perf-baseline-node.md`.
- [ ] Confirm `pyjwt[crypto]` can validate a real NerveSparks JWT in a 10-line script. (De-risks the auth port early.)

**Exit criteria:** Performance baseline captured, prior-attempt postmortem written, JWT validation proof-of-concept passing.

### Phase 1 — Skeleton (½ day)

- [ ] Create `apps/backend/app/` directory tree (per §6).
- [ ] `pyproject.toml` / `requirements.txt` with deps: `fastapi`, `uvicorn[standard]`, `asyncpg`, `httpx`, `pyjwt[crypto]`, `pydantic`, `pydantic-settings`, `python-dotenv`, `python-multipart` (for file uploads), `google-generativeai`, `openai`.
- [ ] `main.py` with FastAPI app, lifespan startup/shutdown (creates DB pool + HTTP client + warms JWKS cache).
- [ ] `GET /health` route returning `{ "status": "ok", "db": "connected" }` after a `SELECT 1`.
- [ ] `config.py` (BaseSettings) mirroring the Node `env.ts`.
- [ ] `logger.py` with `create_logger("scope")` returning a `logging.Logger` configured with the scope prefix and `LOG_LEVEL` env var.

**Exit criteria:** `uvicorn app.main:app` boots, `/health` returns 200, no warnings.

### Phase 2 — Auth (1 day)

This is the highest-risk piece. Do it first so all subsequent routes can lean on a known-good auth dependency.

- [ ] Port `apps/backend/src/auth/nervesparks.ts` → `app/auth/nervesparks.py`:
  - JWKS fetch via shared `httpx.AsyncClient`
  - In-memory cache with 6h TTL (replicates current behavior)
  - RS256 verification via `pyjwt`
  - `iss`, `aud`, `token_type` claim checks identical to current Node logic
- [ ] `app/auth/deps.py`:
  - `require_auth` FastAPI dependency
  - `require_auth_unless_public_customer_dashboard` (mirrors current Node middleware that exempts `GET /:slug/dashboard`)
- [ ] `app/auth/proxy.py` — the `/auth/{login,register,refresh,logout}` proxy to upstream NerveSparks.
- [ ] Mount routes at **both `/api/v1/auth` and `/api/auth`** (current Node mounts both).

**Exit criteria:**
- `curl -H "Authorization: Bearer <real-token>" /api/v1/auth/me` returns the profile.
- `curl /api/v1/auth/login -d ...` round-trips through the proxy.
- Invalid token → 401 with same error shape as Node.

### Phase 3 — Database layer (½ day)

- [ ] `app/db/pool.py` — singleton `asyncpg.Pool` created in lifespan, max_size tuned (start at 20).
- [ ] `app/db/migrate.py` — port of `apps/backend/src/db/migrate.ts`. Reads `migrations/*.sql` files in numeric order, applies inside a single transaction with `executemany` (or one transaction per file — match Node behavior).
- [ ] Copy all 10 SQL files from `apps/backend/src/db/migrations/` to `app/db/migrations/`. **No SQL changes.**
- [ ] CLI entry point: `python -m app.db.migrate`.

**Exit criteria:** `python -m app.db.migrate` against a fresh DB produces the same schema as `npm run migrate -w @btb/backend`. Verify with `pg_dump --schema-only` diff.

### Phase 4 — Routes, in dependency order (3–4 days)

Port routes in the order they unblock each other. Each route's exit criteria is "same JSON shape, same status codes as Node for happy + error paths."

1. **`resources.py`** — no dependency on other routes. Includes the `/import-swagger` endpoint and bulk INSERT. (440 lines TS → ~500 lines Python.)
2. **`customers.py`** — independent. Includes the slug→dashboard public endpoint. Make sure `requireAuthUnlessPublicCustomerDashboard` is wired correctly.
3. **`dashboards.py`** — depends on customers (assignments). Port the dedicated-client transaction with UNNEST bulk insert pattern from current Node code.
4. **`executors/`** — REST, DB, Agent. Used by `execute.py`. The Agent executor (184 lines, polling logic) is the most complex.
5. **`execute.py`** — file uploads via `python-multipart`. Fire-and-forget query log writes use `asyncio.create_task`.
6. **`assistant.py`** — calls `app.llm.chat.run_chat(...)` directly. No HTTP hop. This is where we expect a measurable latency win.

Test each route with `curl` against the Python build and compare byte-for-byte with the same call against the Node build.

**Exit criteria:** All 6 route files ported. A scripted smoke-test (`scripts/parity-check.sh` — see §9) passes against both backends.

### Phase 5 — LLM consolidation (½ day)

- [ ] `git mv apps/llm-service/app/* apps/backend/app/llm/`. History preserved.
- [ ] Adjust imports: every `from .gemini_client` → `from .gemini` (or keep names — just decide and be consistent).
- [ ] Make `run_chat`, `generate_variants` etc. **`async def`** if not already. The current LLM service has sync handlers (a known issue called out in `RESTRUCTURE.md` deferred tasks) — fix during the move.
- [ ] Replace any `requests.post` with `httpx.AsyncClient` calls using the shared app-scoped client.
- [ ] Delete `apps/llm-service/` once nothing imports from it.

**Exit criteria:** `/api/v1/assistant/chat` returns identical body shape to current Node→Python HTTP chain. LLM module has no sync I/O calls.

### Phase 6 — Docker & Compose (½ day)

- [ ] New `apps/backend/Dockerfile`:
  ```dockerfile
  FROM python:3.12-slim AS runner
  WORKDIR /app
  COPY apps/backend/requirements.txt ./
  RUN pip install --no-cache-dir -r requirements.txt
  COPY apps/backend/app ./app
  EXPOSE 3001
  CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "3001", "--workers", "2"]
  ```
- [ ] `docker-compose.yml`:
  - Remove the standalone `llm` service.
  - Keep `backend` service but switch its Dockerfile to the new one.
  - Drop `LLM_SERVICE_URL` env (no longer needed).
  - Backend now needs `GEMINI_API_KEY`, `OPENAI_API_KEY` (currently in `apps/llm-service/.env`).
- [ ] Move env vars from `apps/llm-service/.env` into `apps/backend/.env`.
- [ ] Update `apps/frontend/nginx.conf` — no change needed; still proxies `/api` to `backend:3001`.
- [ ] Update root `package.json` workspaces: remove `apps/backend` from `apps/*` glob (it's no longer Node). Or keep the glob but accept that npm install on the root will skip it because no `package.json` exists in `apps/backend`.

**Exit criteria:** `docker compose up --build` starts 4 services (postgres, pgadmin, backend, frontend) instead of 5. Frontend works end-to-end.

### Phase 7 — Performance validation (½ day)

- [ ] Re-run the Phase 0 `bombardier`/`wrk` benchmark against the Python build.
- [ ] Compare numbers to `docs/perf-baseline-node.md`.
- [ ] **If any endpoint exceeds 1.10× the Node baseline, STOP and profile.** Do not merge until budget is met. Most likely culprits if you see regressions: sync code path leaked in somewhere, missing DB index, JWKS not actually cached.
- [ ] Save final numbers to `docs/perf-final-python.md`.

**Exit criteria:** Every endpoint within performance budget. Numbers checked into the repo.

### Phase 8 — Cutover (½ day)

- [ ] Open PR `feature/backend-python-v2 → feature/backend-P2` (or main).
- [ ] In the PR description, link to the baseline + final perf docs.
- [ ] Manual smoke test on a clean clone: clone, `.env` setup, `docker compose up --build`, exercise every user-facing flow (login, create dashboard, generate, assistant chat, file upload, customer view).
- [ ] Merge.
- [ ] Tag the last Node commit on `main` as `node-backend-final` so we can always check out the old implementation.

---

## 9. Parity testing (scripted)

`scripts/parity-check.sh` — runs the same curl against both backends and diffs the JSON. Run after every route port.

```bash
#!/usr/bin/env bash
set -euo pipefail

NODE_BASE=${NODE_BASE:-http://localhost:3001}
PY_BASE=${PY_BASE:-http://localhost:3002}     # python backend on temp port during overlap
TOKEN=${TOKEN:?set TOKEN to a valid bearer}

endpoints=(
  "GET  /health"
  "GET  /api/v1/dashboards"
  "GET  /api/v1/resources"
  "GET  /api/v1/customers"
)

for ep in "${endpoints[@]}"; do
  method=${ep%% *}; path=${ep##* }
  node=$(curl -s -X "$method" -H "Authorization: Bearer $TOKEN" "$NODE_BASE$path" | jq -S .)
  py=$(curl -s -X "$method" -H "Authorization: Bearer $TOKEN" "$PY_BASE$path" | jq -S .)
  if [[ "$node" != "$py" ]]; then
    echo "DIFF on $ep"; diff <(echo "$node") <(echo "$py"); exit 1
  fi
  echo "OK    $ep"
done
```

---

## 10. Rollback

The Node backend is preserved on its own branch (`feature/backend-P2` or whichever the current branch is) and tagged at cutover. To roll back:

```bash
git revert <merge-commit>           # if already merged
# or
git checkout node-backend-final     # the tag created at cutover
docker compose up --build           # uses the Node Dockerfile
```

Postgres schema is unchanged → no DB rollback needed.

---

## 11. Open questions (need answers before Phase 1)

1. **Package manager.** `uv` is faster and modern. `pip + requirements.txt` is simpler and matches `apps/llm-service/`. **Recommend: `uv` with a `pyproject.toml`.** Confirm or override.
2. **LLM HTTP endpoints — keep or drop?** The current LLM service exposes `/generate` and `/chat` for direct testing. After migration, these aren't needed (the assistant + dashboard generate routes call Python functions internally). **Recommend: drop them.** They can be re-added behind a dev flag if useful.
3. **Reuse from `backend/python` branch.** Skim and steal what works (especially anything that already handles trickier ports like the swagger parser). **Recommend: review during Phase 0, copy carefully, but treat the branch as reference material, not a starting point.**
4. **Tests.** Current Node backend has zero tests. We can either keep that posture or add minimal pytest smoke coverage during Phase 4. **Recommend: add 8–10 high-value smoke tests** (auth required, happy path on each route, one error path per route). Not a TDD push; just safety net.
5. **Run during overlap.** Should the Python backend run on a different port (e.g. 3002) during development so we can hit both for parity checks, then swap to 3001 at cutover? **Recommend: yes — Python on 3002 until Phase 8, then flip docker-compose.**

---

## 12. Risk register

| Risk                                                       | Likelihood | Impact | Mitigation                                                                            |
| ---------------------------------------------------------- | ---------- | ------ | ------------------------------------------------------------------------------------- |
| Performance regression (the reason the last attempt failed) | High      | High   | §7 mandatory practices + Phase 0 baseline + Phase 7 gate                              |
| Subtle auth behavior difference breaking the frontend       | Medium    | High   | Phase 2 done first; parity script in §9                                               |
| asyncpg type-coercion differences vs `pg`                   | Medium    | Medium | Pin asyncpg version; explicit `::jsonb` / `::uuid[]` casts in SQL (already done in current code) |
| Multipart file upload edge cases (size limit, mime sniffing) | Low      | Medium | `python-multipart` with explicit max size config; smoke test with the same 50 MB file Node tests against |
| Lifespan startup races (DB not ready when first request hits) | Low     | Low    | Healthcheck in compose + asyncpg pool `min_size=2` warms eagerly                      |
| Date/time serialization diffs (ISO 8601 micro vs millis)    | Medium    | Low    | Add an explicit JSON encoder for `datetime` → ISO with milliseconds, matching JS `toISOString()` |

---

## 13. Total estimate

| Phase                        | Days  |
| ---------------------------- | ----- |
| 0 — Pre-flight               | 0.5   |
| 1 — Skeleton                 | 0.5   |
| 2 — Auth                     | 1.0   |
| 3 — DB layer                 | 0.5   |
| 4 — Routes                   | 3–4   |
| 5 — LLM consolidation        | 0.5   |
| 6 — Docker & Compose         | 0.5   |
| 7 — Performance validation   | 0.5   |
| 8 — Cutover                  | 0.5   |
| **Total**                    | **7–8 working days** |

This is for one engineer working full-time. Add buffer for context switching, code review, and the inevitable Phase 4 surprises.

---

## 14. Definition of done

- [ ] All 6 Node route files ported and parity-checked.
- [ ] Auth middleware ported and verified against real NerveSparks tokens.
- [ ] LLM service folded into `app/llm/`; `apps/llm-service/` deleted.
- [ ] All endpoints meet the performance budget in §7.
- [ ] `docker compose up --build` brings up a working stack from a clean clone (4 containers, not 5).
- [ ] Frontend unchanged and working end-to-end.
- [ ] Migrations run via `python -m app.db.migrate`.
- [ ] README updated to reflect the Python backend.
- [ ] Old Node code removed in the same PR (no dead trees in the repo).
- [ ] Tag `node-backend-final` placed on the last Node commit.
