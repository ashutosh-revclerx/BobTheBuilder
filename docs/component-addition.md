# Adding Dashboard Components

This guide explains how to add a new first-class dashboard component to BobTheBuilder. Follow it when adding components such as `PieChart`, `HeatMap`, `ProgressCard`, or any new reusable dashboard widget.

The short version: a component is not complete when the React file exists. It must be registered in the editor, typed in the schema, given defaults, exposed in customer/export rendering, and documented for AI generation.

## Component Contract

Every dashboard component receives a `ComponentConfig`:

```ts
{
  id: "chart-sales",
  type: "PieChart",
  label: "Sales Mix",
  layout: { x: 0, y: 0, w: 5, h: 12 },
  style: { backgroundColor: "#ffffff", borderRadius: 10, padding: 20 },
  data: {
    dbBinding: "{{queries.sales.data}}",
    mockValue: [{ label: "A", value: 30 }],
    nameField: "label",
    valueField: "value"
  }
}
```

The React component should read from `config.style`, `config.data`, and `config.label`. For query-backed data, components should follow the existing binding pattern:

```ts
const isBound = data._resolvedBindings?.dbBinding;
const rawData = isBound ? data.dbBinding : data.mockValue;
```

Use `resolveBackground(style)` for background color/gradient support, and use `runAction(...)` for click actions.

## Required File Map

Update these files for most new components:

| Area | File | Why |
| --- | --- | --- |
| React component | `frontend/src/components/dashboard-components/YourComponent.tsx` | Runtime UI implementation |
| TypeScript types | `frontend/src/types/template.ts` | Adds the component type and style/data keys |
| Zod schema | `frontend/src/shared/index.ts` | Allows saved/imported/generated configs to validate |
| Render registry | `frontend/src/config/renderRegistry.tsx` | Makes Canvas and PreviewRenderer able to render it |
| Sidebar registry | `frontend/src/config/componentRegistry.ts` | Makes it draggable from the left panel |
| Store defaults | `frontend/src/store/editorStore.ts` | Default style, data, layout, normalization, theme behavior |
| Drag defaults | `frontend/src/components/editor/GridLayer.tsx` | Initial size while dragging from sidebar |
| Data editor | `frontend/src/components/editor/DataTab.tsx` | Shows editable data/binding controls |
| Style editor | `frontend/src/components/editor/StyleTab.tsx` | Shows component-specific style controls |
| Theme editor | `frontend/src/components/editor/ThemeTab.tsx` | Lets theme controls edit colors/palette knobs |
| Customer view | `frontend/src/pages/CustomerView.tsx` | Published dashboards render the component |
| Export runtime map | `frontend/public/export-runtime/runtime/Renderer.tsx` | Exported code can render the component |
| Export source bundle | `frontend/src/services/exportService.ts` | Adds the component source file to exported ZIPs |
| AI capabilities | `backend/app/llm/component_capabilities.py` | Tells generation/chat what fields the component supports |
| AI prompts | `backend/app/llm/prompts.py` | Adds binding/data guidance and allowed component type |
| AI variants | `backend/app/llm/variants.py` | Repaints the component in generated theme variants |
| AI enrichment | `backend/app/llm/design_enrichment.py` | Applies default polish, size floors, and missing defaults |

Optional files:

| Area | File | When |
| --- | --- | --- |
| Templates | `frontend/src/templates/*.ts` | Add examples to built-in templates |
| Docs | `docs/USER_GUIDE.md`, `docs/context.md` | User-facing or architecture docs |
| Tests | Component/editor tests | Add when behavior is complex or shared |

## Step 1: Add The Component Type

Edit `frontend/src/types/template.ts`.

Add the component to `ComponentType`:

```ts
export type ComponentType =
  | "StatCard"
  | "Table"
  | "BarChart"
  | "LineChart"
  | "PieChart"
  | "HeatMap";
```

Add any style keys to `ComponentStyle`:

```ts
export interface ComponentStyle {
  seriesColors?: string[];
  innerRadius?: number;
  cellGap?: number;
  minCellColor?: string;
  maxCellColor?: string;
  emptyCellColor?: string;
}
```

Add any data keys to `ComponentData`:

```ts
export interface ComponentData {
  nameField?: string;
  valueField?: string;
  donut?: boolean;
  showLabels?: boolean;
  onSliceClickAction?: string;
  xField?: string;
  yField?: string;
  minValue?: number;
  maxValue?: number;
  showCellLabels?: boolean;
  onCellClickAction?: string;
}
```

Edit `frontend/src/shared/index.ts` and add the new type to the Zod enum:

```ts
type: z.enum([
  "StatCard",
  "Table",
  "BarChart",
  "LineChart",
  "PieChart",
  "HeatMap"
])
```

## Step 2: Create The React Component

Create `frontend/src/components/dashboard-components/YourComponent.tsx`.

Recommended structure:

