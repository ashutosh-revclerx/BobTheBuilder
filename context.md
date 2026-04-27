# Dashboard Platform — Agent Context & Progress Tracker

> **For the coding agent:** This is your single source of truth. Read every word before writing any code.
> Update checkboxes as tasks complete. Never delete sections. Add notes below tasks if needed.

---

## What We're Building

A **config-driven dashboard platform** — similar to Retool / ToolJet — where engineers build customer-facing dashboards visually. Each dashboard is defined by a JSON config. The platform reads that config and renders a fully working UI.

**The end state:** An engineer picks a template, customises it in a visual editor, connects it to a backend resource, and hands a branded, mobile-ready dashboard URL to a customer. No custom frontend code written per customer, ever.

**Right now (Phase 0):** We are building only the frontend. No backend. No real API calls. All data is mocked. The goal is a working template gallery + visual editor that feels like ToolJet/Retool.

---

## Reference UI

The screenshot from ToolJet shows exactly the kind of editor we're building:
- A canvas in the centre showing live components (stat cards, charts, tables)
- A top bar with the dashboard name, preview toggle, and save controls
- A left sidebar for navigation / component actions
- A right panel (opens when a component is selected) for configuration
- Components render in a grid on the canvas — stat cards in a row, charts below, tables below that

We are replicating this experience. Phase 0 is the foundation of this editor.

---

## Tech Stack

| Layer | Choice |
|---|---|
| Frontend | React + Vite + TypeScript |
| Styling | Tailwind CSS + Vanilla CSS (`index.css`) |
| State management | Zustand |
| Grid / Drag-Drop | `react-grid-layout` v2 (Responsive + WidthProvider, legacy API) |
| Charts | Recharts |
| Routing | React Router v6 |
| Backend (Phase 1+) | Node.js + Express |
| Database (Phase 2+) | PostgreSQL |
| Validation (Phase 1+) | Zod |
| Auth (Phase 5) | OAuth2 / SAML + JWT |

---

## Architecture — How the Renderer Works

This is the core mental model. Every engineer and agent on this project must understand this before writing any component code.

### 1. The Config is the Dashboard

Every dashboard is a JSON file with three sections:

```json
{
  "id": "project-overview",
  "components": [
    { "id": "stat-1", "type": "StatCard", "label": "Revenue", "data": "queries.getRevenue.data" },
    { "id": "table-1", "type": "Table", "columns": ["id","name","amount"], "data": "queries.getOrders.data" },
    { "id": "btn-1", "type": "Button", "label": "Run Report", "onClick": "queries.runReport.trigger" }
  ],
  "queries": [
    { "name": "getRevenue", "resource": "mainApi", "endpoint": "/revenue", "trigger": "onLoad" },
    { "name": "getOrders", "resource": "mainApi", "endpoint": "/orders", "trigger": "onLoad" },
    { "name": "runReport", "resource": "agentRunner", "endpoint": "/run", "trigger": "manual" }
  ],
  "resources": [
    { "id": "mainApi", "type": "rest_api", "baseUrl": "https://api.company.com" },
    { "id": "agentRunner", "type": "agent", "endpoint": "https://agents.company.com" }
  ]
}
```

### 2. The Component Registry

A plain JS object mapping every `type` string to its actual React component. This is what makes config-driven rendering possible.

```ts
// src/components/registry.ts
export const ComponentRegistry = {
  StatCard,
  Table,
  BarChart,
  LineChart,
  Button,
  StatusBadge,
  LogsViewer,
};
```

### 3. The Dashboard Renderer

Reads the config, loops over components, looks each one up in the registry, resolves data bindings, and renders.

```tsx
// src/renderer/DashboardRenderer.tsx
export default function DashboardRenderer({ config }) {
  const store = useStore();

  return (
    <div className="dashboard-canvas">
      {config.components.map(compConfig => {
        const Component = ComponentRegistry[compConfig.type];
        if (!Component) return <UnknownComponent key={compConfig.id} type={compConfig.type} />;
        const resolvedProps = resolveProps(compConfig, store);
        return <Component key={compConfig.id} {...resolvedProps} />;
      })}
    </div>
  );
}
```

