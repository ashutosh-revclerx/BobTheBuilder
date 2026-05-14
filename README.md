# BTB — Dashboard Builder Platform

A no-code dashboard builder where customers connect REST/SQL data sources and an LLM assistant generates ready-to-edit dashboard layouts. Built-in component library covers charts, tables, file uploads, chat, knowledge graphs, and more.

---

## Table of Contents

- [Architecture](#architecture)
- [Tech Stack](#tech-stack)
- [Repository Layout](#repository-layout)
- [Prerequisites](#prerequisites)
- [Quick Start (Docker)](#quick-start-docker)
- [Local Development (without Docker)](#local-development-without-docker)
- [Environment Variables](#environment-variables)
- [Database & Migrations](#database--migrations)
- [Authentication](#authentication)
- [API Surface](#api-surface)
- [Component Library](#component-library)
- [Deployment](#deployment)
- [Troubleshooting](#troubleshooting)
- [Contributing](#contributing)

---

## Architecture

```
                       ┌─────────────────────────────┐
                       │  Browser (SPA: React 19)    │
                       └──────────────┬──────────────┘
                                      │ /api/v1/*
                                      ▼
                       ┌─────────────────────────────┐
                       │  nginx :80                  │  (Frontend container)
                       │  - Serves Vite build        │
                       │  - Proxies /api → backend   │
                       └──────────────┬──────────────┘
                                      │
                                      ▼
                       ┌─────────────────────────────┐
                       │  FastAPI + Uvicorn :3001    │  (Backend container)
                       │  - JWT auth (NerveSparks)   │
                       │  - REST/SQL/Agent executors │
                       │  - In-process LLM module    │
                       └────┬─────────────────┬──────┘
                            │                 │
                            ▼                 ▼
                ┌────────────────────┐ ┌──────────────────────┐
                │ Postgres 16 :5432  │
                │ - dashboards       │
                │ - resources        │
                │ - customers        │
                │ - query_logs       │
                └────────────────────┘
```

Each container is independently deployable. The frontend is a static bundle; the Python backend is stateless and includes the LLM generation module in-process.

---

## Tech Stack

| Layer       | Technology                                                      |
| ----------- | --------------------------------------------------------------- |
| Frontend    | React 19, TypeScript, Vite, Zustand, TailwindCSS, React Router  |
| Charting    | Recharts, React Grid Layout, XyFlow (knowledge graphs)          |
| Backend     | Python 3.12, FastAPI, Uvicorn, asyncpg, httpx                   |
| LLM module  | In-process Gemini SDK with OpenAI fallback                      |
| Database    | PostgreSQL 16                                                   |
| Auth        | NerveSparks JWT (RS256, JWKS-verified)                          |
| Container   | Docker, Docker Compose                                          |

---

## Repository Layout

```
BTB/
├── backend/                     # FastAPI API + in-process LLM (port 3001)
│   ├── app/
│   │   ├── routes/              # FastAPI route handlers
│   │   ├── executors/           # REST / DB / Agent query executors
│   │   ├── auth/                # NerveSparks JWT verification (JWKS)
│   │   ├── db/                  # asyncpg pool + migrations
│   │   ├── llm/                 # Gemini/OpenAI generation and assistant
│   │   └── main.py              # FastAPI entry point
│   ├── requirements.txt
│   └── Dockerfile
├── frontend/                    # React SPA (served via nginx, port 80)
│   ├── src/
│   │   ├── pages/               # Top-level routed views
│   │   ├── components/          # Editor, preview, UI primitives
│   │   │   └── dashboard-components/    # 18 user-facing widgets
│   │   ├── engine/              # Query/binding resolution engine
│   │   ├── store/               # Zustand state (editorStore.ts)
│   │   ├── services/            # API clients (assistant, export)
│   │   ├── config/              # API base URL + auth token mgmt
│   │   ├── shared/              # Shared TypeScript types (Zod schemas)
│   │   └── templates/           # Dashboard templates
│   ├── nginx.conf               # Production nginx config
│   └── Dockerfile
├── scripts/
│   └── run-workspaces.mjs       # Concurrent backend + frontend dev runner
├── docker-compose.yml           # Full-stack orchestration
├── .dockerignore
├── .gitignore
├── package.json                 # Root orchestration scripts
└── README.md
```

---

## Prerequisites

| Tool           | Version  | Required for                       |
| -------------- | -------- | ---------------------------------- |
| Docker         | ≥ 24.0   | Docker-based runs (recommended)    |
| Docker Compose | v2 (`docker compose`, not `docker-compose`) | "                                  |
| Node.js        | 22.x LTS | Frontend dev/build                 |
| npm            | ≥ 10     | Frontend dependency management     |
| Python         | 3.12     | Local backend without Docker       |

API keys you will need:

- **Gemini API key** — primary LLM provider
- **OpenAI API key** — fallback (optional but recommended)
- **NerveSparks credentials** — auth (existing tenant or new signup)

---

## Quick Start (Docker)

This is the canonical way to run the project. Everything is reproducible from a clean clone.

### 1. Clone and configure

```bash
git clone <repo-url> BTB
cd BTB
```

### 2. Create `.env` files

**`backend/.env`** (copy from `.env.example`; Docker Compose overrides `DATABASE_URL` automatically):

```env
DATABASE_URL=postgresql://dashboard_user:dashboard_pass@localhost:5432/dashboard_db
PORT=3001
LOG_LEVEL=info
GEMINI_API_KEY=<your-gemini-key>
GEMINI_MODEL=gemini-2.5-flash
OPENAI_API_KEY=<your-openai-key>
OPENAI_MODEL=gpt-4o-mini
# CORS_ORIGIN=https://app.yourdomain.com   # required in production
```

### 3. Run migrations (one-time)

Bring up Postgres only, then apply migrations from the host:

```bash
docker compose up postgres -d
cd backend
pip install -r requirements.txt
python -m app.db.migrate
```

> Migrations live in `backend/app/db/migrations/` and are applied in numeric order. They are idempotent — re-running is safe.

### 4. Start the full stack

```bash
docker compose up --build
```

First build takes 3–5 minutes. Subsequent starts are fast (cached layers).

### 5. Open the app

| Service       | URL                                         |
| ------------- | ------------------------------------------- |
| **Frontend**  | http://localhost                            |
| Backend API   | http://localhost:3001/health                |
| pgAdmin       | http://localhost:5050 (`admin@example.com` / `admin`) |

### Common Docker commands

```bash
# Detached mode + follow logs for one service
docker compose up --build -d
docker compose logs -f backend

# Rebuild a single service after code changes
docker compose up --build frontend

# Stop everything
docker compose down

# Stop + delete DB volume (DESTRUCTIVE — wipes all data)
docker compose down -v
```

---

## Local Development (without Docker)

Use this for the fastest inner-loop feedback (hot reload, no rebuilds).

### Prerequisites

- Postgres running locally on `:5432` (or use `docker compose up postgres -d`)
- Python 3.12 with a virtualenv for the backend

### Start everything

```bash
cd backend
python -m venv .venv
source .venv/bin/activate            # Windows: .venv\Scripts\Activate.ps1
pip install -r requirements.txt
python -m app.db.migrate             # one-time
cd ../frontend
npm install                          # one-time
cd ..
npm run dev                          # runs Python backend + frontend concurrently
```

Frontend: http://localhost:5143 · Backend: http://localhost:3001

---

## Environment Variables

### Backend (`backend/.env`)

| Variable               | Default                                    | Description                                    |
| ---------------------- | ------------------------------------------ | ---------------------------------------------- |
| `DATABASE_URL`         | _(required)_                               | Postgres connection string                     |
| `PORT`                 | `3001`                                     | HTTP listener                                  |
| `LLM_TIMEOUT_MS`       | `180000`                                   | Generation request timeout                     |
| `LLM_CHAT_TIMEOUT_MS`  | `60000`                                    | Chat (assistant) request timeout               |
| `GEMINI_API_KEY`       | _(required)_                               | Primary LLM provider                           |
| `GEMINI_MODEL`         | `gemini-2.5-flash`                         | Gemini model name                              |
| `OPENAI_API_KEY`       | _(optional)_                               | Fallback when Gemini fails                     |
| `OPENAI_MODEL`         | `gpt-4o-mini`                              | Fallback model name                            |
| `CORS_ORIGIN`          | `*`                                        | Restrict in production                         |
| `LOG_LEVEL`            | `info`                                     | `debug` \| `info` \| `warn` \| `error`         |
| `NEXUS_API_KEY`        | _(optional)_                               | Used by resources whose `secret_ref` references it |

### Frontend build args

| Variable                    | Default                                | Description                                                 |
| --------------------------- | -------------------------------------- | ----------------------------------------------------------- |
| `VITE_API_BASE_URL`         | `/api/v1` (relative, proxied by nginx) | Set to absolute URL only when API lives on a different origin |
| `VITE_DEV_API_PROXY_TARGET` | `http://127.0.0.1:3001`                | Used by Vite dev server only                                |

> **Never commit `.env` files.** Only `.env.example` files are tracked. `.env` is in `.gitignore` at every level.

---

## Database & Migrations

Migrations live in `backend/app/db/migrations/` as numbered SQL files and run in order via:

```bash
cd backend
python -m app.db.migrate
```

**Current schema (migration sequence):**

| File                                       | Purpose                                          |
| ------------------------------------------ | ------------------------------------------------ |
| `001_create_dashboards.sql`                | Core dashboards table (JSONB config)             |
| `002_create_resources.sql`                 | REST/SQL/Agent data sources                      |
| `003_create_customers.sql`                 | End-user customer accounts                       |
| `004_create_query_logs.sql`                | Audit log of executed queries                    |
| `005_customers_updates.sql`                | Brand config + slug columns                      |
| `006_customers_dashboard_fk_set_null.sql`  | FK behavior change                               |
| `007_create_resource_endpoints.sql`        | Swagger-imported endpoints catalog               |
| `008_publish_flow_updates.sql`             | Draft/live status + `published_at`               |
| `009_create_dashboard_assignments.sql`     | Many-to-many customer↔dashboard                  |
| `010_add_access_token_to_customers.sql`    | Token-gated customer dashboard access            |

**Adding a new migration:**

1. Create `backend/app/db/migrations/0NN_description.sql`.
2. Write idempotent SQL (`CREATE TABLE IF NOT EXISTS`, `ALTER TABLE ... ADD COLUMN IF NOT EXISTS`).
3. Run `python -m app.db.migrate` locally from `backend`.
4. Commit the file. Run the migration command before deploying the new backend image.

---

## Authentication

The backend verifies **RS256 JWTs issued by NerveSparks** (https://auth.nervesparks.com) using JWKS fetched at startup and cached for 6 hours.

- Issuer: `auth-gateway`
- Access token audience: `auth-gateway-access`
- Refresh token audience: `auth-gateway-refresh`

**Public routes** (no auth required):

- `GET /health`
- `POST /api/v1/auth/login`, `register`, `refresh`, `logout`
- `GET /api/v1/customers/:slug/dashboard` (customer-facing view; gated by per-customer `access_token` instead)

**Protected routes** require `Authorization: Bearer <access_token>`. Tokens are stored in `localStorage` by the frontend (`apiFetch` wrapper handles automatic refresh on 401).

Route mounting in `backend/app/main.py`:

```python
for api_prefix in ("/api/v1", "/api"):
    ...
```

---

## API Surface

All endpoints prefixed with `/api/v1` (also `/api` for backwards compatibility).

| Resource      | Endpoints                                                                 |
| ------------- | ------------------------------------------------------------------------- |
| Auth          | `POST /auth/{login,register,refresh,logout}`                              |
| Dashboards    | `GET/POST/PUT/DELETE /dashboards`, `PATCH /:id/publish`, `POST /:id/assign`, `POST /generate` |
| Resources     | `GET/POST/PUT/DELETE /resources`, `POST /import-swagger`, `GET /:id/endpoints` |
| Customers     | `GET/POST/PUT/DELETE /customers`, `GET /:slug/dashboard`, `POST /:id/rotate-token` |
| Execute       | `POST /execute` — runs a saved query against its bound resource           |
| Assistant     | `POST /assistant/chat` — calls the in-process LLM module                   |

Backend OpenAPI/Swagger UI is available at http://localhost:3001/docs.

---

## Component Library

Dashboard widgets in `frontend/src/components/dashboard-components/`:

| Category   | Components                                                |
| ---------- | --------------------------------------------------------- |
| Display    | StatCard, Text, StatusBadge, Image, Embed                 |
| Charts     | BarChart, LineChart                                       |
| Tables     | Table, LogsViewer                                         |
| Inputs     | TextInput, NumberInput, Select, Button                    |
| Layout     | Container, TabbedContainer                                |
| Interactive| ChatBox, FileUpload, NodeGraph                            |

Each component:

1. Defines its props in TypeScript interfaces co-located with the file.
2. Is registered in `src/config/renderRegistry.tsx`.
3. Reads its bound query result from the `editorStore` (Zustand).
4. Supports the `{{queries.<name>.<field>}}` binding syntax.

See [docs/component-addition.md](docs/component-addition.md) for the full workflow of adding a new component.

---

## Deployment

### Production Docker

The provided `docker-compose.yml` is suitable for single-host deployments. For multi-host / cloud deployments:

1. **Build and push images** to your registry:
   ```bash
   docker build -t your-registry/btb-frontend:$(git rev-parse --short HEAD) \
     -f frontend/Dockerfile \
     --build-arg VITE_API_BASE_URL=https://api.yourdomain.com/api/v1 .
   docker build -t your-registry/btb-backend:$(git rev-parse --short HEAD) \
     -f backend/Dockerfile .
   ```
2. **Run migrations** as a one-off job before deploying the new backend image.
3. **Set production env vars**:
   - `CORS_ORIGIN=https://app.yourdomain.com`
   - `LOG_LEVEL=info`
   - Managed Postgres `DATABASE_URL`
4. **Place a TLS-terminating reverse proxy** (Cloudflare, ALB, nginx) in front of the frontend container.

### Scaling notes

- **Frontend** is stateless — scale horizontally with a CDN in front.
- **Backend** is stateless — scale horizontally; Postgres connection pool size is per-instance.
- **Postgres** — use a managed offering (RDS, Cloud SQL) with read replicas for analytics. Bottlenecks tend to appear on `query_logs` writes; consider partitioning by month if log volume is high.

---

## Troubleshooting

| Symptom                                              | Likely cause / fix                                                                 |
| ---------------------------------------------------- | ---------------------------------------------------------------------------------- |
| `bind: Only one usage of each socket address`        | A local `npm run dev` is already using the port. Kill the process or change the port mapping. |
| Frontend loads but API calls 404                     | `VITE_API_BASE_URL` was baked in incorrectly at build time. Rebuild with the correct value. |
| Backend exits with "no pg_hba.conf entry"            | Postgres isn't accepting connections from the container network. Ensure the `postgres` service is healthy. |
| LLM `502` errors                                     | Missing/invalid `GEMINI_API_KEY` or `OPENAI_API_KEY`. Check `docker compose logs backend`. |
| `401 Unauthorized` immediately after login           | JWKS cache may be stale. Restart backend.                                          |
| Migrations fail with "relation already exists"       | Migration was partially applied. Inspect the DB and either `DROP` the table or skip the file. |
| Frontend bundle very large                           | Run `npm run build -- --mode analyze` from `frontend/` to inspect chunks.          |

Logs are tagged by scope — filter with:

```bash
docker compose logs backend | grep '\[dashboards\]'
docker compose logs backend | grep '\[assistant\]'
```

---

## Contributing

### Branching

- `main` / `master` — protected, production
- `feature/<name>` — feature branches
- Open PRs against the appropriate base branch; squash-merge preferred.

### Code style

- TypeScript: strict mode is on for frontend/shared code. Do not weaken types to silence errors — narrow them.
- Backend routes are async FastAPI handlers using shared `asyncpg` and `httpx` resources; see `backend/app/routes/dashboards.py` as the reference style.
- Frontend components follow the `props → store binding → memoized render` pattern; see `frontend/src/components/dashboard-components/StatCard.tsx`.
- Logging: never use `console.*` in backend code — use `createLogger('<scope>')`.
- Errors: route handlers should return the same JSON shape/status codes the frontend expects.

### Commit messages

Follow conventional style where practical:

```
feat(dashboards): add bulk-publish endpoint
fix(assistant): handle empty conversation history
refactor(backend): centralize env parsing
```

### Pre-merge checklist

- [ ] `npm run build` passes from the repo root
- [ ] `npm run lint` passes
- [ ] New code paths covered by manual smoke test (UI flow or `curl` against the running stack)
- [ ] Migrations are idempotent
- [ ] Env vars added to `.env.example` AND to this README
- [ ] No `.env` files committed

---

## License

Proprietary — internal use only.
