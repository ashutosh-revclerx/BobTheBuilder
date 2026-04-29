# Roadmap — toward the LLM-driven dashboard generator

This is the working plan for what to build next. Ordered by sprint, ordered within each sprint by what unblocks what. Treat this as the single source of truth for "what's next." Update checkboxes as items ship.

---

## End goal (the north star)

> A user lands on the site, types what dashboard they want (with optional docs link / GitHub URL / available resources), an LLM produces 3-4 candidate configs that differ in colour scheme + layout, the user picks one, and they can fine-tune it in the existing visual builder before publishing it to a customer URL.

Everything in this document either moves us toward that goal or removes a manual workaround that would otherwise hold it back.

---

## Sprint 1 — close the Postman gap (≈ 1 day)

Replace every Postman-only workflow that survives in the LLM era. Without these, even after the LLM works the engineer still has to drop into Postman to publish a dashboard — which kills the demo.

### 1.1 Customers — done (no standalone page needed)

Decision: skip the standalone `/customers` index page — assignment via dashboard cards covers the whole engineer flow. Customers nav link removed.

- [x] **Create** customer flow via AssignmentModal
- [x] **Assign / unassign** dashboard ↔ customer (many-to-many via `dashboard_assignments`)
- [x] Live link on dashboard card → opens `/c/<slug>` in new tab
- [x] Backend `GET /api/dashboards` returns `assigned_customers[]`, **now unions both legacy `customers.dashboard_id` and new `dashboard_assignments`** so pre-migration data still surfaces
- [x] Backend `GET /api/dashboards/:id/customers` and `POST /api/dashboards/:id/assign`
- [x] Customers nav link removed (assignment-via-card is the canonical flow)
- ~~Standalone `/customers` page~~ — deferred indefinitely; user flow doesn't require it
- ~~Customer-detail edit modal (brand colour, logo)~~ — folded into Sprint 2 brand config when LLM-generated dashboards need branding

### 1.2 Manual resource form on `/resources` — done

- [x] "+ Add resource" button at the top of "All resources" → toggles inline form
- [x] Fields: `name`, `type` (REST / agent / postgresql), `base_url` (REST/agent only), `auth_type`, `secret_ref`
- [x] Conditional fields: base_url hides for postgresql; auth_type hides for postgresql; secret_ref label changes to "Connection string" for postgresql
- [x] Client-side validation matches backend Zod rules (name required; base_url required for REST/agent; secret_ref required when auth_type ≠ none)
- [x] Submit → `POST /api/resources`, refresh list, success banner

### 1.3 Publish toggle in builder top bar — done

- [x] `PublishToggle` component in builder top bar showing current status (`draft` ↔ `live`)
- [x] Backend `PATCH /api/dashboards/:id/publish` route + `published_at` timestamp
- [x] `dashboardStatus` + `publishedAt` in editorStore
- [x] Customer routing now joins on `status = 'live'` — drafts don't render to `/c/<slug>`
- [x] `loadTemplate()` accepts `status` + `published_at` so the toggle reflects DB state on open
- [ ] (Polish) Customer view shows a friendly "Not published yet" placeholder instead of generic 404 when the dashboard exists but is draft

### 1.4 (Shipped)
- [x] Unified `TopNav` across DashboardList, ResourcesPage, TemplateGallery (CSS restored after merge)
- [x] "Open live" pill on dashboard cards
- [x] Many-to-many dashboard ↔ customer (was 1-to-1 before)
- [x] Brand wordmark links to home in TopNav

---

## Sprint 2 — the LLM intake → templates loop (≈ 1 week)

**Architecture (decided with senior):** the LLM lives in a **separate Python microservice** (FastAPI), not embedded in the Node backend. **Provider: Gemini** (company API key already available).

```
   Browser
      │  POST /api/dashboards/generate
      ▼
   Node backend (apps/backend)
      │   - looks up resources + their resource_endpoints
      │   - builds the prompt context
      │   - proxies to →
      ▼
   Python LLM service (apps/backend/services/llm)        ← NEW
      │   - calls Gemini API
      │   - validates response against dashboard schema
      │   - retries on schema-invalid output
      ▼
   Returns N candidate configs to Node → forwarded to browser
```

Why a separate service:
- LLM workloads (long-lived requests, schema validation, prompt iteration) don't fit Node's single-threaded model well.
- Python has the strongest LLM ecosystem (pydantic for schema validation, native Gemini SDK, easy prompt experimentation).
- Independent scaling/redeploy — prompt changes don't require restarting the dashboard backend.
- Clean boundary: Node owns "the platform," Python owns "the LLM."

### 2.1 Python LLM service — `apps/backend/services/llm/` ← **done (v1)**