### 4. The Binding Resolver

Converts string references like `"queries.getOrders.data"` into real values from the Zustand store.

```ts
// src/engine/bindingResolver.ts
export function resolve(path: string, store: StoreState): unknown {
  return path.split('.').reduce((obj: any, key) => obj?.[key], store);
}

function resolveProps(compConfig: ComponentConfig, store: StoreState) {
  const resolved: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(compConfig)) {
    if (typeof value === 'string' && (value.startsWith('queries.') || value.startsWith('components.'))) {
      resolved[key] = resolve(value, store);
    } else {
      resolved[key] = value;
    }
  }
  return resolved;
}
```

### 5. Zustand Store Shape

```ts
// Current store shape
{
  // Editor state
  activeTemplateId: string | null,
  originalTemplateId: string | null,
  dashboardName: string,
  components: ComponentConfig[],       // flat array — nesting encoded via parentId/parentTab
  queriesConfig: any[],
  selectedComponentId: string | null,
  activeTabs: Record<string, string>,  // which tab is active in each TabbedContainer
  draggingType: string | null,         // set when a sidebar card is being dragged
  dirtyStyleMap: Record<string, Partial<ComponentStyle>>,
  dirtyDataMap: Record<string, Partial<ComponentData>>,
  savedTemplates: Record<string, SavedTemplate>,

  // Engine state (Phase 1+)
  queries: {
    [queryName: string]: {
      data: unknown,
      isLoading: boolean,
      error: string | null,
      lastRunAt: string | null,
    }
  },
  componentState: Record<string, any>,

  // Key actions
  addComponent(type, placement?: { x,y,w,h,parentId,parentTab }): void,
  updateLayouts(layouts: {id,x,y,w,h}[]): void,
  setDraggingType(type: string | null): void,
  setActiveTab(containerId, tab): void,
  // ...save/load/reset actions unchanged
}
```

### 6. API & DB Connections via Config (Phase 1+)

Resources are defined in the config and referenced by queries. Credentials never touch the frontend — they live in server environment variables and are resolved by the backend executor before making any connection.

```
Config:   "password": "{{env.DB_PASSWORD}}"
Backend:  resolves → process.env.DB_PASSWORD → actual secret
Frontend: never sees the real value
```

The backend `/execute` endpoint receives `{ resourceId, queryName, params }`, resolves the resource config, picks the right executor (`apiExecutor` / `dbExecutor` / `agentExecutor`), runs it, and returns `{ success, data, error }`.

---

## File Structure

```
/src
  /templates                        ← Phase 0: hardcoded JSON configs
    project-overview.json
    sprint-tracker.json
    budget-monitor.json

  /components
    /editor                         ← Builder UI pieces
      Canvas.tsx                    ← Centre panel; renders GridLayer, applies drop-active class
      GridLayer.tsx                 ← Wraps react-grid-layout Responsive grid; handles isDroppable/onDrop
      LeftPanel.tsx                 ← Component picker sidebar; draggable cards + click-to-add
      InlinePicker.tsx              ← Floating inline component picker (click-to-add in containers)
      RightPanel.tsx                ← Right panel shell with tab switcher
      StyleTab.tsx                  ← Style controls (color, font, border, padding)
      DataTab.tsx                   ← Data/binding controls
    /dashboard-components           ← The actual renderable components
      StatCard.tsx
      Table.tsx
      BarChart.tsx
      LineChart.tsx
      StatusBadge.tsx
      Button.tsx
      LogsViewer.tsx
      Container.tsx                 ← Nestable container; renders its own child GridLayer
      TabbedContainer.tsx           ← Tabbed container; each tab renders its own child GridLayer
      Text.tsx
      TextInput.tsx
      NumberInput.tsx
      Select.tsx

  /config
    componentRegistry.ts            ← COMPONENT_REGISTRY array: type, label, icon, description per component

  /pages
    TemplateGallery.tsx             ← Route: /templates
    BuilderPage.tsx                 ← Route: /builder/:templateId

  /store
    editorStore.ts                  ← Zustand store (see Store Shape below)

  /engine                           ← Phase 1+
    bindingResolver.ts
    queryEngine.ts

  /hooks
    useTextMeasure.ts               ← Pretext-powered label width, cell truncation, kinetic input width

  /types
    template.ts
    component.ts
    store.ts
```

