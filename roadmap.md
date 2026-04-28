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

The actual value-creation flow.

### 2.1 Backend `/api/dashboards/generate`

- [ ] New route accepting:
  ```json
  {
    "prompt": "I want a dashboard for tracking scrape jobs",
    "resourceIds": ["uuid", "uuid"],
    "docsUrls": ["https://..."],
    "variantCount": 4
  }
  ```
- [ ] Loads referenced resources + their `resource_endpoints` rows
- [ ] Builds a system prompt that includes:
  - The full dashboard JSON schema (lift from `example.md`)
  - List of available endpoints for each resource (method + path + summary)
  - The binding conventions cheatsheet (`{{ }}` rules)
  - The user's free-form prompt
- [ ] Calls Claude API with structured output / function calling so the response is guaranteed schema-valid JSON
- [ ] Returns N candidate `config` objects — does NOT save anything
- [ ] Caps prompt size — reject if all-resources context exceeds N tokens

### 2.2 Intake page (`/new`)

- [ ] Big multi-line textarea: "What dashboard do you want?"
- [ ] Multi-select of registered resources (cards from `/api/resources`)
- [ ] Optional: docs URL input (one or many)
- [ ] Submit button → calls `/api/dashboards/generate`
- [ ] Loading state with progress (LLM calls take 5-30s)
- [ ] On error → show banner with the LLM error or retry button

### 2.3 Template picker page

- [ ] Receives the N candidate configs from `/new`
- [ ] Renders a grid of N "preview cards" — each shows name + a thumbnail-ish render of the components (or just the colour palette + layout sketch for v1)
- [ ] Click a card → POST `/api/dashboards` with the chosen config → redirect to `/builder/<id>` for fine-tuning
- [ ] "Regenerate" button at the top to re-call the LLM with a tweaked prompt

### 2.4 Variant generation strategy (start simple)

For v1, "variants" means **same components & queries, different palette + minor layout tweaks**. Rationale: getting the LLM to produce 4 *functionally* different dashboards from one prompt is unreliable; getting it to vary colours + spacing while keeping the data plumbing identical is trivial.

- [ ] Step 1: LLM generates ONE config
- [ ] Step 2: backend programmatically derives 3 variants by swapping colour palette + minor layout shuffles (no LLM needed)
- [ ] Future: have LLM generate genuinely different layouts

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

Sprint 1 is **complete** — zero Postman in the engineer flow. Demo path:

> Open `/` → click **+ New Dashboard** → land in builder → drag components → wire queries via Query Bindings → toggle **Publish** to live → back on `/` click **Assign** on the card → pick / create a customer → click the live `/c/<slug>` pill → see it render.

Optional polish before Sprint 2 (none are blockers):
1. **Sprint 1.3 polish** — friendly "Not published yet" placeholder on customer view when dashboard exists but is draft (~30 min)
2. Smoke test the full demo path on a fresh DB to make sure nothing regressed during the merge

Then start **Sprint 2.1** (backend `/api/dashboards/generate` route — the LLM call).

---

## Open questions to answer before Sprint 2

- **LLM provider** — Claude API (Anthropic SDK) or OpenAI? Rec: Claude, since you're already using Claude Code and the prompt-engineering knowledge transfers.
- **Where does the API key live?** New env var `ANTHROPIC_API_KEY` in `apps/backend/.env`, never sent to frontend (same pattern as resource secrets).
- **Cost ceiling per generate call** — should we cache or rate-limit?
- **Schema enforcement** — use Anthropic's tool-use to force a schema-valid response, or post-validate with Zod and retry on failure? Rec: tool-use + Zod fallback.
