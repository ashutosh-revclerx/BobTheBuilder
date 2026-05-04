# Changes — 1 May 2026

## Bug Fixes

### 1. Query bindings lost on save/reload (Critical)

**Problem:** When you saved a dashboard (via the Save button or localStorage), the `queriesConfig` was silently dropped. On next load, all query bindings (resource, endpoint, body, trigger) were gone — making every Button click no-op with "query not found."

**Root cause:** Two bugs working together:

| Location | Bug |
|----------|-----|
| `BuilderPage.tsx:194` | When loading a hardcoded template (e.g. `nexus-operations`), `template.queries` was never passed to `loadTemplate()` — only `components` were forwarded |
| `editorStore.ts:saveToLocalStorage` | The `SavedTemplate` object omitted `queriesConfig` entirely — pressing Save would wipe queries from the persisted snapshot |

**Files changed:**

- **`apps/frontend/src/pages/BuilderPage.tsx`** — Pass `template.queries ?? []` as the 4th argument to `loadTemplate()` when loading from hardcoded templates
- **`apps/frontend/src/types/template.ts`** — Added `queries?: any[]` field to the `SavedTemplate` interface
- **`apps/frontend/src/store/editorStore.ts`** — Added `queries: clone(state.queriesConfig)` to the saved object in `saveToLocalStorage()`; cleaned up `as any` cast in `loadSavedTemplate()`

---

### 2. Agent executor polling 404 on person-lookup

**Problem:** The `/v1/person-lookup` endpoint in Nexus returns a `job_id` but no `poll_url`. The BTB agent executor was falling back to `/jobs/{id}` which doesn't exist, causing a `404 Not Found`.

**Fix:** Changed the fallback polling URL from `/jobs/{id}` to `/public/result/{id}` to match the Nexus API convention. Also added `result_url` as an additional field the executor checks in the kickoff response.

**Hardcoding note:** The fallback `/public/result/{id}` is still a Nexus-specific default. If a second agent service is added that uses a different result convention, its kickoff response **must** include a `poll_url` field. This is documented in the code comments.

**File changed:**
- **`apps/backend/src/executors/agentExecutor.ts`**

---

### 3. Better agent error diagnostics

**Problem:** When `fetch()` failed (e.g. server unreachable), the error message was a generic `"Agent kickoff failed: fetch failed"` with no indication of what URL was attempted.

**Fix:** The error now includes the target URL, e.g.:
`"Agent kickoff failed (http://124.123.18.150:9090/nexus-api/v1/person-lookup): fetch failed"`

Added a `console.log` on kickoff so the backend terminal also shows the URL being hit.

**File changed:**
- **`apps/backend/src/executors/agentExecutor.ts`**

---

## New Files

### Nexus Operations Template (Optional)

- **`apps/frontend/src/templates/nexus-operations.ts`** — Pre-built dashboard template with two workflows (URL Scraper + Person Lookup). Registered in `templates/index.ts`. This is purely a convenience template — the Nexus dashboard can also be built from scratch in the builder UI. Safe to delete if not needed.