---

## Template JSON Format (Phase 0)

```json
{
  "id": "project-overview",
  "name": "Project Overview",
  "description": "KPI cards, monthly spend chart, and project summary table",
  "thumbnail": "/thumbnails/project-overview.png",
  "components": [
    {
      "id": "stat-1",
      "type": "StatCard",
      "label": "Total Budget",
      "style": {
        "backgroundColor": "#ffffff",
        "textColor": "#111827",
        "fontFamily": "Inter",
        "fontSize": 14,
        "borderRadius": 8,
        "borderColor": "#e5e7eb",
        "borderWidth": 1,
        "padding": 16
      },
      "data": {
        "fieldName": "budget_total",
        "mockValue": "₹4,20,000",
        "dbBinding": "projects.budget_total",
        "refreshOn": "onLoad"
      }
    },
    {
      "id": "chart-1",
      "type": "BarChart",
      "label": "Monthly Spend",
      "style": { "backgroundColor": "#f9fafb", "borderRadius": 8, "padding": 16 },
      "data": {
        "series": [{ "name": "Spend", "fieldKey": "monthly_spend" }],
        "mockValue": [
          { "month": "Jan", "monthly_spend": 32000 },
          { "month": "Feb", "monthly_spend": 45000 },
          { "month": "Mar", "monthly_spend": 38000 }
        ],
        "dbBinding": "projects.monthly_spend",
        "refreshOn": "onLoad"
      }
    }
  ]
}
```

---

## Hard Constraints — Read Before Coding

- **Phase 0 is frontend only.** No backend calls. No API. Everything is mocked data.
- **No custom CSS injection** — style is controlled only through the defined right-panel fields.
- **No WebSocket / streaming** — polling only (Phase 1+).
- **Engineers use the builder. Customers never do.** Customers only see the rendered dashboard.
- **Zod validates all config writes** (Phase 1+) — never write invalid config to DB.
- **Credentials never in config** — always `{{env.VAR_NAME}}`, resolved server-side only.
- **localStorage for Phase 0** — no DB until Phase 2.
- **Mobile builder not needed** — engineers build on desktop; customer-facing dashboards are responsive (Phase 4).

---

## Progress Tracker

### Phases Overview

- [x] **Phase 0** — Template Gallery & Component Editor ← DONE
- [x] **Phase 1** — Core Engine (config → render → query → result) ← DONE
- [x] **Phase 2** — Persistence & Reactivity ← DONE
- [ ] **Phase 3** — Full Visual Builder
- [ ] **Phase 4** — White-Label & Mobile
- [ ] **Phase 5** — Auth & Production Hardening

---

### Phase 0 — Template Gallery & Component Editor

> **Goal:** Engineer picks a template, edits component styles and data in a right panel, and saves it. No backend. All mock data. This is the first thing a user sees when they open the app.

> **Done when:** Template gallery shows 3 templates → click one → editor opens → click a component → right panel appears → change a color → canvas updates live → click Save → refresh page → template still there.

#### 0.1 — Template Gallery Screen

