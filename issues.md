# Issues & Feature Backlog

Stress-test feedback after the demo. Every item below has an owner, a priority, and a category. Tick the box when shipped.

**Owners:** **Ayushmaan** (platform, integration, new components, infra) · **Ashutosh** (component internals, UX polish, LLM prompts).

**Priority:** 🔴 High (blocks demo or data loss) · 🟡 Medium (rough edges) · 🟢 Low (nice-to-have).

**Sizes:** S = under half a day · M = ~1 day · L = multi-day.

---

## A. Component polish & customization

Bugs and missing controls in existing components. Mostly Ashutosh's territory — they own the component internals and the StyleTab.

| # | Title | Owner | Pri | Size |
|---|---|---|---|---|
| 1  | Font size slider doesn't affect LineChart text | Ashutosh | 🟡 | S |
| 2  | TabbedContainer — per-tab background/border colours | Ashutosh | 🟡 | M |
| 3  | Label text on top of every component should be editable | Ashutosh | 🟡 | S |
| 4  | Chart components — X/Y axis colour controls in StyleTab | Ashutosh | 🟡 | S |
| 5  | Search bar (Table, LogsViewer) needs colour/font controls | Ashutosh | 🟢 | S |
| 6  | TabbedContainer navbar (the View1/View2 strip) needs colour controls | Ashutosh | 🟡 | S |
| 7  | Preview mode stretches components edge-to-edge — should respect grid | Ashutosh | 🔴 | M |
| 9  | Button — colour & border colour controls in StyleTab don't apply | Ashutosh | 🔴 | S |
| 10 | More font styling: weight, italic, letter-spacing, line-height | Ashutosh | 🟢 | M |
| 24 | Component icons in LeftPanel — replace text-only with proper icons | Ashutosh | 🟢 | S |

---

## B. Builder features & new components

Features that change *what* you can build. Mostly Ayushmaan — these touch routing, state, and new component implementations.

| # | Title | Owner | Pri | Size |
|---|---|---|---|---|
| 8  | New component: **Image** (URL or base64 upload, 500KB cap) — *About dropped, can be built from Container + Text* | Ayushmaan | 🟡 | M |
| 11 | Auto-adjust components — wrap to next row when minW is hit by viewport — *deferred; mobile preview (#14) gives engineers the visibility to fix layouts manually for now* | Ayushmaan | 🟢 | L |
| 12 | Audit pass: every component reviewed for missing fields / sane defaults | Ayushmaan + Ashutosh | 🟡 | L |
| 13 | Copy/duplicate a component on the canvas (right-click or Cmd-D) | Ashutosh | 🟡 | S |
| 14 | Mobile preview toggle (Desktop / 375px) — same builder, narrower canvas | Ayushmaan | 🟢 | M | ✅ shipped |
| 15 | Editing a pre-built template currently doesn't save — fix the template→DB path | Ayushmaan | 🔴 | M |
| 16 | Left sidebar — Layers panel + Settings panel | Ashutosh | 🟢 | M |
| 25 | New **Embed** component — paste a URL (YouTube/Vimeo auto-convert to embed URL, anything else used as-is), sandboxed iframe | Ayushmaan | 🟢 | M |

---

## C. Platform, infra, LLM & docs

Cross-cutting work — backend, ops, LLM prompt iteration, documentation. Heavier mix; Ayushmaan covers more of it because most of this is platform glue, but LLM prompt items are Ashutosh.

| # | Title | Owner | Pri | Size |
|---|---|---|---|---|
| 17 | Role-based access within a dashboard (viewer / operator) | Ayushmaan | 🟢 | L |
| 18 | WebSocket / streaming executor type — currently only REST/agent/postgres | Ayushmaan | 🟢 | L |
| 19 | Detailed README at repo root — install, run, architecture diagram, demo flow | Ayushmaan | 🔴 | M |
| 20 | Performance pass — improve LCP & CLS scores in DevTools (lazy-load builder, defer fonts) | Ayushmaan | 🟡 | M |
| 21 | Customer delete UI + backend route | Ashutosh | 🔴 | S |
| 22 | Better AI templates — hand-craft a strong reference dashboard, feed it to the LLM as a few-shot example | Ashutosh | 🟡 | M |
| 23 | Build a real "AI Explainability" dashboard manually as a showcase / few-shot anchor | Ashutosh | 🟢 | M |
| 26 | ResourcesPage — handle more auth types (OAuth2, custom headers) and websocket resources | Ayushmaan | 🟢 | M |
| 27 | Landing page (`/`) polish — hero, brief feature pitch, proper empty state | Ayushmaan | 🟡 | S |

---

## Suggested order — what to do this week

### 🔴 High priority first (ship these before any 🟡/🟢)

| # | Owner | What |
|---|---|---|
| 7  | Ashutosh | Fix preview stretching (visible to anyone who clicks Preview) |
| 9  | Ashutosh | Fix Button colour/border controls |
| 15 | Ayushmaan | Pre-built template editing → DB |
| 21 | Ashutosh | Customer delete |
| 19 | Ayushmaan | Detailed README |

That's roughly 1.5 days of work split evenly. Demo regains its polish + the README unblocks any new developer.

### Then medium polish (~2-3 days each)

- Ashutosh: 1, 2, 3, 4, 6, 10, 13 (component customization sweep — knock them out together since they all touch StyleTab)
- Ayushmaan: 8, 11, 12, 27 (new Image/About components, responsive wrap, landing page polish)

### Long-tail / nice-to-have (parallel-track when time allows)

- Ashutosh: 5, 16, 22, 23, 24
- Ayushmaan: 14, 17, 18, 20, 25, 26

---

## Workload check

| Owner | 🔴 | 🟡 | 🟢 | Total |
|---|---|---|---|---|
| **Ayushmaan** | 2 | 5 | 7 | 14 |
| **Ashutosh** | 3 | 6 | 4 | 13 |
| Shared (#12) | — | 1 | — | 1 |

Roughly even. Ashutosh has more high-priority items (the visible UI bugs from the demo), Ayushmaan has more long-tail platform work — that matches the natural rhythm of "polish what's there" vs "extend the platform."

---

## How to use this file

1. Pick the highest 🔴 in your column and start it.
2. Tick the box on completion (`- [x]`) so the other person sees progress without standup.
3. If something feels mis-categorised or mis-prioritised, just edit it — this file is the source of truth, not history.
4. New issues found during work? Append below, don't lose them in chat.

```
- [ ] (#28) Title — Owner — Pri — short description
```
