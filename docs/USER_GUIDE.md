# BTB — User Guide

A no-code dashboard builder. Connect a backend → drop components on a canvas → publish to your customers.

---

## 1. What you can build

A **dashboard** = a grid of **components** wired to **queries** that talk to your **resources** (backends).

- **Components** — visual elements: charts, tables, stat cards, inputs, buttons, chat, file upload, knowledge graphs (18 total).
- **Queries** — saved API calls that fetch data and populate components.
- **Resources** — your registered backends: REST APIs, async agent APIs, or PostgreSQL databases.

---

## 2. First-time setup

### Step 1 — Register your backend (one-time)

Open **Resources** in the top nav.

**Option A — import from Swagger/OpenAPI (recommended):**

1. Paste the Swagger JSON URL (e.g. `https://api.example.com/openapi.json`).
2. Type a short **Resource name** — this is what queries will reference.
3. Set the **Base URL** (no trailing slash).
4. Choose **Resource type**:
   - `REST` — request/response, returns data immediately.
   - `agent` — kicks off a job, returns `jobId`, you poll for the result.
5. (Agent only) Set **Poll URL template** if your API doesn't return a `poll_url` field in the kickoff response. Example: `/v1/jobs/{{jobId}}/result`.
6. (If auth required) Choose **Auth type** and paste the **Secret value** (literal API key — stored in DB, never returned by the API).
7. Click **Import Endpoints**.

The system pulls every endpoint from your spec into the EndpointPicker dropdown.

**Option B — add manually:**

Click **+ Add resource**. Fill in the same fields. You won't get the endpoint dropdown — you'll type paths by hand. Works for APIs without Swagger docs.

### Step 2 — Create a dashboard

**Dashboard List → New Dashboard.** Pick a template (Blank or one of the prebuilts) → opens the **builder**.

---

## 3. Building a dashboard (no AI)

### Drag a component

Left sidebar shows all components. Drag any onto the canvas. Resize and reposition by dragging the edges.

### Wire it to data

1. **Click the component.** Right sidebar opens with three tabs: **Style / Data / Settings**.
2. Open **Data**.
3. In **Query bindings**:
   - **Pick a resource** — dropdown of everything you've registered.
   - **Pick an endpoint** — autocomplete from imported Swagger endpoints (or type if manual).
   - **Method** — auto-fills from the endpoint, edit if needed.
   - **Trigger** —
     - `onLoad` — fires when the dashboard opens (use for read-only display).
     - `manual` — fires only when a button click triggers it.
     - `onDependencyChange` — re-fires whenever a referenced input changes.
   - **Request Payload (JSON)** — appears for POST/PUT/PATCH. Write the body with `{{...}}` placeholders for dynamic values (see § 5).
4. **Click a Quick-Bind chip** (orange/green/blue pills) — this fills in the component's display binding automatically. Without this step the component won't render the response.
5. Save (Ctrl+S or the toolbar save button).

### Wire a Button to fire a query

Buttons don't display data — they trigger queries. Two steps:

1. Configure the query (same way as above) — usually with `trigger: manual`.
2. Click the **`→ Manual Trigger`** chip. This sets the button's `dbBinding` so clicking it fires the query.

---

## 4. Building a dashboard (with AI)

**Generate page → type a prompt → pick the resources to expose → click Generate.**

The LLM (Gemini → OpenAI fallback) reads your prompt + your imported endpoints and produces 4 variant dashboards. Pick one, edit if needed, save.

**Prompt tips:**

- Name your resource and required fields explicitly:
  > "Use the `nexus-scrape` resource. The `/v1/person-lookup` endpoint expects `{name, organization}` — NOT `company`."
- Describe layout sections in order, top to bottom.
- Tell it which endpoints to use vs ignore.
- After generation, always **check the Data tab** of each component — the LLM gets ~85% right; the last 15% is form tweaks.

---

## 5. Binding syntax (placeholders)

Anywhere you can type a value, you can drop a **`{{...}}` placeholder** that resolves at runtime.

### Three namespaces

| Pattern | What it returns |
|---|---|
| `{{queries.<name>.data}}` | The response body of a query (after `responseTransformer` runs) |
| `{{queries.<name>.data.users[0].name}}` | Drill into nested fields with dot/bracket notation |
| `{{queries.<name>.isLoading}}` | `true` while the query is in flight |
| `{{queries.<name>.error}}` | Error string, or `null` |
| `{{components.<id>.value}}` | Current value of a TextInput / Select / NumberInput |
| `{{componentState.<id>.<key>}}` | Special per-component state — e.g. `componentState.upload-zone.sessionId` |

### Where placeholders work