- [x] Bootstrap a FastAPI app (folder `apps/backend/services/llm/`)
- [x] Env: `GEMINI_API_KEY`, `GEMINI_MODEL`, `LLM_SERVICE_PORT` (default 8000)
- [x] Endpoint `POST /generate`:
  ```json
  {
    "prompt": "I want a dashboard for tracking scrape jobs",
    "resources": [
      { "id": "...", "name": "nexus-scrape", "type": "REST", "base_url": "...",
        "endpoints": [ { "method": "GET", "path": "/public/batches", "summary": "..." } ] }
    ],
    "docsUrls": [],
    "variantCount": 1
  }
  ```
- [x] Returns `{ success, configs: [{ name, config }] }` (variant array)
- [x] System prompt v2: dashboard schema, per-component-type required fields, `{{ }}` binding rules with 5 examples, layout patterns, **and a complete worked example** (URL-scraper dashboard)
- [x] Gemini called with `response_mime_type: "application/json"` — `response_schema` deliberately NOT used (incompatible with our open-ended `dict[str, Any]` style/data fields; pydantic post-validation covers it)
- [x] Pydantic post-validation + 1-shot retry with the error message attached
- [x] `/health` endpoint
- [x] Dockerfile + `apps/backend/services/llm` entry in `docker-compose.yml` (with hot-reload via volume mount)
- [x] Prompt versioning constant (`SYSTEM_PROMPT_VERSION`) for future A/B
- [x] Programmatic variant generator (`variants.py`) — palette swaps without extra LLM calls
- [x] Archetype classifier (`archetypes.py`) to infer dashboard type from prompt
- [x] Archetype + confidence injected into LLM prompt before generation
- [x] System prompt upgraded to UX-focused v3 (data flow + component relationship constraints)

### 2.2 Node proxy route — `/api/dashboards/generate` ← **done**

- [x] New thin route in `apps/backend/src/routes/dashboards.ts`
- [x] Loads referenced resources from DB + their `resource_endpoints` rows (single SQL with jsonb_agg)
- [x] Calls `POST {LLM_SERVICE_URL}/generate` with the enriched payload
- [x] Returns candidate configs to the browser; **does NOT save** to `dashboards` table
- [x] Reads `LLM_SERVICE_URL` from env (default `http://localhost:8000`)
- [x] 60s AbortController timeout + clear error mapping (502 on upstream fail, 504 on timeout)
- [ ] (Polish) Cap total prompt size in tokens — currently caps endpoints at 60 per resource in the Python service

### 2.3 Intake page (`/new`) ← **done**

- [x] Multi-line textarea + 3 example prompts as one-click chips
- [x] Multi-select cards of registered resources (from `/api/resources`)
- [x] Optional docs URL input (newline or comma separated)
- [x] Variant count picker (1-4)
- [x] Submit → calls Node's `/api/dashboards/generate`
- [x] Loading state with "(5-30s)" hint
- [x] On error → red banner with the LLM error
- [x] On success → stash in sessionStorage, redirect to `/new/pick`

### 2.4 Template picker page (`/new/pick`) ← **done (v1)**

- [x] Reads candidate configs from sessionStorage (kept out of URL — too big)
- [x] Renders a grid of preview cards
- [x] Each card shows: variant name, component+query count, and a **mini layout sketch** that renders each component as a positioned block in a 12-col grid using the variant's actual palette
- [x] Click a card → POST `/api/dashboards` with chosen config (status: draft) → redirect to `/builder/<id>`
- [x] "Try a different prompt" button returns to `/new`
- [ ] (Polish v2) Inline "Regenerate" button instead of going back — call `/generate` with the same params

### 2.5 Variant generation strategy (start simple)

For v1, "variants" means **same components & queries, different palette + minor layout tweaks**. Rationale: getting the LLM to produce 4 *functionally* different dashboards from one prompt is unreliable; getting it to vary colours + spacing while keeping the data plumbing identical is trivial.

- [x] Step 1: Python service asks Gemini for ONE config
- [x] Step 2: Python service programmatically derives N-1 more variants by swapping colour palette + minor layout shuffles (no extra LLM calls — saves cost + time)
- [ ] Future: have Gemini generate genuinely different layouts via temperature variation

### 2.6 UX generation quality hardening ← **in progress**