```tsx
import React, { useMemo } from "react";
import type { ComponentConfig } from "../../types/template";
import { resolveBackground } from "../../utils/styleUtils";
import { runAction } from "../../engine/runtimeUtils";

export default function YourComponent({ config }: { config: ComponentConfig }) {
  const { style, data, label } = config;
  const bg = useMemo(
    () => resolveBackground(style),
    [style.backgroundColor, style.backgroundGradient],
  );

  const isBound = data._resolvedBindings?.dbBinding;
  const rawData = isBound ? data.dbBinding : data.mockValue;

  return (
    <div
      style={{
        background: bg,
        color: style.textColor,
        borderColor: style.borderColor,
        borderWidth: style.borderWidth,
        borderStyle: "solid",
        borderRadius: style.borderRadius,
        padding: style.padding,
        height: "100%",
      }}
    >
      <div>{label}</div>
      <button onClick={() => runAction(data.onClickAction, rawData)}>
        Run
      </button>
    </div>
  );
}
```

For charts, mirror the patterns in:

`frontend/src/components/dashboard-components/BarChart.tsx`

`frontend/src/components/dashboard-components/LineChart.tsx`

Use the shared chart shell classes where possible:

```tsx
className="chart-component"
className="chart-component-title"
className="chart-custom-tooltip"
```

## Step 3: Register Rendering

Edit `frontend/src/config/renderRegistry.tsx`.

Lazy-load heavier components:

```tsx
const PieChartComponent = lazy(() => import("../components/dashboard-components/PieChart"));
```

Add it to `RenderRegistry`:

```tsx
export const RenderRegistry: Record<ComponentType, React.ComponentType<any>> = {
  PieChart: PieChartComponent,
};
```

This registry is used by the builder canvas and preview renderer. If a component is missing here, it will not render in the editor.

## Step 4: Add It To The Sidebar

Edit `frontend/src/config/componentRegistry.ts`.

Import a Lucide icon:

```ts
import { PieChart as PieIcon, Grid3X3 } from "lucide-react";
```

Add an option under the correct category:

```ts
{
  title: "Charts",
  options: [
    { type: "PieChart", icon: PieIcon, label: "Pie Chart", description: "Part-to-whole distribution" },
    { type: "HeatMap", icon: Grid3X3, label: "Heat Map", description: "Density across two dimensions" },
  ],
}
```

## Step 5: Add Store Defaults

Edit `frontend/src/store/editorStore.ts`.

Add layout defaults to `COMPONENT_LAYOUTS`:

```ts
PieChart: { x: 0, y: 0, w: 5, h: 12, minW: 3, minH: 6 },
HeatMap: { x: 0, y: 0, w: 6, h: 12, minW: 4, minH: 6 },
```

Add a `createDefaultConfig` case:

```ts
case "PieChart":
  return {
    style: {
      ...createBaseStyle(),
      borderRadius: 10,
      padding: 20,
      innerRadius: 50,
      seriesColors: ["#2563eb", "#60a5fa", "#93c5fd"],
    },
    data: {
      ...createBaseData(),
      mockValue: [
        { label: "Desktop", value: 62 },
        { label: "Mobile", value: 28 },
      ],
      nameField: "label",
      valueField: "value",
      donut: true,
      showLegend: true,
    },
    layout: { ...COMPONENT_LAYOUTS[type] },
  };
```

Add it to `defaultConfigs`:

```ts
PieChart: createDefaultConfig("PieChart"),
HeatMap: createDefaultConfig("HeatMap"),
```

Update `applyThemeToAll` if it belongs to a themed group:

```ts
if (
  ctype === "BarChart" ||
  ctype === "LineChart" ||
  ctype === "PieChart" ||
  ctype === "HeatMap"
) {
  style.backgroundColor = palette.chart_tint;
}
```

## Step 6: Add Drag Defaults

Edit `frontend/src/components/editor/GridLayer.tsx`.

Add the new type to `DEFAULT_SIZES`:

```ts
PieChart: { w: 5, h: 12 },
HeatMap: { w: 6, h: 12 },
```

This controls the ghost size while dragging from the sidebar.

## Step 7: Add Editor Controls

Edit `frontend/src/components/editor/DataTab.tsx`.

Add the component to helper booleans if it uses JSON array data:

```ts
const isChart =
  type === "BarChart" ||
  type === "LineChart" ||
  type === "PieChart" ||
  type === "HeatMap";
```

Add component-specific data controls:

```tsx
{type === "PieChart" && (
  <>
    <TextField label="Name Field" value={data.nameField ?? ""} onChange={(value) => handleDataField("nameField", value)} />
    <TextField label="Value Field" value={data.valueField ?? ""} onChange={(value) => handleDataField("valueField", value)} />
    <BooleanField label="Donut" value={data.donut === true} onChange={(value) => handleDataField("donut", value)} />
    <BooleanField label="Show labels" value={data.showLabels === true} onChange={(value) => handleDataField("showLabels", value)} />
  </>
)}
```

Edit `frontend/src/components/editor/StyleTab.tsx`.

Add style controls:

