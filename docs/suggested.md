# 🚀 LLM Dashboard Generation — Complete Improvement Spec

## 🎯 Goal

Transform dashboard generation from:

❌ Schema-driven JSON generation  
➡️  
✅ UX-driven, structured, production-quality dashboards

---

# 🧠 Core Problem

Current system is technically strong but produces weak templates because:

- Over-focus on schema correctness
- No consistent layout patterns
- No data relationships between components
- No design system enforcement
- Variants only change colors (not UX)
- No concept of dashboard "type"

---

# 🔥 Core Shift

## Current Pipeline

User Prompt → LLM → JSON


## New Pipeline

User Prompt → Archetype → UX Pattern → Structured Generation → JSON


---

# 🧩 1. Dashboard Archetypes (MANDATORY)

## Add Dashboard Types

```ts
type DashboardType =
  | "analytics"
  | "crud_admin"
  | "monitoring"
  | "form_workflow"
  | "logs"
Archetype Definitions
Analytics Dashboard
Top → StatCards (3–4)
Middle → Chart
Bottom → Table
Filters affect all
CRUD Admin
Top → Filters + Actions
Middle → Table
Optional → Form modal / side panel
Monitoring
Top → Status + KPIs
Middle → Charts
Bottom → Logs / events
Form Workflow
Left → Inputs
Bottom → Action button
Right → Output/result
Logs Dashboard
Top → Filters
Main → LogsViewer
Optional → Status summary
🧠 2. Archetype Classifier (Backend Step)

Before calling LLM:

function classifyPrompt(prompt: string): DashboardType {
  const p = prompt.toLowerCase();

  if (p.includes("log")) return "logs";
  if (p.includes("form") || p.includes("submit")) return "form_workflow";
  if (p.includes("admin") || p.includes("manage")) return "crud_admin";
  if (p.includes("monitor") || p.includes("status")) return "monitoring";

  return "analytics";
}

Pass this into the prompt.

🧩 3. SYSTEM PROMPT (REWRITE — CRITICAL)
Replace current system instruction with:
You are a senior product designer and frontend engineer.

Your task is to create a highly usable dashboard that:
- clearly communicates data
- follows strong UX patterns
- has a clean visual hierarchy
- connects all components meaningfully

DO NOT just generate valid JSON.
Design a real product interface.

Prioritize:
- clarity
- structure
- usability
- consistency
🧩 4. Archetype Injection into Prompt

Add before schema rules:

## Dashboard Type
This dashboard is a: {DASHBOARD_TYPE}

Follow this structure strictly:

[Inject archetype-specific layout rules here]
🧩 5. Data Flow Rules (MANDATORY)

Add to prompt:

## Data Flow Rules (CRITICAL)

- There must be one primary query driving the dashboard
- StatCards must derive from the same dataset as charts or tables
- Filters must affect at least one query
- Avoid isolated components
- Every component must be connected to either:
  - a query
  - user input
  - or another component
🧩 6. Layout Constraints (MANDATORY)
## Layout Rules

Use ONLY these patterns:

1. Overview Dashboard
   - Top: stat cards
   - Middle: main chart
   - Bottom: table

2. Input → Action → Output
   - Left: inputs
   - Below: button
   - Right: result

3. Monitoring Layout
   - Top: KPIs
   - Middle: charts
   - Bottom: logs

DO NOT invent random layouts.
🧩 7. Component Relationship Rules
## Component Rules

- No isolated components
- Every chart must map to a query
- Every table must map to a dataset
- Every filter must influence something
- Buttons must trigger queries
🧩 8. Design System Rules
## Design Rules

- Use one primary accent color
- Use neutral backgrounds
- Use subtle borders
- Maintain consistent spacing
- Avoid random colors
- Maintain visual hierarchy (important elements stand out)
🧩 9. Variant System Upgrade
Current
Palette swap only ❌
New Variant Types
Variant A — Overview
More StatCards
Simplified charts
Less detail
Variant B — Detailed
Large table
Filters enabled
Drill-down focus
Variant C — Visual
More charts
Less text
Clean UI
Implementation
def generate_variants(base_config):
    return [
        base_config,  # original
        apply_overview_layout(base_config),
        apply_detailed_layout(base_config),
        apply_visual_layout(base_config),
    ]
🧩 10. Improve Generation Strategy
Add Rule
Focus on:
- meaningful layout
- logical grouping
- clear user flow
Avoid
- random placement
- disconnected components
- overly complex UI
🧪 11. Quality Checklist

Before returning output:

Does the dashboard tell a clear story?
Are all components connected?
Is layout structured?
Is it usable immediately?
Does it look production-ready?
🎯 Expected Outcome

After implementing this:

Templates feel intentional
Layouts are predictable
UX improves drastically
Variants feel meaningful
Output looks like real products
🔥 Implementation Order
System prompt rewrite
Archetype classifier
Archetype injection
Data flow rules
Layout constraints
Variant upgrade
Design rules
