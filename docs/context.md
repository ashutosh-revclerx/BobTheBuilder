# BobTheBuilder - Agent Context (Current Codebase)

> This document is the quick, accurate context for coding agents. It reflects the repository state as of 2026-05-15.

---

## 1) What This Project Is

BobTheBuilder is a config-driven dashboard builder platform:
- Engineers build dashboards in a visual editor (`/builder/:id`)
- Dashboards are saved in PostgreSQL as JSON config
- Queries execute through backend executors (REST, DB, agent)
- Customer-facing live dashboards are served by slug (`/c/:slug`) with optional access token gating
- LLM generation creates multiple dashboard variants from prompts (`/new` -> `/new/pick`)

---

## 2) Current Tech Stack (Actual)

- Frontend: React 19, TypeScript, Vite 8, Zustand, React Router, Recharts, react-grid-layout, Tailwind v4
- Backend: FastAPI (Python), asyncpg, httpx, Pydantic v2
- Auth: NerveSparks JWT + JWKS verification
- Database: PostgreSQL (migrations in `backend/app/db/migrations`)
- Runtime: Docker Compose for full-stack local run

Notes:
- Backend is Python/FastAPI (not Node/Express).
- `main.py` mounts both `/api/v1/*` and `/api/*` route prefixes.

---

## 3) Frontend Architecture

### Routes (`frontend/src/App.tsx`)
- Public:
  - `/login`
  - `/c/:slug`
- Protected (requires auth tokens):
  - `/` (Dashboard list)
  - `/templates`
  - `/builder/:id`
  - `/resources`
  - `/new`
  - `/new/pick`

### Key Frontend Modules
- `src/store/editorStore.ts`: primary state hub (components, queries, layout, preview, assistant, publish status)
- `src/engine/queryEngine.ts`: executes configured queries + dependency/reactive handling
- `src/engine/bindingResolver.ts`: resolves `queries.*` / `queryResults.*` / `components.*` bindings
- `src/components/editor/*`: builder shell, canvas/grid, side panels, assignment modal
- `src/components/dashboard-components/*`: renderable dashboard widgets
- `src/config/componentRegistry.ts`: component catalog metadata
- `src/config/renderRegistry.tsx`: runtime type -> React component mapping
- `src/services/exportService.ts`: export/eject runtime bundle

### Dashboard Components Present
- Display: `StatCard`, `Text`, `StatusBadge`, `Image`, `Embed`
- Charts: `BarChart`, `LineChart`
- Data/Logs: `Table`, `LogsViewer`
- Inputs/Actions: `TextInput`, `NumberInput`, `Select`, `Button`, `FileUpload`, `ChatBox`
- Layout: `Container`, `TabbedContainer`
- Graph: `NodeGraph`

---

## 4) Backend Architecture

### Entrypoint
- `backend/app/main.py`
  - Runs DB migrations at startup
  - Initializes DB pool + shared HTTP client
  - Warms JWKS cache
  - Registers route modules for `/api/v1` and `/api`

### Route Modules
- `routes/auth.py`: login/register/refresh/logout
- `routes/dashboards.py`: CRUD, publish, assign customers, AI generate
- `routes/resources.py`: resource CRUD, Swagger/OpenAPI import, endpoint browsing
- `routes/customers.py`: customer CRUD, token rotate/clear, public dashboard by slug
- `routes/execute.py`: secure query execution entrypoint
- `routes/assistant.py`: assistant chat/actions

### Executors
- `executors/rest.py`
- `executors/db.py`
- `executors/agent.py`

### LLM Modules
- `llm/facade.py`, `llm/chat.py`, `llm/prompts.py`, `llm/variants.py`, provider clients
- Variant generation is in-process (no separate LLM microservice in this repo layout)

---

## 5) Database State

Migrations currently present:
- `001_create_dashboards.sql`
- `002_create_resources.sql`
- `003_create_customers.sql`
- `004_create_query_logs.sql`
- `005_customers_updates.sql`
- `006_customers_dashboard_fk_set_null.sql`
- `007_create_resource_endpoints.sql`
- `008_publish_flow_updates.sql`
- `009_create_dashboard_assignments.sql`
- `010_add_access_token_to_customers.sql`
- `011_add_poll_url_template_to_resources.sql`

Key entities:
- `dashboards`
- `resources`
- `resource_endpoints`
- `customers`
- `dashboard_assignments`
- `query_logs`

---

## 6) Canonical User Flows (Implemented)

1. Engineer login -> dashboard list
2. Create/open dashboard -> builder edits config/layout/components/queries
3. Save dashboard to backend (draft/live status supported)
4. Assign one or more customers to dashboard
5. Publish dashboard
6. Customer opens `/c/:slug` (optionally token-gated) and sees live assigned dashboard
7. Optional AI flow: `/new` generate variants -> `/new/pick` -> open in builder

---

## 7) Ground Rules for Agents Working Here

- Treat backend FastAPI + frontend React as source of truth; ignore older phase docs when they conflict.
- Keep config schema and component props aligned across:
  - frontend types/store
  - renderer/binding logic
  - backend validation/execute contracts
- When adding components, update both registry layers (`componentRegistry` + `renderRegistry`) and editor tabs.
- Never expose secrets in frontend configs; resolve secrets on backend via env/secret refs.

---

## 8) Pointers

- Product overview and setup: `README.md`
- Detailed architecture notes: `docs/codebase-map.md`
- Usage guidance: `docs/USER_GUIDE.md`
- Component extension docs: `docs/component-addition.md`
- Example flows: `docs/example.md`