```tsx
{component.type === "HeatMap" && (
  <>
    <SliderField label="Cell Gap" value={style.cellGap || 4} min={0} max={12} onChange={(value) => handleChange("cellGap", value)} />
    <ColorField label="Min Cell Color" value={style.minCellColor || "#dbeafe"} onChange={(value) => handleChange("minCellColor", value)} />
    <ColorField label="Max Cell Color" value={style.maxCellColor || "#1d4ed8"} onChange={(value) => handleChange("maxCellColor", value)} />
  </>
)}
```

Edit `frontend/src/components/editor/ThemeTab.tsx`.

Add the type to chart/theme branches and expose any palette controls that should be theme-editable.

## Step 8: Add Published And Export Rendering

Edit `frontend/src/pages/CustomerView.tsx`.

Import and add to `ComponentMap`:

```tsx
import PieChartComponent from "../components/dashboard-components/PieChart";

const ComponentMap: Record<ComponentType, React.ComponentType<any>> = {
  PieChart: PieChartComponent,
};
```

Edit `frontend/public/export-runtime/runtime/Renderer.tsx` the same way.

Edit `frontend/src/services/exportService.ts`.

Import the raw source:

```ts
import pieChartSource from "../components/dashboard-components/PieChart.tsx?raw";
```

Add it to `sourceRuntimeFiles`:

```ts
"src/components/dashboard-components/PieChart.tsx": pieChartSource,
```

If this step is missed, the component may work in the builder but fail in exported apps.

## Step 9: Add AI Generation Context

The AI path depends on explicit component context. This is the most common step to miss.

Edit `backend/app/llm/component_capabilities.py`.

Add a conservative entry with only fields the React component actually reads:

```py
"PieChart": {
    "description": "Part-to-whole distribution chart with optional donut mode.",
    "visual_role": "Shows composition share by category.",
    "style": CHART_STYLE + [
        "innerRadius",
        "seriesColors",
    ],
    "data": COMMON_VISIBILITY_DATA + [
        "nameField",
        "valueField",
        "showLegend",
        "showLabels",
        "donut",
        "onSliceClickAction",
    ],
    "required": {
        "style": ["seriesColors"],
        "data": ["nameField", "valueField", "dbBinding"],
    },
}
```

Edit `backend/app/llm/prompts.py`.

Add the type to the allowed component list and include binding guidance:

```text
PieChart expects array rows with nameField and valueField.
HeatMap expects array rows with xField, yField, and valueField.
```

Edit `backend/app/llm/variants.py`.

Include the component in repaint/layout branches if generated variants should theme it:

```py
elif ctype in {"LineChart", "BarChart", "PieChart", "HeatMap"}:
    style["backgroundColor"] = palette["chart_tint"]
```

Edit `backend/app/llm/design_enrichment.py`.

Add size floors and enrichment defaults:

```py
MIN_HEIGHTS = {
    "PieChart": 12,
    "HeatMap": 12,
}
```

## Step 10: Verify

Run:

```bash
npm run build --prefix frontend
npm run lint --prefix frontend
```

Manual smoke test:

1. Open the builder.
2. Drag the new component from the sidebar.
3. Confirm it renders with default mock data.
4. Edit data fields in `DataTab`.
5. Edit style/theme fields.
6. Preview the dashboard.
7. Publish and open `CustomerView`.
8. Export as code and confirm the exported app renders the component.
9. Ask AI generation to create a dashboard using the new component.

## Common Mistakes

Missing `renderRegistry.tsx`: component appears in sidebar but renders blank.

Missing `componentRegistry.ts`: component exists but cannot be dragged from the sidebar.

Missing `editorStore.ts`: component can be created but has broken defaults or poor layout.

Missing `CustomerView.tsx`: builder works, published customer dashboard does not.

Missing `Renderer.tsx` or `exportService.ts`: exported code fails or omits the component source.

Missing `component_capabilities.py`: AI will not know the component exists, or it will invent wrong field names.

Adding fields to prompts but not React: AI may generate config keys that the UI ignores.

Adding React behavior but not TypeScript types: future code will drift and generated/imported configs become harder to validate.

## PieChart And HeatMap Reference

`PieChart` reads:

```ts
data.nameField
data.valueField
data.donut
data.showLegend
data.showLabels
data.onSliceClickAction
style.seriesColors
style.innerRadius
```

Expected data:

```ts
[
  { label: "Desktop", value: 62 },
  { label: "Mobile", value: 28 }
]
```

`HeatMap` reads:

```ts
data.xField
data.yField
data.valueField
data.minValue
data.maxValue
data.showCellLabels
data.onCellClickAction
style.cellGap
style.minCellColor
style.maxCellColor
style.emptyCellColor
```

Expected data:

```ts
[
  { day: "Mon", hour: "09:00", value: 12 },
  { day: "Mon", hour: "10:00", value: 24 },
  { day: "Tue", hour: "09:00", value: 18 }
]
```

Use these two components as the current reference implementation for adding chart-like components end to end.
