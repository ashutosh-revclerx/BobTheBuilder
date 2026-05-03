# Mobile Preview Enhancement — Implementation Spec

> **Context:** This implements Phase 3.12 ("Mobile preview toggle") from the roadmap.
> It does NOT implement Phase 4 responsive layout work — that is deferred.
> Read this alongside `context.md` before writing any code.

---

## Placement in the Roadmap

| Item | Location | Status |
|---|---|---|
| Mobile preview toggle | Phase 3.12 | ← This spec |
| Responsive layout engine | Phase 4.13 | Deferred |
| Mobile-adapted component behaviour | Phase 4.8–4.12 | Deferred |

Do NOT build anything from Phase 4 here.

---

## What Must NOT Break

Before any change, verify these still work:

- `GridLayer.tsx` drag-to-canvas and resize via react-grid-layout
- `updateLayouts()` Zustand action — the existing `{id,x,y,w,h}[]` call signature must not change
- `dirtyStyleMap` and `dirtyDataMap` — component overrides must persist as-is
- Desktop canvas rendering at all existing widths
- `persistDashboard()` / `PUT /api/dashboards/:id` — the save payload must remain backward-compatible
- All components in `/dashboard-components/` — zero changes to their render logic for this feature
- `Container.tsx` and `TabbedContainer.tsx` nested GridLayers — must still work in desktop mode

---

## Existing Layout Format (Do Not Change)

The current Zustand store tracks layout as a flat array on each component:

```ts
// Current shape — do not change this
components: ComponentConfig[]  // each has id, type, style, data
// GridLayer reads layout positions from RGL's internal state + updateLayouts()
```

The existing `updateLayouts(layouts: {id,x,y,w,h}[])` action updates positions in-place.

---

## New Layout Schema — Additive Only

Add a `layouts` field to the dashboard config (JSON and Zustand). This is purely additive — existing configs without this field continue to work exactly as before.

```ts
// types/template.ts — ADD to DashboardConfig (do not remove existing fields)
interface DashboardConfig {
  // ... all existing fields unchanged ...
  layouts?: {
    desktop?: LayoutItem[]   // mirrors existing RGL layout
    mobile?: LayoutItem[]    // new — optional
  }
}

interface LayoutItem {
  i: string   // component id — matches ComponentConfig.id
  x: number
  y: number
  w: number
  h: number
}
```

**Rules:**
- `layouts` is optional. If absent, behaviour is 100% identical to today.
- `layouts.desktop` mirrors the existing RGL positions. On save, serialize the current RGL layout into this field.
- `layouts.mobile` is absent until the user explicitly creates it (via "Optimize for Mobile" or drag in Edit mode).
- If `layouts.mobile` is absent → always fall back to `layouts.desktop` (or existing RGL state). No auto-derivation.
- If a component `i` in `layouts.mobile` no longer exists in `components[]` → silently skip it. Do not crash.

**Backward compatibility:** When loading an old config without `layouts`, derive `layouts.desktop` from the current RGL state at load time. Do not write back until the user saves.

---

## Zustand Store Additions

Add to `editorStore.ts` — only additions, no removals:

```ts
// New state fields
mobileMode: 'off' | 'simulate' | 'edit'   // default: 'off'
mobileLayouts: LayoutItem[] | null         // null = not yet created
layoutHistory: LayoutItem[][]              // undo stack for mobile layout changes (max 20 entries)

// New actions
setMobileMode(mode: 'off' | 'simulate' | 'edit'): void
setMobileLayouts(layouts: LayoutItem[]): void
pushLayoutHistory(layouts: LayoutItem[]): void   // internal — called before any mobile layout mutation
undoMobileLayout(): void                          // pops layoutHistory, restores mobileLayouts
resetMobileLayout(): void                         // regenerates from desktop layout via auto-stack algorithm
```

`updateLayouts()` (existing) must remain unchanged. It continues to write to the desktop layout only. In Edit Mobile mode, GridLayer calls `setMobileLayouts()` instead.

---

## BuilderPage.tsx Changes

Add a mobile mode control group to the existing top bar (right of the Preview toggle button):

```
[ Simulate Mobile ] [ Edit Mobile Layout ]
```

- These are toggle buttons. Only one can be active at a time.
- If the user is in Preview mode (existing toggle), mobile mode buttons are disabled (greyed out) — Preview mode and mobile modes are mutually exclusive.
- Clicking an already-active button turns it off (returns to desktop).

**Mode indicator banner** — when `mobileMode` is `'edit'`, show a non-intrusive banner directly above the canvas:

```
┌─────────────────────────────────────────────────────────┐
│ 📱 Editing Mobile Layout  [Optimize for Mobile]  [Reset] [Undo] │
└─────────────────────────────────────────────────────────┘
```

