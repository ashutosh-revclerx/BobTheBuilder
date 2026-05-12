# LLM Service — Template Quality Improvements

## Problem

The AI generator knows component types but does not receive a structured description of each component's visual and data properties. It produces valid templates, but not polished ones — components end up visually flat, with only generic `backgroundColor`/`textColor`/`borderColor` applied instead of component-specific properties like `metricFontSize`, `stripeRows`, or `seriesColors`.

Additionally, the variant generator in `variants.py` overwrites AI styling decisions via direct assignment, meaning even well-prompted output gets flattened before it reaches the frontend.

---

## What Is Being Done

### Step 1 — Component Capabilities Catalog (`component_capabilities.py`)

**File:** `apps/backend/services/llm/app/component_capabilities.py`

A structured dictionary that maps every supported component type to:
- `visual_role` — what the component is for
- `style` — the list of style properties it supports
- `data` — the list of data/config properties it supports

**Why:** Gemini cannot use `metricFontSize` or `headerBackgroundColor` if those property names never appear in the prompt. This catalog is the single source of truth for what each component can do, and feeds directly into the prompt.

**Covers:**
- `StatCard` — KPI metric cards with gradient, trend, sparkline, font sizing
- `Table` — dense data grids with search, pagination, stripe rows, header color
- `BarChart`, `LineChart`, `PieChart` — charts with series colors, grid, legend, axis color
- `Button` — actions with variant, hover color, icon, fullWidth
- `Input`, `Select`, `DatePicker` — form controls
- `Container`, `Tabs` — layout wrappers with tab header and panel styling
- `LogsViewer` — log streams with level colors and dark panel support
- `Badge`, `StatusBadge` — inline status indicators
- `Image`, `Embed` — media and iframe components (currently missing from prompt)

---

### Step 2 — Inject Catalog Into LLM Prompt (`prompts.py`)

**File:** `apps/backend/services/llm/app/prompts.py`

The `build_system_prompt()` function is updated to include:
- The full component capabilities catalog formatted as readable reference
- Explicit per-component usage guidance, for example:
  - StatCards must use `metricFontSize`, `labelFontSize`, `borderLeftColor`, `trend` fields
  - Tables must use `headerBackgroundColor`, `stripeRows`, `searchable`, `pagination`
  - Charts must use `seriesColors`, `showGrid`, `showLegend`, `axisColor`, `gridColor`
  - Buttons should use `variant`, `hoverBackgroundColor`, `fullWidth`, `iconLeft` where appropriate
- A rule requiring at least 3 component-specific style properties per component
- `Image` and `Embed` added to the allowed component type list

**Why:** Prose rules alone are inconsistent. Injecting the structured catalog gives Gemini the vocabulary it needs to produce polished output reliably.

---

### Step 3 — Stronger Few-Shot Example (`prompts.py`)

**File:** `apps/backend/services/llm/app/prompts.py` (inside `SCHEMA_RULES`)

The existing worked example (URL scraper dashboard) is functional but visually minimal. One or two richer examples are added demonstrating real use of:
- `backgroundGradient` on StatCards
- `seriesColors`, `gridColor`, `axisColor` on charts
- `stripeRows`, `headerBackgroundColor`, `searchBarBackground` on tables
- `tabHeaderActiveBackground` on Tabs containers
- `levelColors` on LogsViewer
- `shape`, `iconLeft`, `fullWidth` on Buttons

**Example targets:**
1. Analytics dashboard — gradient KPI cards, colored charts, styled table
2. Operations/logs dashboard — dark LogsViewer, status badges, filter inputs

**Why:** Few-shot examples are the most reliable way to shift LLM output quality. One rich example outperforms paragraphs of prose rules.

---

### Step 4 — Design Enrichment Pass (`design_enrichment.py`)

**File:** `apps/backend/services/llm/app/design_enrichment.py`

A deterministic post-processing step that runs after Gemini returns valid JSON and before variants are derived. Uses `setdefault` throughout — it fills gaps, never overrides AI decisions.

**Responsibilities:**
- Fill missing component-specific polish defaults
- Apply layout-aware sizing
- Ensure visual hierarchy (StatCards top, charts/tables below)
- Normalize bad AI choices without overriding good ones