- [x] Create route `/templates` — this is the app home / entry point
- [x] Build a responsive grid of template cards (3 columns desktop, 1 column mobile)
- [x] Each card shows: thumbnail image, template name, short description, "Use Template" button
- [x] Include a "Start from Blank" card at the end of the grid
- [x] Clicking "Use Template" navigates to `/builder/:templateId`
- [x] Hardcode 3 templates in `/src/templates/`:
  - `project-overview.json` — StatCards + BarChart + Table
  - `sprint-tracker.json` — Table + LineChart + StatusBadge cards
  - `budget-monitor.json` — StatCards + LineChart + category breakdown Table
- [x] Saved templates (from localStorage) appear at the top of the grid with a "Saved" badge
- [x] Gallery header: app name/logo, simple top nav

#### 0.2 — Editor Canvas Shell

- [x] Create route `/builder/:templateId`
- [x] Load template JSON by ID from `/src/templates/` on mount
- [x] Three-panel layout:
  - Left: narrow sidebar (placeholder icon strip for now — Phase 3 fills this)
  - Centre: scrollable canvas area
  - Right: properties panel (hidden until a component is selected)
- [x] Top bar contains: back arrow → gallery, editable dashboard name (click to edit inline), Save button, Preview toggle button (non-functional placeholder for now)
- [x] Track `selectedComponentId` in Zustand — null on load
- [x] Clicking anywhere on canvas background deselects the current component

#### 0.3 — Component Rendering (Mock Data)

- [x] Build `StatCard` component — large number/value, label above, optional subtitle below, delta indicator (↑↓ with percentage, optional)
- [x] Build `Table` component — column headers + rows from mock data array, no pagination, basic alternating row color
- [x] Build `BarChart` component — via Recharts, data from template JSON `mockValue`, responsive width
- [x] Build `LineChart` component — via Recharts, data from template JSON `mockValue`, responsive width
- [x] Build `StatusBadge` component — colored pill/chip, label text, color driven by status value
- [x] Canvas renders components in the order they appear in the template JSON
- [x] Selected component shows a 2px blue outline ring — no other UI change
- [x] Clicking a component sets `selectedComponentId` in Zustand and opens the right panel
- [x] Components are grouped visually: stat cards in a horizontal row, charts below, table below that (CSS grid layout)

#### 0.4 — Right Panel: Style Tab

- [x] Right panel appears when `selectedComponentId` is not null
- [x] Panel has two tabs at the top: **Style** and **Data**
- [x] Style tab contains these controls (in this order):
  - Background color — `<input type="color">` + hex text input side by side
  - Text color — same pattern
  - Font family — `<select>` dropdown: Inter, Roboto, Poppins, DM Sans, Fira Code, system-ui
  - Font size — slider 12px to 24px + numeric display
  - Border radius — slider 0px to 16px + numeric display
  - Border color — color picker + hex input
  - Border width — slider 0px to 4px + numeric display
  - Padding — slider 8px to 32px + numeric display
- [x] Every control change immediately updates the canvas component — no apply/save button needed within the panel
- [x] Style overrides stored in `dirtyStyleMap[componentId]` in Zustand (not mutating the original template JSON)
- [x] Panel shows the component's current values when first opened (base style from template JSON merged with any dirty overrides)

#### 0.5 — Right Panel: Data Tab

- [x] Data tab contains these fields (in this order):
  - Display label — text input, updates the component heading live
  - Mock value — text input (for StatCard: plain text; for Table/Chart: JSON textarea)
  - DB field binding — text input, placeholder text "e.g. projects.budget_total" — stored but not yet functional
  - Refresh trigger — `<select>`: Manual / On Load / On Row Select
- [x] For `Table` components: show a mini column editor below the main fields
  - Each row: column name text input + field key text input + delete button
  - "Add column" button adds a new empty row
- [x] For `BarChart` / `LineChart`: show series editor
  - Each row: series name text input + data field key text input + delete button
  - "Add series" button adds a new row
- [x] All changes reflect live on the canvas component
- [x] Data overrides stored in `dirtyDataMap[componentId]` in Zustand

#### 0.6 — Save & Persist

