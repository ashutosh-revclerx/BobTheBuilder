# Changes Log - Dashboard Builder Refactor

This file documents the changes made to the BobTheBuilder (BTB) dashboard builder to support professional freestyle layouts, granular component properties, and refined UI features.

## 核心 (Core) Systems

### 1. Layout Engine Refactor
- **File**: `apps/frontend/src/components/editor/GridLayer.tsx`
- **Changes**: 
    - Switched from `onLayoutChange` to `onDragStop`/`onResizeStop` to eliminate infinite render loop crashes.
    - Set `compactType={null}` for true "freestyle" placement.
    - Implemented `preventCollision={true}` for ToolJet-like "nudging" behavior.
    - Added auto-expanding canvas logic (dynamic height based on component positions).
    - Global support for `visible` and `loading` states.
    - Support for `customGap` inside containers.

### 2. State & Types Extension
- **File**: `apps/frontend/src/types/template.ts`
- **Changes**: Extended `ComponentConfig` and `ComponentData` with 20+ new properties (`visible`, `loading`, `events`, `searchable`, `trend`, etc.).
- **File**: `apps/frontend/src/store/editorStore.ts`
- **Changes**: 
    - Enriched `defaultConfigs` for all components to match the new spec.
    - Stabilized `updateLayouts` to prevent redundant state updates.

### 3. Styling & Global UI
- **File**: `apps/frontend/src/index.css`
- **Changes**: Added global keyframes and classes for the component loading spinner and backdrop overlay.

---

## Component Enhancements

### 1. Table Component
- **File**: `apps/frontend/src/components/dashboard-components/Table.tsx`
- **Changes**: 
    - Added real-time client-side **Search**.
    - Added **Pagination** logic and UI.
    - Added **Row Selection** highlighting and state.
    - Added `onRowClick` event trigger support.

### 2. Charts (Bar & Line)
- **Files**: `apps/frontend/src/components/dashboard-components/BarChart.tsx`, `LineChart.tsx`
- **Changes**: Added explicit support for `xField` and `yField` configuration, overriding previous auto-detection logic.

### 3. Container & Tabbed Container
- **Files**: `apps/frontend/src/components/dashboard-components/Container.tsx`, `TabbedContainer.tsx`
- **Changes**: 
    - Container now respects `gap` and `padding` properties.
    - Integrated with GridLayer for nested drag-and-drop.

### 4. Inputs
- **File**: `apps/frontend/src/components/dashboard-components/TextInput.tsx` -> Added `placeholder`.
- **File**: `apps/frontend/src/components/dashboard-components/NumberInput.tsx` -> Added `min`, `max`, `step`.

### 5. Other Display Components
- **File**: `apps/frontend/src/components/dashboard-components/StatusBadge.tsx` -> Added **Custom Color Mapping**.
- **File**: `apps/frontend/src/components/dashboard-components/LogsViewer.tsx` -> Added **Level Filtering** and **Log Search**.
- **File**: `apps/frontend/src/components/dashboard-components/StatCard.tsx` -> Added configurable **Trend Indicators**.

### 6. Text Component
- **File**: `apps/frontend/src/components/dashboard-components/Text.tsx`
- **Changes**: Fixed rendering of `backgroundColor`, `borderColor`, and `borderRadius`.

---

## Editor Workspace

### Property Editor Overhaul
- **File**: `apps/frontend/src/components/editor/DataTab.tsx`
- **Changes**: 
    - Completely rewritten to provide type-safe editors for every component property.
    - Added specific editors for columns, series, mappings, and semantic properties.
    - Added global visibility/loading toggles.
