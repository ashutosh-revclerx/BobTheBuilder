# How to build a dashboard end-to-end

This walks through the *full* loop the platform supports today, from registering a backend API to seeing live data render in a customer-facing URL. It's written from real debugging — every gotcha called out is one we actually hit.

> **The mental model:** an engineer registers backend resources → defines a JSON dashboard config (components + queries) → assigns the dashboard to a customer → the customer opens `/c/:slug` and sees a read-only rendering with live data.

---

## 1. Start the stack

From repo root:

```
docker compose up -d                           # postgres + pgadmin
cd apps/backend && npm run migrate && npm run dev
cd apps/frontend && npm run dev
```

Sanity check: `curl http://localhost:3001/health` → `{"status":"ok","db":"connected"}`.

---

## 2. Register a resource (the backend the dashboard will talk to)

A resource is "a registered API the platform is allowed to call". Three flavours:

| `type`        | When to use                                            |
| ------------- | ------------------------------------------------------ |
| `REST`        | Any plain HTTP API                                     |
| `agent`       | Long-running async job (POST → poll for completion)    |
| `postgresql`  | Direct DB access (read-only, regex + `BEGIN READ ONLY`)|

### Two ways to register

**Manual (one endpoint at a time):**
```
POST http://localhost:3001/api/resources
{
  "name": "dummyjson",
  "type": "REST",
  "base_url": "https://dummyjson.com",
  "auth_type": "none"
}
```

**Bulk via Swagger / OpenAPI:** if the API publishes a swagger doc, point the importer at it and every endpoint becomes an entry in `resource_endpoints`:
```
POST http://localhost:3001/api/resources/import-swagger
{
  "swaggerUrl":   "https://petstore.swagger.io/v2/swagger.json",
  "resourceName": "petstore",
  "baseUrl":      "https://petstore.swagger.io/v2",
  "authType":     "none"
}
```
Response: `{ success: true, resource: {...}, endpointsImported: 20 }`.

#### Two field names that are easy to confuse

| Field         | Meaning                                       | Example                       |
|---------------|-----------------------------------------------|-------------------------------|
| `auth_type`   | *kind* of auth — enum                         | `none` / `bearer` / `api_key` / `basic` |
| `secret_ref`  | env-var placeholder, never the raw key        | `{{env.NEXUS_API_KEY}}`       |

Putting the actual API key in the request body works but defeats the security model — the secret ends up in the database. Always use `{{env.VAR_NAME}}` and add the value to `apps/backend/.env`.

#### Gotcha — Swagger URL ≠ Swagger UI URL

`http://api.example.com/docs` is usually the *HTML* Swagger UI page. The importer needs the JSON behind it:
- `/docs.json`, `/openapi.json`, `/v3/api-docs`, `/swagger.json`, `/api-docs`

If you get `Invalid Swagger/OpenAPI format`, view-source the docs page and grep for `swagger.json` / `openapi.json`.

---

## 3. Build the dashboard config

A dashboard is just a JSON document with two arrays:

```json
{
  "components": [...],   // what to render and where
  "queries":    [...]    // what HTTP/SQL calls to make
}
```

Components reference queries by name. Queries reference resources by name. The whole config gets stored in `dashboards.config` (jsonb).

### A minimum working dashboard

Search input → button → results table. POST this and you get a live dashboard:

```json
{
  "name": "Product Browser",
  "slug": "product-browser",
  "status": "live",
  "config": {
    "components": [
      {
        "id":    "search-input",
        "type":  "TextInput",
        "label": "Search products",
        "layout": { "x": 0, "y": 0, "w": 4, "h": 4 },
        "data":  { "placeholder": "phone, laptop…", "type": "Text" }
      },
      {
        "id":    "btn-search",
        "type":  "Button",
        "label": "🔎 Search",
        "layout": { "x": 0, "y": 4, "w": 4, "h": 3 },
        "data":  { "dbBinding": "queries.searchProducts.trigger" }
      },
      {
        "id":    "products-table",
        "type":  "Table",
        "label": "Products",
        "layout": { "x": 4, "y": 0, "w": 8, "h": 18 },
        "data": {
          "dbBinding": "{{queries.searchProducts.data.products}}",
          "columns": [
            { "name": "ID",    "fieldKey": "id" },
            { "name": "Title", "fieldKey": "title" },
            { "name": "Price", "fieldKey": "price" }
          ],
          "searchable": true,
          "pagination": true
        }
      }
    ],
    "queries": [
      {
        "name":     "searchProducts",
        "resource": "dummyjson",
        "endpoint": "/products/search",
        "method":   "GET",
        "trigger":  "manual",
        "params":   { "q": "{{componentState.search-input.value}}" }
      }
    ]
  }
}
```