- [x] Save button in top bar serialises the full Zustand editor state to localStorage key `dashboard_templates`
- [x] Saved state includes: templateId, dashboard name, all components with their dirty style + data overrides applied (merged into final component configs)
- [x] On gallery load: read localStorage, show saved templates at top of grid with a "Saved" badge
- [x] Clicking a saved template re-opens the editor with all saved overrides restored
- [x] "Reset to default" option on saved templates (small text button in the editor top bar) — clears overrides, restores original template JSON, confirms with inline prompt before doing so

#### 0.7 — Component Add / Remove

- [x] A `+` button pinned at the bottom of the canvas (centred, below all components)
- [x] Clicking `+` opens an inline component type picker (small popover or inline card, not a modal):
  - Available types: StatCard, Table, BarChart, LineChart, StatusBadge
  - Each option shows a small icon and the type name
- [x] Selecting a type: adds a new component to the bottom of the canvas with default style and placeholder mock data. Auto-selects it and opens the right panel.
- [x] Each component shows an `×` remove button in its top-right corner — visible on hover only
- [x] Clicking `×` shows an inline confirmation directly below the button: "Remove this component? Yes / No" — no modal
- [x] Confirming removes the component from Zustand `components` array and deselects if it was selected

#### 0.8 — Phase 0.5: Visual Polish & Pretext Integration (Completed)

- [x] Integrate standard modern UI tokens, themes, typography (DM Sans), gradients, and animations into CSS (`index.css`).
- [x] Integrate `@chenglou/pretext` for advanced intelligent dynamic text measurement (`useTextMeasure.ts`).
- [x] Implement accurately sized sliding/hovering labels for builder canvas components without layout reflows.
- [x] Implement robust dynamic binary-searched column-text truncation to fix visual overflow inside Table components intelligently.
- [x] Build kinetic input elements that auto-resize securely relative to input string scale for dashboard names.
- [x] Fully upgrade aesthetics for `RightPanel`, `Canvas`, `Table`, `LineChart`, `BarChart`, `StatCard`, and `StatusBadge` interfaces.

---

### Phase 1 — Core Engine

> **Goal:** Full config → render → query → result loop. One live dashboard with real backend data.

> **Done when:** A hardcoded config dashboard renders a Table with live API data, a Button that triggers an agent, and a Logs Viewer that shows the output.

- [x] **1.1** — Project scaffolding: React + Tailwind frontend, Node/Express backend, monorepo config, CI pipeline, shared linting rules
- [x] **1.2** — JSON config schema v1: `components[]`, `queries[]`, `resources[]` — add Zod validation
- [x] **1.3** — Table component: rows from query data, column config, basic search, row click events
- [x] **1.4** — Button component: trigger query on click, loading / success / error states
- [x] **1.5** — Chart component: bar / line / pie via Recharts, auto-update on data change
- [x] **1.6** — Logs Viewer: INFO / WARN / ERROR colour coding, keyword filter
- [x] **1.7** — Dashboard renderer: reads JSON config, renders components in order with props wired via registry
- [x] **1.8** — Query engine (basic): `onLoad` and `manual` triggers, results written to Zustand
- [x] **1.9** — Binding resolver: resolves `queries.getUsers.data` and `queries.runAgent.trigger` from store
- [x] **1.10** — Backend `/execute` endpoint: POST, accepts `{ resource, endpoint, method, params }`, returns `{ success, data, error }`
- [x] **1.11** — One end-to-end dashboard: hardcoded config, Table shows live API data, Button triggers agent, Logs Viewer shows output
- [x] **1.12** — Basic error handling: readable error state in bound component, retry button, server-side failure logging

---

### Phase 2 — Persistence & Reactivity

> **Goal:** Configs saved to DB. All backend types supported. Reactive queries. Each customer gets their own URL.