**Example logic:**
```python
# StatCard defaults
style.setdefault("metricFontSize", 28)
style.setdefault("labelFontSize", 12)
style.setdefault("borderLeftWidth", 4)

# Table defaults
data.setdefault("searchable", True)
data.setdefault("pagination", True)
style.setdefault("stripeRows", True)
style.setdefault("headerBackgroundColor", palette["panel_elevated"])

# Chart defaults
data.setdefault("showGrid", True)
data.setdefault("showLegend", True)
style.setdefault("seriesColors", palette["chart_colors"])
```

**Why:** Prompts are always somewhat inconsistent. The deterministic pass makes quality reliable as a safety net. It is not a design layer — AI decisions always take precedence.

---

### Step 5 — Variant Generator Preserves AI Styling (`variants.py`)

**File:** `apps/backend/services/llm/app/variants.py`

`_repaint_component()` currently assigns palette values directly, overwriting AI styling decisions. It is updated to use `setdefault` for high-value component properties:
- `metricFontSize`, `labelFontSize`
- `backgroundGradient`
- `seriesColors`
- `stripeRows`
- `tabStyle`
- `levelColors`
- `shape`, `iconLeft`, `fullWidth`

Palette application continues to recolor backgrounds, borders, and text — it just no longer flattens the design decisions the AI made.

**Why:** This is a blocker. Without this fix, improvements to the prompt are partially undone before output reaches the frontend.

---

### Step 6 — Design Quality Scoring (`design_quality.py`) *(lower priority)*

**File:** `apps/backend/services/llm/app/design_quality.py`

A passive scorer that evaluates generated templates on:
- Uses at least 3 component-specific style properties per component
- Visual hierarchy: StatCards at top, charts/tables below
- No all-white identical components
- Charts have `seriesColors`, `gridColor`, `axisColor`
- Tables have `searchable`, `pagination`, `headerBackgroundColor`
- Buttons visually stand out from the background
- Text has `overflow`/`lineHeight` set

Score is logged per generation. Low-scoring templates may trigger enrichment or a Gemini retry with targeted feedback.

**Why:** Useful as a passive metric first. The retry-on-low-score path is deferred until output quality stabilizes.

---

### Step 7 — Design Intent In Request *(future)*

A `designStyle` field added to the generate request:
- `"Clean SaaS"` — light, card-based, blue accents
- `"Dark Ops"` — dark panels, red/amber alerts, monospace
- `"Executive"` — minimal, large KPIs, white space
- `"Dense Admin"` — compact tables, many filters, information-dense
- `"Playful"` — rounded corners, gradients, bright palette

**Why:** Gives the AI a concrete design target instead of guessing from the prompt. Deferred until steps 1–5 are stable.

---

### Step 8 — Snapshot Tests *(after baseline stabilizes)*

**Directory:** `apps/backend/services/llm/tests/fixtures/*.json`

Fixture files for known-good generated templates. Tests verify:
- Every generated component has non-empty `style` and `data`
- No unsupported component types
- All query bindings reference valid query names
- Visual quality score passes threshold
- `Image` and `Embed` are generated when appropriate

---

## Implementation Order

| Priority | Step | Files |
|----------|------|-------|
| 1 | Component capabilities catalog | `component_capabilities.py` (new) |
| 2 | Inject catalog + Image/Embed into prompt | `prompts.py` |
| 3 | Variants preserve AI styling | `variants.py` |
| 4 | Stronger few-shot examples | `prompts.py` |
| 5 | Design enrichment pass | `design_enrichment.py` (new) |
| 6 | Snapshot tests | `tests/fixtures/` (new) |
| 7 | Quality scoring | `design_quality.py` (new) |
| 8 | Design intent in request | `schemas.py`, `prompts.py`, frontend |

---

## Files Touched

| File | Change |
|------|--------|
| `component_capabilities.py` | New — component property catalog |
| `prompts.py` | Updated — inject catalog, stronger examples, Image/Embed |
| `variants.py` | Updated — use setdefault for high-value style properties |
| `design_enrichment.py` | New — deterministic polish pass |
| `design_quality.py` | New — passive quality scorer |
| `schemas.py` | Minor — add optional `designStyle` field later |