POST it:
```
POST http://localhost:3001/api/dashboards
```
Copy the returned `id` — you'll need it for the customer.

### The binding rules that bit us

The engine has **two** string conventions, used in different places. This was the single biggest source of "nothing happens" debugging:

| Used by                                | Format                      | Why                                  |
|----------------------------------------|-----------------------------|--------------------------------------|
| Button → query trigger                 | `"queries.X.trigger"`       | `parseQueryName()` reads the literal string to find the query to fire. **No braces.** |
| Table / StatCard / LogsViewer (data)   | `"{{queries.X.data}}"`      | The binding resolver only swaps strings wrapped in `{{ }}`. **Braces required.** |
| Endpoint URL with substitution         | `"/posts/{{componentState.input.value}}"` | Templated at request time         |
| Query params with substitution         | `{ "q": "{{componentState.input.value}}" }` | Same                              |
| Query body with substitution           | `{ "url": "{{componentState.input.value}}" }` | Same — added in queryEngine.ts    |

**Cheat sheet:** if a *display* component reads it → `{{ }}`. If a *control* component fires it → no braces.

### How a query is wired to the store

```
runtime store shape
─────────────────────────────────────────────────
state.queryResults["searchProducts"] = {
  data: { products: [...], total: 31, ... },   ← from /api/execute response
  status: "success",
  error: null,
  lastUpdated: 1714200000000
}

state.componentState["search-input"] = {
  value: "phone"                               ← TextInput writes here
}
```

So a binding like `{{queries.searchProducts.data.products}}` walks: `queryResults` → `searchProducts` → `data` → `products` and returns the array.

A binding like `{{componentState.search-input.value}}` walks: `componentState` → `search-input` → `value` and returns whatever the user typed.

### Triggers

| Trigger              | When the query fires                                |
|----------------------|-----------------------------------------------------|
| `onLoad`             | Once when the dashboard mounts                      |
| `manual`             | Only when a Button (or `executeQuery()`) calls it   |
| `onDependencyChange` | When any value in `dependsOn[]` changes             |

Reactive example:
```json
{
  "name":     "getDetails",
  "resource": "jsonph",
  "endpoint": "/posts",
  "method":   "GET",
  "trigger":  "onDependencyChange",
  "dependsOn": ["componentState.users-table.selectedRow.id"],
  "params":   { "userId": "{{componentState.users-table.selectedRow.id}}" }
}
```
A 100ms debounce + an in-flight cycle guard mean you can't accidentally infinite-loop two queries that depend on each other.

---

## 4. Assign to a customer

Customers are who actually *views* dashboards. Each has a unique slug used in the URL.

```
POST http://localhost:3001/api/customers
{
  "name":         "Shop Demo",
  "slug":         "shop",
  "dashboard_id": "<id-from-step-3>",
  "brand_config": { "primaryColor": "#6366f1", "logoUrl": "https://placehold.co/160x48" }
}
```

The slug must match `/^[a-z0-9]+(?:-[a-z0-9]+)*$/` — lowercase, digits, hyphens only.

---

## 5. View it

Open `http://localhost:5173/c/shop`.

The customer view:
- Loads `GET /api/customers/shop/dashboard` (joins customer + dashboard in one query).
- Renders only the dashboard — no LeftPanel, no RightPanel, no editor chrome.
- Read-only `GridLayer` (no drag, no resize, no select).
- Brand `primaryColor` injected as `--brand-primary`, logo shown top-left if set.
- Fires every `trigger:"onLoad"` query immediately on mount.

---

## 6. The full request lifecycle (what happens when you click a Button)

