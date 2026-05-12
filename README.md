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
                       │  Node + Express :3001       │  (Backend container)
                       │  - JWT auth (NerveSparks)   │
                       │  - REST/SQL/Agent executors │
                       └────┬─────────────────┬──────┘
                            │                 │
                            ▼                 ▼
                ┌────────────────────┐ ┌──────────────────────┐
                │ Postgres 16 :5432  │ │ FastAPI LLM :8001    │
                │ - dashboards       │ │ - Gemini → OpenAI    │
                │ - resources        │ │   fallback chain     │
                │ - customers        │ └──────────────────────┘
                │ - query_logs       │
                └────────────────────┘
```

Each container is independently deployable. The frontend is a static bundle; backend and LLM service are stateless and horizontally scalable behind a load balancer.

---

## Tech Stack

| Layer       | Technology                                                      |
| ----------- | --------------------------------------------------------------- |
| Frontend    | React 19, TypeScript, Vite, Zustand, TailwindCSS, React Router  |
| Charting    | Recharts, React Grid Layout, XyFlow (knowledge graphs)          |
| Backend     | Node.js 22, Express 4, TypeScript, Zod 4                        |
| LLM service | Python 3.12, FastAPI, Uvicorn, Gemini SDK, OpenAI SDK           |
| Database    | PostgreSQL 16                                                   |
| Auth        | NerveSparks JWT (RS256, JWKS-verified)                          |
| Container   | Docker, Docker Compose                                          |
| Monorepo    | npm workspaces (`apps/*`, `packages/*`)                         |

---

## Repository Layout

```
BTB/
├── apps/
│   ├── backend/                 # Express API (port 3001)
│   │   ├── src/
│   │   │   ├── routes/          # Express route handlers
│   │   │   ├── executors/       # REST / DB / Agent query executors
│   │   │   ├── middleware/      # Auth, error handling
│   │   │   ├── auth/            # NerveSparks JWT verification (JWKS)
│   │   │   ├── config/          # Env parsing (single source of truth)
│   │   │   ├── db/              # Postgres pool + migrations
│   │   │   ├── utils/           # Logger, swagger parser, etc.
│   │   │   ├── app.ts           # Express app factory
│   │   │   └── server.ts        # Entry point
│   │   └── Dockerfile
│   ├── frontend/                # React SPA (served via nginx, port 80)
│   │   ├── src/
│   │   │   ├── pages/           # Top-level routed views
│   │   │   ├── components/      # Editor, preview, UI primitives
│   │   │   │   └── dashboard-components/    # 18 user-facing widgets
│   │   │   ├── engine/          # Query/binding resolution engine
│   │   │   ├── store/           # Zustand state (editorStore.ts)
│   │   │   ├── services/        # API clients (assistant, export)
│   │   │   ├── config/          # API base URL + auth token mgmt
│   │   │   └── templates/       # Dashboard templates
│   │   ├── nginx.conf           # Production nginx config
│   │   └── Dockerfile
│   └── llm-service/             # FastAPI LLM proxy (port 8001)
│       ├── app/
│       │   ├── main.py          # FastAPI app + endpoints
│       │   ├── chat.py          # /chat handler
│       │   ├── variants.py      # /generate handler (dashboard variants)
│       │   ├── gemini_client.py # Primary LLM provider
│       │   ├── openai_client.py # Fallback LLM provider
│       │   ├── prompts.py       # System prompts
│       │   ├── archetypes.py    # Dashboard layout archetypes
│       │   ├── schemas.py       # Pydantic request/response models
│       │   └── tools.py         # Tool definitions for assistant
│       ├── requirements.txt
│       └── Dockerfile
├── packages/
│   └── shared/                  # Shared TypeScript types (Zod schemas)
├── docs/                        # Internal design docs
├── scripts/
│   └── run-workspaces.mjs       # Multi-workspace dev runner
├── docker-compose.yml           # Full-stack orchestration
├── .dockerignore
├── .gitignore
├── package.json                 # Workspace root
└── README.md
```

---

## Prerequisites

| Tool           | Version  | Required for                       |
| -------------- | -------- | ---------------------------------- |
| Docker         | ≥ 24.0   | Docker-based runs (recommended)    |
| Docker Compose | v2 (`docker compose`, not `docker-compose`) | "                                  |
| Node.js        | 22.x LTS | Local dev without Docker           |
| npm            | ≥ 10     | Local dev without Docker           |
| Python         | 3.12     | Local LLM service without Docker   |

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

**`apps/llm-service/.env`** (copy from `.env.example` and fill in keys):

```env
GEMINI_API_KEY=<your-gemini-key>
GEMINI_MODEL=gemini-2.5-flash
OPENAI_API_KEY=<your-openai-key>
OPENAI_MODEL=gpt-4o-mini
LLM_SERVICE_PORT=8001
```

**`apps/backend/.env`** (used by both Docker and local dev — Docker Compose overrides `DATABASE_URL` and `LLM_SERVICE_URL` automatically):

```env
DATABASE_URL=postgresql://dashboard_user:dashboard_pass@localhost:5432/dashboard_db
PORT=3001
LLM_SERVICE_URL=http://localhost:8001
LOG_LEVEL=info
# CORS_ORIGIN=https://app.yourdomain.com   # required in production
```

### 3. Run migrations (one-time)

Bring up Postgres only, then apply migrations from the host:

```bash
docker compose up postgres -d
npm install
npm run migrate -w @btb/backend
```

> Migrations live in `apps/backend/src/db/migrations/` and are applied in numeric order. They are idempotent — re-running is safe.

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
| LLM service   | http://localhost:8001/docs (FastAPI docs)   |
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
- Python 3.12 with a virtualenv for the LLM service

### Start everything

```bash
npm install
npm run migrate -w @btb/backend     # one-time
npm run dev                          # runs backend + frontend concurrently
```

The LLM service runs separately:

```bash
cd apps/llm-service
python -m venv .venv
source .venv/bin/activate            # Windows: .venv\Scripts\Activate.ps1
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8001
```

Frontend: http://localhost:5143 · Backend: http://localhost:3001 · LLM: http://localhost:8001

---

## Environment Variables

### Backend (`apps/backend/.env`)

| Variable               | Default                                    | Description                                    |
| ---------------------- | ------------------------------------------ | ---------------------------------------------- |
| `DATABASE_URL`         | _(required)_                               | Postgres connection string                     |
| `PORT`                 | `3001`                                     | HTTP listener                                  |
| `LLM_SERVICE_URL`      | `http://localhost:8001`                    | FastAPI service URL                            |
| `LLM_TIMEOUT_MS`       | `180000`                                   | Generation request timeout                     |
| `LLM_CHAT_TIMEOUT_MS`  | `60000`                                    | Chat (assistant) request timeout               |
| `CORS_ORIGIN`          | `*`                                        | Restrict in production                         |
| `LOG_LEVEL`            | `info`                                     | `debug` \| `info` \| `warn` \| `error`         |
| `NEXUS_API_KEY`        | _(optional)_                               | Used by resources whose `secret_ref` references it |

### Frontend build args

| Variable                    | Default                                | Description                                                 |
| --------------------------- | -------------------------------------- | ----------------------------------------------------------- |
| `VITE_API_BASE_URL`         | `/api/v1` (relative, proxied by nginx) | Set to absolute URL only when API lives on a different origin |
| `VITE_DEV_API_PROXY_TARGET` | `http://127.0.0.1:3001`                | Used by Vite dev server only                                |

### LLM service (`apps/llm-service/.env`)

| Variable           | Default                  | Description                          |
| ------------------ | ------------------------ | ------------------------------------ |
| `GEMINI_API_KEY`   | _(required)_             | Primary LLM provider                 |
| `GEMINI_MODEL`     | `gemini-2.5-flash`       | Model name                           |
| `OPENAI_API_KEY`   | _(optional)_             | Fallback when Gemini fails           |
| `OPENAI_MODEL`     | `gpt-4o-mini`            | Fallback model name                  |
| `LLM_SERVICE_PORT` | `8001`                   | HTTP listener                        |

> **Never commit `.env` files.** Only `.env.example` files are tracked. `.env` is in `.gitignore` at every level.

---

## Database & Migrations

Migrations live in `apps/backend/src/db/migrations/` as numbered SQL files and run in order via:

```bash
npm run migrate -w @btb/backend
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

1. Create `apps/backend/src/db/migrations/0NN_description.sql`.
2. Write idempotent SQL (`CREATE TABLE IF NOT EXISTS`, `ALTER TABLE ... ADD COLUMN IF NOT EXISTS`).
3. Run `npm run migrate -w @btb/backend` locally.
4. Commit the file. The Docker setup runs it on next `npm run migrate` from the host.

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

Route mounting in `apps/backend/src/app.ts`:

```ts
mountApi('/api/v1');   // canonical
mountApi('/api');      // alias for legacy paths
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
| Assistant     | `POST /assistant/chat` — proxied to LLM service                           |

OpenAPI/Swagger UI for the **LLM service** is available at http://localhost:8001/docs.

---

## Component Library

Dashboard widgets in `apps/frontend/src/components/dashboard-components/`:

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
     -f apps/frontend/Dockerfile \
     --build-arg VITE_API_BASE_URL=https://api.yourdomain.com/api/v1 .
   docker build -t your-registry/btb-backend:$(git rev-parse --short HEAD) \
     -f apps/backend/Dockerfile .
   docker build -t your-registry/btb-llm:$(git rev-parse --short HEAD) \
     ./apps/llm-service
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
- **LLM service** is stateless but rate-limited by upstream provider quotas.
- **Postgres** — use a managed offering (RDS, Cloud SQL) with read replicas for analytics. Bottlenecks tend to appear on `query_logs` writes; consider partitioning by month if log volume is high.

---

## Troubleshooting

| Symptom                                              | Likely cause / fix                                                                 |
| ---------------------------------------------------- | ---------------------------------------------------------------------------------- |
| `bind: Only one usage of each socket address`        | A local `npm run dev` is already using the port. Kill the process or change the port mapping. |
| Frontend loads but API calls 404                     | `VITE_API_BASE_URL` was baked in incorrectly at build time. Rebuild with the correct value. |
| Backend exits with "no pg_hba.conf entry"            | Postgres isn't accepting connections from the container network. Ensure the `postgres` service is healthy. |
| LLM `502` errors                                     | Missing/invalid `GEMINI_API_KEY` or `OPENAI_API_KEY`. Check `docker compose logs llm`. |
| `401 Unauthorized` immediately after login           | JWKS cache may be stale. Restart backend.                                          |
| Migrations fail with "relation already exists"       | Migration was partially applied. Inspect the DB and either `DROP` the table or skip the file. |
| Frontend bundle very large                           | Run `npm run build -w @btb/frontend -- --mode analyze` to inspect chunks.          |

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

- TypeScript: strict mode is on. Do not weaken types to silence errors — narrow them.
- Backend routes follow the `safeParse → query → respond` pattern; see `apps/backend/src/routes/dashboards.ts` as the reference style.
- Frontend components follow the `props → store binding → memoized render` pattern; see `apps/frontend/src/components/dashboard-components/StatCard.tsx`.
- Logging: never use `console.*` in backend code — use `createLogger('<scope>')`.
- Errors: route handlers must `try/catch` and return JSON with `{ error }`. Never let an async error propagate to the default Express handler.

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