- [x] **2.1** — PostgreSQL setup: tables `dashboards`, `customers`, `query_logs`, migration scripts
- [x] **2.2** — Dashboard CRUD API: create / read / update / delete with Zod validation on write
- [x] **2.3** — Dashboard list screen: engineer-facing, name + last edited + assigned customer count
- [x] **2.4** — Agent executor: invocation, poll for completion, result retrieval
- [x] **2.5** — DB executor: read-only parameterised queries only, no raw SQL from config
- [x] **2.6** — Reactive query engine: `onDependencyChange` trigger, watches component state
- [x] **2.7** — Component state binding: resolve `components.{id}.selectedRow` and `components.{id}.value`
- [x] **2.8** — Customer profiles: name, assigned dashboards, brand config (empty), URL slug
- [x] **2.9** — Customer routing: `/c/:slug` loads assigned dashboard config and renders it
- [x] **2.10** — Audit log: every `/execute` writes to `query_logs` with full metadata
- [x] **2.11** — Query error + retry UI: readable error, no stack traces shown to user
- [x] **2.12** — Integration test suite: config load → render → query → result, runs in CI on every PR

---

### Phase 3 — Full Visual Builder

> **Goal:** Engineers build dashboards entirely in the UI. No JSON editing required.

- [x] **3.1** — Builder shell: three-panel layout (Component Picker | Canvas | Properties Panel)
- [x] **3.2** — Component picker sidebar: all types with icons and descriptions, click-to-add and drag-to-canvas
- [x] **3.3** — Container architecture: recursive RenderTree for infinitely nested Container/TabbedContainer blocks
- [x] **3.4** — Component selection: click to select, properties panel loads its config
- [x] **3.5** — Properties panel — display: label, data binding, trigger, column list, chart type
- [x] **3.6** — Properties panel — queries: resource picker, endpoint, method, trigger type, dependsOn
- [x] **3.7** — Component reorder/reposition: react-grid-layout drag handles + resize handles; layout persisted to Zustand via `updateLayouts`
- [x] **3.8** — Delete component / query: trash icon with inline confirmation
- [x] **3.9** — True drag-from-sidebar onto canvas: `draggable` cards in LeftPanel → RGL `isDroppable`/`onDrop`; component placed at exact hovered grid cell; nested container drops supported via `stopPropagation`; drop-active visual feedback (dashed blue outline + brightened dot grid); RGL placeholder styled blue while hovering
- [x] **3.10** — UI Polish & Critical Bug Fixes (Completed)
  - Fixed component label and delete button positioning (floating pills + absolute alignment)
  - Enabled and styled quad-corner resize handles (Retool-style dots)
  - Redesigned right-panel row editor for higher data density efficiently
  - Fixed overflow clipping issues to ensure floating UI elements are never cut off
  - Resolved "rows is not defined" crash in DataTab via robust data extraction
  - Removed arbitrary `maxW` and `maxH` component constraints.
  - Fixed deep nested container drag & drop event isolation.
  - Added a functional Preview Mode to the visual builder.
- [ ] **3.11** — JSON config editor: collapsible pane, bidirectionally synced with visual builder
- [ ] **3.12** — Mobile preview toggle: Desktop vs Mobile (375px) canvas preview
- [ ] **3.13** — Templates: migrate Phase 0 templates into full builder; add new ones
- [ ] **3.14** — Customer assignment UI: assign a dashboard to one or more customers
- [ ] **3.15** — Publish flow: explicit Publish button, draft state for unpublished changes
- [ ] **3.16** — Config validation UI: inline error highlights for missing fields or bad bindings

---

### Phase 4 — White-Label & Mobile

> **Goal:** Every customer sees their own branding. Every dashboard works on mobile.