- Banner only visible in Edit mode.
- "Optimize for Mobile" runs the auto-stack (see below). Disabled if `mobileLayouts` already exists and was manually edited (add a dirty flag to prevent accidental overwrite — user must Reset first).
- "Reset" clears `mobileLayouts` and re-runs auto-stack. Shows an inline confirm: "Reset mobile layout? Yes / No".
- "Undo" calls `undoMobileLayout()`. Disabled if `layoutHistory` is empty.

---

## Canvas.tsx / GridLayer.tsx Changes

GridLayer receives the active layout via props (do not read mobileMode directly in GridLayer — keep it dumb):

```ts
// GridLayer props — ADDITIONS only
interface GridLayerProps {
  // ... existing props unchanged ...
  activeLayouts?: LayoutItem[]  // if provided, use these instead of internal RGL state
  isReadOnly?: boolean          // if true, disable drag + resize
  canvasWidth?: number          // if provided, constrain outer wrapper to this px width
  onLayoutChange?: (layouts: LayoutItem[]) => void  // existing behaviour unchanged for desktop
  onMobileLayoutChange?: (layouts: LayoutItem[]) => void  // new — fires only in edit mode
}
```

**Canvas wrapper** — Canvas.tsx wraps GridLayer in a div. In simulate or edit mode, apply inline style `maxWidth: 375px` to that wrapper. This is the same constraint that already existed ("Mobile preview constrains the canvas to 375px width") — just now it's driven by `mobileMode` state instead of whatever currently drives it.

**In Simulate mode:**
- `isReadOnly = true`
- `activeLayouts = layouts.desktop ?? current RGL state`
- `canvasWidth = 375`

**In Edit mode:**
- `isReadOnly = false`
- `activeLayouts = mobileLayouts ?? layouts.desktop ?? current RGL state`
- `canvasWidth = 375`
- `onMobileLayoutChange` fires on drag/resize → calls `pushLayoutHistory` then `setMobileLayouts`

**In off (desktop) mode:**
- All new props absent — GridLayer behaves exactly as it does today.

---

## Auto-Stack Algorithm ("Optimize for Mobile")

Deterministic. No randomness. Called by `resetMobileLayout()` and the "Optimize for Mobile" button.

```ts
function autoStackForMobile(desktopLayouts: LayoutItem[]): LayoutItem[] {
  // Step 1: Sort by y ascending, then x ascending
  const sorted = [...desktopLayouts].sort((a, b) =>
    a.y !== b.y ? a.y - b.y : a.x - b.x
  )

  // Step 2: Stack each component full-width
  let currentY = 0
  return sorted.map(item => {
    const h = Math.max(item.h, 4)
    const result: LayoutItem = { i: item.i, x: 0, y: currentY, w: 12, h }
    currentY += h
    return result
  })
}
```

Rules:
- Always reads from `layouts.desktop` (or current RGL state if `layouts.desktop` is absent).
- Never mutates desktop layout.
- Result is written to `mobileLayouts` via `setMobileLayouts()`.
- Saves to `layoutHistory` before writing (supports undo).
- Do NOT call this automatically — only when user explicitly triggers it.

---

## Overflow Detection

Run only when `mobileMode !== 'off'`. Does not affect desktop mode.

**Detection logic** (runs as a derived selector in Zustand or a `useMemo` in Canvas):

```ts
function detectMobileOverflows(
  components: ComponentConfig[],
  layouts: LayoutItem[]
): Record<string, string>  // componentId → warning message
{
  const warnings: Record<string, string> = {}
  const COL_WIDTH = 375 / 12  // ~31.25px per column

  for (const layout of layouts) {
    const comp = components.find(c => c.id === layout.i)
    if (!comp) continue

    const pixelWidth = layout.w * COL_WIDTH

    if (layout.w < 4) {
      warnings[layout.i] = 'Too narrow for mobile (width < 4 columns)'
      continue
    }

    if (comp.type === 'Table') {
      const columns = comp.data?.columns ?? []
      if (columns.length > 4) {
        warnings[layout.i] = `Table has ${columns.length} columns — consider reducing to ≤4 for mobile`
      }
    }

    if (comp.type === 'BarChart' || comp.type === 'LineChart') {
      if (pixelWidth < 200) {
        warnings[layout.i] = 'Chart too narrow — minimum 200px recommended'
      }
    }
  }

  return warnings
}
```

