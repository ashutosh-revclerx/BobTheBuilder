# BobTheBuilder Codebase Map: High-Resolution Architecture

## 1. Core Philosophy & App Purpose
BobTheBuilder is a **No-Code / Low-Code Dashboard Platform** designed to democratize internal tool building. It operates on a **Single Source of Truth** principle, where the entire dashboard (UI, Data Bindings, and Queries) is represented as a single JSONB object in a PostgreSQL database.

### Key Capabilities:
- **Visual Composition**: Drag-and-drop interface powered by `react-grid-layout`.
- **Reactive Data Engine**: Components automatically update when their bound queries finish or when dependencies change.
- **Multi-Tenant Delivery**: Dashboards can be isolated for specific customers via unique slugs and access tokens.
- **Standalone Runtime**: Projects can be "ejected" as independent, performant React applications, stripping away the builder's overhead.

---

## 2. Page & Routing Architecture
The application uses `react-router-dom` v6 for declarative routing.

| Route | Component | Internal Logic Details |
|---|---|---|
| `/` | `DashboardList` | Fetches all dashboards from `/api/dashboards`. Handles soft deletion and linking to customer assignments. Uses a staggered animation for card entry. |
| `/templates` | `TemplateGallery` | Reads from a static `templates` registry. Allows "Preview" mode which boots a virtual `editorStore` without persisting to the DB. |
| `/builder/:id` | `BuilderPage` | **The State Hub**. Orchestrates the sidebar layouts, canvas scaling, and mobile preview toggle. Manages the "Save" lifecycle to the backend. |
| `/c/:slug` | `CustomerView` | Resolves a dashboard via its public slug. Uses a specialized `readOnly` mode in the components to disable editing features. |
| `/resources` | `ResourcesPage` | Manages external connectors. Supports a "Test Connection" flow that pings the backend executors. Includes a Swagger/OpenAPI importer. |
| `/new` | `GeneratePage` | Multi-step wizard for AI dashboard generation. Communicates with a specialized `agent` resource to translate natural language into `ComponentConfig[]`. |
| `/new/pick` | `TemplatePicker` | Selection screen for AI-generated candidates. | Compare generated dashboard variants and pick one to open in the builder. |

---

## 3. Deep File-Level Documentation

### `apps/frontend/src/store/editorStore.ts`
- **Core Role**: The global brain. Uses Zustand with `persist` middleware (local storage fallback) and `devtools` for debugging.
- **Internal Logic**: 
    - `updateLayouts()`: Receives `{i, x, y, w, h}[]` from the grid and updates the `components` array in a single batch to minimize re-renders.
    - `applyThemeToAll()`: Iterates through all components and merges the selected theme's color tokens into each component's `style` object.
- **Impact**: Deleting this would render the UI static; no interactions or saves would function.

### `apps/frontend/src/engine/queryEngine.ts`
- **Core Role**: Orchestrates the fetch-resolve-update loop.
- **Technical Details**:
    - **Cycle Detection**: Uses an `inflight` Set to track running queries and prevent infinite loops in dependency chains.
    - **Reactive Watcher**: `watchDependencies` compares current binding values against a `previousDependencySnapshots` Map to trigger auto-refreshes.
    - **Interpolation**: Uses regex to find `{{path}}` in URLs and bodies, calling `bindingResolver` to swap them for live values before the request leaves the client.

### `apps/frontend/src/engine/bindingResolver.ts`
- **Core Role**: The string-to-value resolver.
- **Technical Details**:
    - **Path Traversal**: Implements a recursive `getByPath` reducer that handles nested object access (e.g., `components.table1.selectedRow.user.id`).
    - **Namespace Isolation**: Explicitly handles `queries.`, `queryResults.`, and `components.` prefixes to direct searches to the correct slice of the Zustand store.