```
1. User clicks Button
   └─ Button.handleClick()
      └─ parseQueryName(data.dbBinding)  → "searchProducts"
      └─ queriesConfig.find(q.name === "searchProducts")
      └─ executeQuery(query)

2. Frontend queryEngine.executeQuery
   ├─ Stamp inflight set (cycle guard)
   ├─ store.setQueryState("searchProducts", { status: "loading" })
   ├─ resolveQueryTemplate(query.endpoint)             → "/products/search"
   ├─ resolveParams(query.params)                      → { q: "phone" }
   ├─ resolveJsonTemplate(query.body) if present       → for POST/PUT bodies
   └─ POST /api/execute  with { resource, endpoint, method, params, body }

3. Backend /api/execute (apps/backend/src/routes/execute.ts)
   ├─ Zod-validate body
   ├─ SELECT resource by name from `resources`         (the only place secret_ref leaves the DB)
   ├─ Resolve {{env.VAR}} → process.env.VAR            (never sent to the browser)
   ├─ Dispatch by resource.type:
   │   ├─ REST       → restExecutor (native fetch + 30s AbortController)
   │   ├─ agent      → agentExecutor (POST + poll every 2s, 60s cap)
   │   └─ postgresql → dbExecutor (regex block + BEGIN READ ONLY)
   ├─ Fire-and-forget INSERT into `query_logs`
   └─ Return { success, data | error }

4. Frontend gets the response
   ├─ store.setQueryState("searchProducts", { data, status: "success" })
   └─ Zustand notifies subscribers

5. GridLayer re-renders
   ├─ resolveBindings(comp.data) walks every {{...}} string
   └─ "{{queries.searchProducts.data.products}}" → resolved array

6. Table receives fresh data, renders rows
```

---

## 7. The Nexus / external API debugging story (what we learned the hard way)

When wiring a brand-new external API for the first time, expect to debug in this order:

1. **Auth** — wrong `auth_type`, raw secret in `secretRef` instead of `{{env.X}}`, key in the wrong header.
2. **Endpoint URL** — Swagger UI's HTML URL gets passed when the importer wants the JSON one. Look at network requests in the Swagger UI page to find the real schema URL.
3. **Body shape** — your dashboard sends `{ url: "..." }` but the API wants `{ urls: [...] }` or `{ targetUrl: "..." }`. The fastest way to learn the right shape is to use the API's own UI with DevTools → Network → Copy as cURL → match the payload.
4. **Response shape** — your `Table.columns[].fieldKey` doesn't match the keys in the response. Open DevTools Network → click the `/api/execute` request → Response tab → look at the actual data, then update `columns`.
5. **Bindings** — almost every "nothing happens" we hit was either:
   - missing braces on a Table binding, or
   - extra braces on a Button binding, or
   - wrong path (e.g. `components.X` instead of `componentState.X`)

Run through that checklist top to bottom and you'll find the issue every time.

---

## 8. Quick reference

### URLs
| What | Where |
| --- | --- |
| Engineer dashboard list | `http://localhost:5173/` |
| Visual builder | `http://localhost:5173/builder/:id` |
| Resources / Swagger import | `http://localhost:5173/resources` |
| Customer view | `http://localhost:5173/c/:slug` |
| Backend health | `http://localhost:3001/health` |
| pgAdmin | `http://localhost:5050` (login `admin@example.com` / `admin`, host `postgres`) |

### Common Postman calls
```
POST   /api/resources                        register a resource
POST   /api/resources/import-swagger         bulk-import from a swagger doc
GET    /api/resources/:id/endpoints          list imported endpoints
POST   /api/dashboards                       create dashboard from JSON config
PUT    /api/dashboards/:id                   update dashboard (Save calls this)
POST   /api/customers                        create customer
PUT    /api/customers/:id                    assign dashboard / update brand
GET    /api/customers/:slug/dashboard        what /c/:slug calls
POST   /api/execute                          the proxy every component goes through
```

### Inspect the audit log
```sql
SELECT resource_name, endpoint, status, duration_ms, created_at
FROM query_logs
ORDER BY created_at DESC
LIMIT 20;
```

### Run the test suite
```
cd apps/backend && npm test
```
14/14 should pass.