- Component display value (`data.dbBinding`)
- Query `endpoint` (path templating, e.g. `/users/{{components.input.value}}`)
- Query `body` (JSON with embedded placeholders)
- Query `pollUrlTemplate` (uses `{{jobId}}`)
- Boolean expressions (e.g. `data.disabled = "{{queries.users.isLoading}}"`)

### Expression form

For boolean checks, you can write small JS expressions:

```
{{queries.users.data.length > 0}}
{{!!componentState.upload-zone.sessionId}}
{{components.input.value || 'default'}}
```

Anything with spaces / operators is evaluated as JS over the store. Keep it simple — broken expressions fail silently.

---

## 6. Saving credentials (API keys)

Resources page → click **Edit** on a resource → **Secret value** field:

- **Recommended:** paste the **raw key** directly. Stored in Postgres, never returned by `GET /resources`.
- **Advanced:** use `{{env.MY_KEY}}` to point at a backend `.env` variable. Useful when one secret backs many resources.

The Auth type dropdown decides where the secret goes:

| Auth type | Header sent to upstream |
|---|---|
| `bearer` | `Authorization: Bearer <secret>` |
| `api_key` | `X-API-Key: <secret>` |
| `basic` | `Authorization: Basic base64(<secret>)` |
| `none` | (nothing) |

---

## 7. Publishing for customers

Dashboards have two states: **draft** and **live**.

1. In the builder, toggle the **Publish** switch — dashboard becomes `live` and gets a `published_at` timestamp.
2. Assign one or more **Customers** to it via the **Assign** button (Dashboard List page).
3. Each customer has an **access token** (auto-generated, shown on the Customers page). They access their dashboard at:
   ```
   https://<your-domain>/c/<customer-slug>?token=<their-token>
   ```
4. Token can be rotated (`Rotate token`) or cleared (open access — anyone with the slug).

---

## 8. Common workflows

### Add a search input + result table

1. Drop a **TextInput** (id `search-input`).
2. Drop a **Button** (id `btn-search`).
3. Drop a **Table** (id `result-table`).
4. Wire the Table → query → `GET /api/search?q={{components.search-input.value}}`, trigger `manual`.
5. On the Button, click the orange **Manual Trigger** chip pointing at the same query.
6. Bind the Table's display: click the green **Bind Data** chip.

### Upload a file → show results

1. Drop a **FileUpload** (id `uploader`).
2. **Data** tab → pick the resource → pick the upload endpoint (must be POST multipart).
3. Set **Form field name** to whatever the upstream expects (`file`, `files`, etc — check Swagger).
4. (Async backends only) Set the **Progress endpoint**: `/api/v1/progress/{{componentState.uploader.sessionId}}`.
5. Drop a **Table** or **NodeGraph** to display results — bind it to a separate query that uses `{{componentState.uploader.sessionId}}` in its endpoint.

### Chain queries (B fires after A)

1. Query A fires onLoad.
2. Query B's endpoint contains `{{queries.A.data.id}}` (a reference to A's result).
3. The runtime auto-detects the dependency. Set B's trigger to `onDependencyChange` — it fires when A resolves.

---

## 9. Troubleshooting

| Symptom | Likely cause | Fix |
|---|---|---|
| Component shows nothing | Quick-Bind chip never clicked | Data tab → click the green/blue chip |
| Button click does nothing | `dbBinding` not set | Data tab → click the orange **Manual Trigger** chip |
| 422 / "Field required" from upstream | Wrong body field names | Open upstream's `/docs` Swagger, copy the field names exactly |
| Agent query 404s on poll | `poll_url_template` not set | Resources page → Edit → fill in **Poll URL template** with `{{jobId}}` |
| FileUpload 400 "No files in request" | Form field name mismatch | Data tab → Show advanced → **Form field name** must match upstream |
| 401 on `/execute` | Bearer token expired | Hard refresh — auto-refresh flow re-issues from refresh token |
| Live data not showing in `live` dashboard | Customer has no `access_token` set, or token is wrong in URL | Customers page → Rotate token, copy fresh URL |

---

## 10. Glossary

| Term | Meaning |
|---|---|
| **Dashboard** | One page of components + queries, identified by a unique slug |
| **Component** | Visual element on the canvas (Table, Button, Chart, etc.) |
| **Resource** | Registered backend (REST / agent / PostgreSQL) |
| **Query** | Saved API call wired to one or more components |
| **Trigger** | `onLoad` / `manual` / `onDependencyChange` — decides when a query fires |
| **Binding** | `{{...}}` placeholder that resolves at runtime |
| **Quick-Bind chip** | Pill button in the Data tab that auto-fills bindings |
| **Customer** | An end-user account assigned to one dashboard, accessed via a slug + optional token |
| **Publish** | Toggle a dashboard from `draft` to `live` — only live dashboards are visible to customers |