- [ ] **4.1** — Brand config data model: add `brand_config` JSON column to `customers` table
- [ ] **4.2** — Brand config UI: colour pickers, font input, logo + favicon upload, live preview
- [ ] **4.3** — Design token injection: merge brand config into CSS custom properties at `:root`
- [ ] **4.4** — Logo + favicon delivery: upload → `/uploads/customers/:id/` → serve as Express static
- [ ] **4.5** — Font loading: Google Fonts by name, uploaded files, async, fallback to system-ui
- [ ] **4.6** — Theme preview toggle: default vs customer brand in builder canvas
- [ ] **4.7** — Custom domain support: engineer sets domain, platform provides DNS instructions
- [ ] **4.8** — Table mobile: priority columns, expandable row detail panel on tap
- [ ] **4.9** — Chart mobile: full-width stacked, tap-to-tooltip, legends below
- [ ] **4.10** — Button mobile: 48px min height, full-width, bottom-sheet confirm dialogs
- [ ] **4.11** — Logs Viewer mobile: full-width collapsible, pinned filter bar, chip level toggles
- [ ] **4.12** — Navigation mobile: hamburger menu, left drawer, tap outside to close
- [ ] **4.13** — Responsive layout engine: single column below 768px, no horizontal overflow
- [ ] **4.14** — Mobile preview in builder: renders actual mobile-adapted behaviour, not scaled desktop

---

### Phase 5 — Auth & Production Hardening

> **Goal:** Auth, roles, execution history, reliability. Production-ready for all customers.

- [ ] **5.1** — Customer auth: SSO (OAuth2 / SAML) or magic link, JWT, token expiry + refresh
- [ ] **5.2** — Engineer auth: internal SSO, separate from customer login flow
- [ ] **5.3** — Customer roles: Viewer (read-only) vs Operator (can trigger queries)
- [ ] **5.4** — Engineer roles: Editor vs Admin
- [ ] **5.5** — Route protection: all routes require valid session, unauthenticated → redirect to login
- [ ] **5.6** — Execution history (engineer): filter by customer / dashboard / query / date / status
- [ ] **5.7** — Execution history (customer): own history only, no raw error details
- [ ] **5.8** — Text Input component: debounced 400ms, value bindable as query parameter
- [ ] **5.9** — Dropdown component: static or query-driven list, searchable, value bindable
- [ ] **5.10** — Polling / auto-refresh: per-component interval (min 10s), last-refreshed indicator
- [ ] **5.11** — Rate limiting: per-customer on `/execute`, configurable, graceful 429 in component
- [ ] **5.12** — Health monitoring: health endpoint, executor uptime checks, failure alerting
- [ ] **5.13** — Load testing: 50 concurrent customers × 3 dashboards, fix bottlenecks first
- [ ] **5.14** — Internal docs: create customer, build dashboard, configure brand, assign access

---

## Success Checkpoints

| Phase | Done when |
|---|---|
| Phase 0 | Engineer picks template → edits colors/fonts/data → saves → reopens and it's all still there |
| Phase 1 | Table shows live API data, Button triggers an agent, Logs Viewer shows the output |
| Phase 2 | 3+ customers have live dashboards running with zero manual backend intervention |
| Phase 3 | New customer dashboard delivered in under 15 minutes, no raw JSON editing needed |
| Phase 4 | Customer opens dashboard on a phone and it works. They see their own logo and colours. |
| Phase 5 | Zero new standalone frontends built in 3 months. Full audit trail for every customer action. |

---

*Current status: Phase 0, 0.5, 1, 2 — COMPLETE. Phase 3.1–3.10 — COMPLETE. Bonus: Swagger / OpenAPI import (`POST /api/resources/import-swagger`), `resource_endpoints` table + migration 007, `GET /api/resources/:id/endpoints`, ResourcesPage at `/resources` with import + endpoint browser + delete, reusable `MethodBadge` + `EndpointPicker` components, DataTab `QueryBindingSection` that auto-creates queries on endpoint pick, Save now PUTs back to dashboards table (was localStorage-only), GridLayer subscribes to queryResults+componentState so bindings re-resolve on query landings, queryEngine forwards `body` with `{{...}}` template substitution, `parseQueryName` strips `.trigger`. End-to-end demo verified with DummyJSON product browser. See `example.md` for the full how-to.*