### `apps/frontend/src/components/editor/GridLayer.tsx`
- **Core Role**: The layout engine.
- **Internal Logic**:
    - **Recursive Rendering**: Detects components with `type: 'Container'` and renders a nested `GridLayer` for their children, passing the parent's ID down.
    - **Grid Constants**: Fixed at 12 columns for desktop and 1 column for mobile. Responsive breakpoints are handled via CSS media queries and the `previewDevice` store state.

### `apps/backend/src/app.ts`
- **Core Role**: The API Gateway.
- **Internal Logic**:
    - **Executor Proxy**: The `/api/execute` route acts as a secure proxy. Secrets (API keys, DB strings) never reach the frontend; the backend resolves them from the `resources` table and env vars before making the call.
    - **Error Handling**: Implements a global async error handler to prevent process crashes on unhandled promise rejections.

---

## 4. Component Configuration & Properties (The "Schema")

Every component follows the `ComponentConfig` interface.

### The `style` Object (Visual Layer)
Used by `styleUtils.ts` to generate inline CSS variables:
- **Typography**: `fontFamily`, `fontSize`, `fontWeight`, `letterSpacing`, `lineHeight`.
- **Box Model**: `borderRadius`, `borderColor`, `borderWidth`, `padding`.
- **Effects**: `backgroundGradient` (JSON object with stops and direction).
- **Specialized**: `selectedRowColor` (Table), `metricFontSize` (StatCard), `barRadius` (Chart).

### The `data` Object (Logic Layer)
Resolved by `bindingResolver.ts` before component rendering:
- **Bindings**: `dbBinding` (Main data source), `queryBinding` (For Select options).
- **Behavior**: `searchable`, `pagination`, `allowAddRows`.
- **Triggers**: `onChangeAction`, `onSubmitAction`, `onRowSelectAction`. These store variable names that the component updates in `editorStore.componentState`.

---

## 5. System Workflows (The "Deep Dives")

### The "Download as Code" Lifecycle
1.  **Frontend**: `exportService.ts` bundles the current state + static templates.
2.  **JSZip**: Creates a structured folder hierarchy.
3.  **Source Extraction**: Uses Vite's `?raw` loader to fetch the *actual code* of `StatCard.tsx`, `Table.tsx`, etc., ensuring the exported app is identical to the builder version.
4.  **Client-Side Bundle**: The ZIP is generated entirely in the browser using `Blob` and `saveAs`.

### The Query Execution Chain
1.  **Trigger**: User clicks a Button bound to `queries.updateUser`.
2.  **Engine**: `queryEngine.executeQuery` resolves `{{components.input1.value}}` from the store.
3.  **Network**: POST to `/api/execute` with the resource name and resolved params.
4.  **Backend**: `execute.ts` looks up the resource, grabs the secret API Key from environment variables, and calls `restExecutor.ts`.
5.  **Return**: Data flows back, `editorStore.setQueryResults` updates, and the `Table` bound to that query re-renders instantly.

### Component Extension Path (Developer Guide)
1.  **Define**: Add entry to `ComponentType` in `types/template.ts`.
2.  **Logic**: Create the `.tsx` file in `dashboard-components/`. Ensure it uses `React.memo` and the `resolveBackground` utility.
3.  **Registry**: Register in `componentRegistry.ts` with default props (e.g., default 4x2 grid size).
4.  **UI**: Add property editors to `DataTab.tsx` and `StyleTab.tsx`.
5.  **Export**: Add the new file to `sourceRuntimeFiles` in `exportService.ts`.

---

## 6. Database Schema Relationships

- **Dashboards ↔ Customers**: Many-to-Many via `dashboard_assignments`. Allows one dashboard to be customized and shared with multiple customers.
- **Resources ↔ Dashboards**: Implicit via the `config.queries` JSON. A dashboard "consumes" resources by name.
- **Query Logs ↔ Dashboards**: One-to-Many. Every execution is logged with a `dashboard_id` for performance auditing and usage billing.