- [x] Dashboard archetype classification step wired into /generate`r
- [x] Archetype-specific layout guidance injected into prompt context
- [x] Added stricter data-flow constraints in system prompt
- [ ] Add post-generation validator for archetype layout conformance
- [ ] Upgrade variants beyond palette-only (Overview / Detailed / Visual profiles)

---

## Sprint 3 — polish, validation, debugging (≈ 2-3 days, do as needed)

Catches LLM mistakes; makes power users productive.

### 3.1 Inline validation in builder
- [ ] Highlight components whose `dbBinding` references a query that doesn't exist in `queriesConfig`
- [ ] Highlight queries whose `resource` doesn't exist in `/api/resources`
- [ ] Highlight `{{...}}` paths that resolve to `undefined` at render time
- [ ] Right-panel "issues" tab listing all problems with click-to-jump

### 3.2 JSON editor pane
- [ ] Collapsible side pane in the builder showing the live JSON config
- [ ] Edits in the JSON sync to the visual builder (and vice versa)
- [ ] Schema-aware autocomplete (Monaco?)

### 3.3 Resource secrets management
- [ ] In the resource form, when `auth_type ≠ none`, show which env var the `secret_ref` points to
- [ ] If env var isn't set on the backend, show a warning ("`NEXUS_API_KEY` not found in process.env")

---

## What we are NOT building (and why)

| Skipped | Reason |
|---|---|
| Phase 3.13 — migrate Phase 0 templates into the full builder | Once LLM generation works, hand-curated templates are obsolete. The "templates" page can stay for legacy. |
| Phase 3.12 — mobile preview toggle in the builder | Cosmetic, deferred until Phase 4. |
| Phase 4 entirely — white-label / mobile / themes / domains | No customer asking for it yet. Defer until paying users. |
| Phase 5 entirely — auth, roles, rate limits, load testing | Production hardening — defer until usage volume justifies it. |
| "Create dashboard from raw JSON" UI | The LLM replaces this. Building a paste-JSON form is throwaway. |
| "Edit dashboard JSON" UI | The visual builder + Save (which now PUTs) covers this. |

---

## Order of operations — what to do next

**Sprint 1 + Sprint 2 are functionally complete.** Demo path now is:

> Open `/` → click **✨ Generate** → describe the dashboard + pick which resources the LLM can use → wait 5-30s while Gemini drafts a config → land on `/new/pick` with 4 colour-palette variants → click one → land in `/builder/<id>` → fine-tune → toggle **Publish** to live → back on `/` click **Assign** → pick a customer → click the live `/c/<slug>` pill.

Zero Postman, zero hand-written JSON.

Sprint 2 is in progress. Next up:
1. Add post-generation validation for archetype/layout/data-flow checks
2. Upgrade variant transforms beyond palette swaps
3. Run prompt-quality smoke tests on representative prompts
### Sprint 3 — polish and dependability (next)

In rough priority order:

1. **Sprint 3.1 inline validation in builder** — flag broken `dbBinding` references, missing query resources, dangling `{{...}}` paths. Catches bad LLM output before the user hits Save.
2. **"Not published yet" placeholder** on the customer view (Sprint 1.3 leftover, ~30 min)
3. **"Regenerate" on the picker page** — re-call `/generate` with the same prompt + resources, no need to retype.
4. **Token / size cap** on the LLM prompt (Sprint 2.2 leftover) — reject prompts whose hydrated context would blow Gemini's window.
5. **Sprint 3.2 JSON editor pane** in the builder — collapsible side pane with the live config, bidirectionally synced.
6. **Sprint 3.3 resource secret diagnostics** — warn when `secret_ref` points to an env var that isn't set.

After Sprint 3 the platform is feature-complete for v1. Beyond that, Phase 4 (white-label/mobile) and Phase 5 (auth/hardening) are deferred until paying users justify the effort.

---

## Decisions locked in

- **LLM provider:** Gemini (company API key available)
- **Service shape:** separate Python FastAPI microservice at `apps/backend/services/llm/`, called by Node via HTTP
- **API key location:** `GEMINI_API_KEY` in the **Python service's** env, never in Node's env, never in the browser
- **Schema enforcement:** Gemini JSON mode (`response_schema`) → pydantic post-validation → 1 retry with error context if invalid

## Still to decide for Sprint 2 completion

- Cost ceiling per generate call — cache or rate-limit?
- Should the LLM service be in the same docker-compose as Postgres + pgAdmin, or a sibling repo?
- Which Gemini model — `gemini-2.0-flash` (cheap/fast, good for variants) or `gemini-2.5-pro` (smarter, better for one-shot complex configs)?


- **LLM provider:** Gemini (company API key in `services/llm/.env`)
- **Model:** `gemini-2.5-flash` (configurable via `GEMINI_MODEL` env)
- **Service shape:** separate Python FastAPI microservice at `services/llm/`, called by Node via HTTP at `LLM_SERVICE_URL`
- **API key location:** `GEMINI_API_KEY` in the **Python service's** env only
- **Compose:** added to root `docker-compose.yml` — one `docker compose up` brings everything
- **Schema enforcement:** prompt + `response_mime_type=application/json` + pydantic post-validation + 1 repair retry. Dropped Gemini's `response_schema` because it's incompatible with our open-ended `style`/`data` dict fields (the SDK's schema translator crashes on `dict[str, Any]`).

## Still open

- Cost ceiling per generate call — cache or rate-limit?
- Token budget cap on the prompt (currently the Python service caps endpoints at 60 per resource, but no overall token check)
- "Regenerate" button on the picker page that re-calls `/generate` with the same prompt