**UI feedback** — in GridLayer, for each component with a warning:
- Apply a red CSS border outline (do not use `style.borderColor` — use a wrapper class so it doesn't interfere with `resolveBackground` or `dirtyStyleMap`).
- Render a small `⚠️` badge in the top-right corner of the component (inside the GridLayer item wrapper, not inside the component itself — zero changes to component files).
- On hover of the badge, show a tooltip with the warning message string.

The ⚠️ badge uses the same pattern as the existing delete button (visible in hover/edit state). Reuse whatever hover-visibility CSS already exists.

---

## Guidelines Overlay

Show only when `mobileMode !== 'off'`. Dismissible and the dismissed state is stored in `localStorage` key `mobileHintsDismissed` (persists across sessions).

Render a small floating card in the bottom-left of the canvas area (not inside the grid):

```
┌──────────────────────────────────────────────────┐
│ 📱 Mobile Tips                              [×]  │
│ • Stack components vertically                    │
│ • Use full-width (12 col) layouts                │
│ • Tables: limit to 4 columns                     │
└──────────────────────────────────────────────────┘
```

- Non-blocking — does not prevent interaction.
- `[×]` writes `mobileHintsDismissed = true` to localStorage. If dismissed, never show again unless user clears localStorage.
- Does not highlight specific components (that is handled by the overflow detection outlines).

---

## Grid Column Toggle

Add a small control in the Edit Mobile mode banner:

```
Grid: [12-col] [4-col]
```

- Default: 12-col (matches existing behaviour).
- 4-col mode: passes `cols={4}` to RGL in GridLayer. Snap behaviour changes but existing layouts are not mutated.
- Switching columns does NOT reposition components. RGL will re-snap on next drag.
- Auto-stack always produces 12-col full-width layout regardless of this toggle.
- This toggle is local UI state only — not persisted.

---

## Save / Persistence

When `persistDashboard()` is called (existing save flow):

- Serialize `mobileLayouts` into `config.layouts.mobile` in the payload.
- Serialize current RGL desktop state into `config.layouts.desktop`.
- The existing `PUT /api/dashboards/:id` endpoint receives the full config as before — the `layouts` field is just additional JSON inside the config blob. No backend schema changes needed if config is stored as JSONB/text.

Loading a saved dashboard:
- If `config.layouts.mobile` is present → populate `mobileLayouts` in Zustand.
- If absent → `mobileLayouts = null`.
- If `config.layouts.desktop` is present → seed RGL initial layout from it.

---

## Component Mobile Overrides — DEFERRED

Section 7 from the original spec (`mobile.variant`, `mobile.props`) is **not part of this implementation**. It is tracked under Phase 4.8–4.12. Do not add any `mobile` field to `ComponentConfig` now.

---

## Files to Touch

| File | Change type | Notes |
|---|---|---|
| `types/template.ts` | Add | `layouts` field, `LayoutItem` type |
| `store/editorStore.ts` | Add | `mobileMode`, `mobileLayouts`, `layoutHistory`, new actions |
| `pages/BuilderPage.tsx` | Add | Mobile toggle buttons in top bar, Edit mode banner |
| `components/editor/Canvas.tsx` | Add | Width constraint wrapper, pass new props to GridLayer |
| `components/editor/GridLayer.tsx` | Add | `activeLayouts`, `isReadOnly`, `onMobileLayoutChange` props; overflow badge rendering |
| `utils/mobileLayout.ts` | New file | `autoStackForMobile()`, `detectMobileOverflows()` |

**Files that must NOT be touched:**
- Any file in `/dashboard-components/` — zero changes
- `bindingResolver.ts` — zero changes
- `queryEngine.ts` — zero changes
- Backend files — zero changes

---

## Undo Scope

- Undo applies only to `mobileLayouts` mutations (drag, resize, auto-stack, reset).
- Desktop layout undo is not in scope — that is handled by the existing RGL behaviour.
- Undo stack maximum: 20 entries. If full, drop the oldest.
- Switching `mobileMode` does NOT clear the undo stack.
- Undo is only enabled (button not greyed out) when `layoutHistory.length > 0`.

---

## Edge Cases

| Scenario | Behaviour |
|---|---|
| New component added while in Edit Mobile mode | Component is added to `components[]` as normal. It does NOT appear in `mobileLayouts` automatically. User must run "Optimize for Mobile" or Reset to include it. Show an overflow warning if mobileLayouts exists but is missing this component id. |
| Component deleted while mobile layout exists | Remove matching `i` from `mobileLayouts` silently. Push to layoutHistory first (supports undo). |
| Switching from Edit mode to Simulate mode | Preserve `mobileLayouts`. No prompt needed. |
| Switching from Edit mode to Desktop (off) | Preserve `mobileLayouts`. Desktop layout is unaffected. |
| `mobileLayouts` has an `i` not in `components[]` | Silently skip it in rendering and overflow detection. Do not crash. |
| User saves while in Edit mode | Save proceeds normally. `mobileLayouts` is included in the payload. |

---

## Success Criteria

- [ ] Desktop layout is unaffected by all mobile operations
- [ ] `updateLayouts()` call signature is unchanged
- [ ] All existing GridLayer drag/resize behaviour works identically in desktop mode
- [ ] Mobile simulate mode constrains canvas to 375px, no layout changes
- [ ] Mobile edit mode allows drag/resize that writes only to `mobileLayouts`
- [ ] Auto-stack produces deterministic output every time for same input
- [ ] Overflow warnings appear on correct components without touching component files
- [ ] Save/load round-trips `mobileLayouts` correctly
- [ ] Old configs without `layouts` field load without errors
- [ ] Undo reverts the last mobile layout mutation