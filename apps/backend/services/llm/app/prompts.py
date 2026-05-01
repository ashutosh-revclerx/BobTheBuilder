"""
Builds the system + user prompt sent to Gemini. Kept in its own file so
prompt iteration doesn't churn application code.

Versioning: bump SYSTEM_PROMPT_VERSION whenever you make a material change.
The version is logged on each call — useful when output quality regresses.
"""

from .archetypes import ARCHETYPE_RULES, DashboardType
from .component_capabilities import format_capabilities_for_prompt
from .schemas import GenerateRequest, ResourceContext

SYSTEM_PROMPT_VERSION = "v4.0"


# ─── Schema description (human-friendly, complements response_schema) ────────
# Gemini also gets the actual pydantic model via `response_schema`, but humans
# (and the model) understand the rules best when they're spelled out as prose
# with a concrete worked example. Both layers run together.

SCHEMA_RULES = """
You output a single JSON object: { "components": [...], "queries": [...] }.

# components[] — one object per visual element

REQUIRED FIELDS on every component:
  - id        kebab-case unique string         e.g. "tbl-orders"
  - type      one of: StatCard | Table | BarChart | LineChart | StatusBadge |
              Button | LogsViewer | Container | TabbedContainer | Text |
              TextInput | NumberInput | Select | Image | Embed
  - label     human-readable label             e.g. "Recent Orders"
  - layout    { "x": 0, "y": 0, "w": 6, "h": 12 }
              12-col grid; rowHeight is small; sensible heights are 4-18 rows
  - style     { "backgroundColor": "#ffffff", "borderColor": "#e5e7eb",
                "borderWidth": 1, "textColor": "#0f1117",
                "borderRadius": 10, "padding": 16, ... }
              All colours as #hex.
              For gradients, set backgroundGradient:
              { "backgroundGradient": { "enabled": true, "direction": 90,
                "stops": [
                  { "color": "#2563eb", "position": 0 },
                  { "color": "#7c3aed", "position": 100 }
                ] } }
  - data      component-specific (see below)

# queries[] — one object per HTTP / SQL call

REQUIRED FIELDS on every query:
  - name      kebab-case unique string         e.g. "get-orders"
  - resource  the *name* of a resource you were given (NOT its uuid)
  - endpoint  URL path including any {{...}} substitutions
  - method    GET | POST | PUT | PATCH | DELETE
  - trigger   "onLoad"            fires once when the dashboard mounts
              "manual"            fires only when a Button calls it
              "onDependencyChange" fires when any value in dependsOn changes
OPTIONAL:
  - params    { "key": "value or {{path}}" }   query-string params
  - body      { "key": "value or {{path}}" }   request body, POST/PUT only
  - dependsOn ["componentState.x.selectedRow"] required for onDependencyChange

# Binding rules — THE most common mistake. Get this right.

BUTTON FIRING A QUERY (no braces):
    "data": { "dbBinding": "queries.get-orders.trigger" }

DISPLAY COMPONENT READING DATA (with braces):
    "data": { "dbBinding": "{{queries.get-orders.data}}" }
    "data": { "dbBinding": "{{queries.get-orders.data.products}}" }    ← drill in
    "data": { "dbBinding": "{{queries.get-job.data.status}}" }         ← drill in

WRONG vs RIGHT — Text/StatCard/Table dbBinding MUST be wrapped in {{ }}:
    WRONG:  "dbBinding": "queries.run-scrape.data.content"        ← stays a literal string, panel is empty
    RIGHT:  "dbBinding": "{{queries.run-scrape.data.content}}"    ← resolved to the live value

WRONG vs RIGHT — Button dbBinding MUST NOT be wrapped:
    WRONG:  "dbBinding": "{{queries.run-scrape.trigger}}"         ← Button looks up nothing, click does nothing
    RIGHT:  "dbBinding": "queries.run-scrape.trigger"             ← Button parses the name and fires the query

If you get nothing else right, get these brace rules right. Test the rule
mentally before emitting each component.

INPUT FEEDING INTO A QUERY (TextInput auto-writes value to componentState[id].value):
    Endpoint:  "/posts/{{componentState.url-input.value}}"
    Param:     { "userId": "{{componentState.user-id.value}}" }
    Body:      { "url": "{{componentState.url-input.value}}" }

TABLE-SELECTED-ROW FEEDING ANOTHER QUERY:
    "trigger": "onDependencyChange",
    "dependsOn": ["componentState.tbl-users.selectedRow.id"],
    "params": { "userId": "{{componentState.tbl-users.selectedRow.id}}" }

# Component-specific data fields

Table:        data.columns = [{ "name": "ID", "fieldKey": "id" }, ...]
              data.searchable = true
              data.pagination = true
              data.dbBinding  = "{{queries.X.data}}" or array path

StatCard:     data.dbBinding  = "{{queries.X.data}}" (or .X.data.length, .X.data.total)
              data.mockValue  = "fallback display"
              data.fieldName  = "metric_key"

StatusBadge:  data.dbBinding  = "{{queries.X.data.status}}"
              data.mapping    = { "ok": "#22c55e", "error": "#ef4444",
                                  "queued": "#f59e0b", "done": "#22c55e" }
              data.defaultColor = "#9ba3af"

LogsViewer:   data.dbBinding     = "{{queries.X.data}}"  (expects array)
              data.messageField  = "message"
              data.levelField    = "level"
              data.timestampField = "timestamp"

Text:         data.dbBinding  = "{{queries.X.data.content}}" (single string)
              For long content set style.overflow = "Wrap" (default) or "Scroll"

Button:       data.dbBinding         = "queries.X.trigger" (NO braces)
              data.loadingState      = true
              data.confirmationDialog = true | false

TextInput:    data.placeholder  = "..."
              data.type         = "Text" | "URL" | "Email"

# Layout patterns to prefer

For an "input + button + result" dashboard:
  - input  at (x:0, y:0, w:4, h:4)
  - button at (x:0, y:4, w:4, h:3)
  - result at (x:4, y:0, w:8, h:18)

For an "overview" dashboard:
  - 3-4 stat cards across the top (each w:3 or w:4, h:5-6, y:0)
  - a chart or table below filling the width (y:6+)

# Worked example — the platform's reference dashboard

USER PROMPT: "URL scraper. Input on the left, scrape button below it, result panel on the right."
RESOURCE: { "name": "nexus-scrape", "type": "agent", "endpoints": [{"method":"POST","path":"/public/scrape"}] }

VALID OUTPUT:
{
  "components": [
    {
      "id": "url-input",
      "type": "TextInput",
      "label": "URL to scrape",
      "layout": { "x": 0, "y": 0, "w": 4, "h": 4 },
      "style": { "backgroundColor": "#ffffff", "borderColor": "#e5e7eb",
                 "borderWidth": 1, "textColor": "#0f1117",
                 "borderRadius": 10, "padding": 16 },
      "data": { "placeholder": "https://example.com", "type": "URL" }
    },
    {
      "id": "btn-scrape",
      "type": "Button",
      "label": "⚡ Scrape",
      "layout": { "x": 0, "y": 4, "w": 4, "h": 3 },
      "style": { "backgroundColor": "#2563eb", "borderColor": "#2563eb",
                 "borderWidth": 1, "textColor": "#ffffff",
                 "borderRadius": 10, "padding": 16 },
      "data": { "dbBinding": "queries.run-scrape.trigger", "loadingState": true }
    },
    {
      "id": "result-area",
      "type": "Text",
      "label": "Scraped content",
      "layout": { "x": 4, "y": 0, "w": 8, "h": 18 },
      "style": { "backgroundColor": "#ffffff", "borderColor": "#e5e7eb",
                 "borderWidth": 1, "textColor": "#0f1117",
                 "fontFamily": "Fira Code", "fontSize": 12,
                 "borderRadius": 12, "padding": 16,
                 "overflow": "Scroll", "lineHeight": 1.5 },
      "data": { "dbBinding": "{{queries.run-scrape.data.content}}",
                "mockValue": "Result will appear here after scraping completes." }
    }
  ],
  "queries": [
    {
      "name": "run-scrape",
      "resource": "nexus-scrape",
      "endpoint": "/public/scrape",
      "method": "POST",
      "trigger": "manual",
      "body": { "url": "{{componentState.url-input.value}}" }
    }
  ]
}

Notice: button uses `queries.run-scrape.trigger` (no braces). Text uses
`{{queries.run-scrape.data.content}}` (with braces). Body templates the input.

# Worked example — polished analytics dashboard (component-specific properties)

USER PROMPT: "Sales analytics dashboard. KPI cards at top, revenue trend, orders table."
RESOURCE: { "name": "analytics-api", "type": "REST", "endpoints": [
  {"method":"GET","path":"/metrics/summary"},
  {"method":"GET","path":"/metrics/revenue-trend"},
  {"method":"GET","path":"/orders"}
] }

VALID OUTPUT — every component uses specific style/data properties beyond base colors:
{
  "components": [
    {
      "id": "stat-revenue", "type": "StatCard", "label": "Monthly Revenue",
      "layout": {"x":0,"y":0,"w":3,"h":5},
      "style": {
        "backgroundGradient": {"enabled":true,"direction":135,
          "stops":[{"color":"#1e40af","position":0},{"color":"#2563eb","position":100}]},
        "borderLeftColor":"#60a5fa","borderLeftWidth":4,
        "textColor":"#ffffff","metricFontSize":32,"labelFontSize":13,
        "borderRadius":12,"padding":20
      },
      "data": {"mockValue":"$48,200","prefix":"$","trend":"+12%","trendType":"positive",
               "dbBinding":"{{queries.get-summary.data.revenue}}"}
    },
    {
      "id": "stat-orders", "type": "StatCard", "label": "Total Orders",
      "layout": {"x":3,"y":0,"w":3,"h":5},
      "style": {
        "backgroundColor":"#f0fdf4","borderLeftColor":"#16a34a","borderLeftWidth":4,
        "metricFontSize":32,"labelFontSize":13,"borderRadius":12,"padding":20
      },
      "data": {"mockValue":"1,284","trend":"+8%","trendType":"positive",
               "dbBinding":"{{queries.get-summary.data.order_count}}"}
    },
    {
      "id": "stat-aov", "type": "StatCard", "label": "Avg Order Value",
      "layout": {"x":6,"y":0,"w":3,"h":5},
      "style": {
        "backgroundColor":"#fefce8","borderLeftColor":"#d97706","borderLeftWidth":4,
        "metricFontSize":32,"labelFontSize":13,"borderRadius":12,"padding":20
      },
      "data": {"mockValue":"$37.55","prefix":"$","trend":"+3%","trendType":"positive",
               "dbBinding":"{{queries.get-summary.data.aov}}"}
    },
    {
      "id": "stat-churn", "type": "StatCard", "label": "Churn Rate",
      "layout": {"x":9,"y":0,"w":3,"h":5},
      "style": {
        "backgroundColor":"#fff1f2","borderLeftColor":"#e11d48","borderLeftWidth":4,
        "metricFontSize":32,"labelFontSize":13,"borderRadius":12,"padding":20
      },
      "data": {"mockValue":"2.4%","suffix":"%","trend":"-0.3%","trendType":"negative",
               "dbBinding":"{{queries.get-summary.data.churn_rate}}"}
    },
    {
      "id": "chart-trend", "type": "LineChart", "label": "Revenue Over Time",
      "layout": {"x":0,"y":5,"w":8,"h":11},
      "style": {
        "backgroundColor":"#ffffff","borderColor":"#e5e7eb",
        "seriesColors":["#2563eb","#7c3aed","#059669"],
        "gridColor":"#f1f5f9","axisColor":"#94a3b8","borderRadius":12
      },
      "data": {"showGrid":true,"showLegend":true,"xField":"date",
               "series":[{"name":"Revenue","fieldKey":"revenue"}],"smooth":true,
               "dbBinding":"{{queries.get-trend.data}}"}
    },
    {
      "id": "chart-category", "type": "BarChart", "label": "Revenue by Category",
      "layout": {"x":8,"y":5,"w":4,"h":11},
      "style": {
        "backgroundColor":"#ffffff","borderColor":"#e5e7eb",
        "seriesColors":["#2563eb","#7c3aed","#0891b2","#059669"],
        "gridColor":"#f1f5f9","axisColor":"#94a3b8","borderRadius":12
      },
      "data": {"showGrid":true,"showLegend":false,"xField":"category",
               "series":[{"name":"Amount","fieldKey":"amount"}],"dbBinding":"{{queries.get-trend.data}}"}
    },
    {
      "id": "tbl-orders", "type": "Table", "label": "Recent Orders",
      "layout": {"x":0,"y":16,"w":12,"h":12},
      "style": {
        "backgroundColor":"#ffffff","borderColor":"#e5e7eb",
        "headerBackgroundColor":"#f8fafc","headerTextColor":"#374151",
        "rowHoverColor":"#f0f9ff","stripeRows":true,
        "searchBarBackground":"#f9fafb","borderRadius":12
      },
      "data": {
        "searchable":true,"pagination":true,
        "columns":[
          {"name":"Order ID","fieldKey":"id"},
          {"name":"Customer","fieldKey":"customer_name"},
          {"name":"Amount","fieldKey":"amount"},
          {"name":"Status","fieldKey":"status"},
          {"name":"Date","fieldKey":"created_at"}
        ],
        "dbBinding":"{{queries.get-orders.data}}"
      }
    }
  ],
  "queries": [
    {"name":"get-summary","resource":"analytics-api","endpoint":"/metrics/summary",
     "method":"GET","trigger":"onLoad"},
    {"name":"get-trend","resource":"analytics-api","endpoint":"/metrics/revenue-trend",
     "method":"GET","trigger":"onLoad"},
    {"name":"get-orders","resource":"analytics-api","endpoint":"/orders",
     "method":"GET","trigger":"onLoad","params":{"limit":"50","sort":"created_at:desc"}}
  ]
}

Notice: StatCards use backgroundGradient OR colored backgroundColor, always with
borderLeftColor/Width, metricFontSize, labelFontSize, trend/trendType.
Charts use seriesColors, gridColor, axisColor, showGrid, showLegend, xField, series.
Table uses headerBackgroundColor, stripeRows, rowHoverColor, searchBarBackground,
searchable, pagination, and explicit columns.
Every component goes well beyond the base backgroundColor/borderColor/textColor.
"""


def _format_resource_block(resource: ResourceContext) -> str:
    """Render one resource + its endpoints as compact, LLM-friendly text."""
    lines = [
        f"- {resource.name} ({resource.type})"
        + (f" — base_url: {resource.base_url}" if resource.base_url else ""),
    ]
    if resource.endpoints:
        for ep in resource.endpoints[:60]:  # safety cap on huge swaggers
            summary = f" — {ep.summary}" if ep.summary else ""
            lines.append(f"    {ep.method.upper():6} {ep.path}{summary}")
        if len(resource.endpoints) > 60:
            lines.append(f"    ...and {len(resource.endpoints) - 60} more endpoints")
    else:
        lines.append("    (no endpoints catalogued — generate sensible paths from context)")
    return "\n".join(lines)


def build_system_prompt() -> str:
    return (
        "You are a senior product designer and frontend engineer.\n"
        "Design a production-quality dashboard, then output ONE valid JSON config.\n\n"
        f"{SCHEMA_RULES}\n\n"
        f"{format_capabilities_for_prompt()}\n\n"
        "## Design quality rules — follow these on every generation\n"
        "- Use at least 3 component-specific style/data properties per component.\n"
        "- Do NOT generate identical-looking components (same bg, no accent, no data config).\n"
        "- StatCards MUST use: metricFontSize, labelFontSize, borderLeftColor, borderLeftWidth.\n"
        "  Use backgroundGradient on the primary/hero StatCard.\n"
        "  Always include trend and trendType when the metric has a direction.\n"
        "- Charts MUST use: seriesColors, gridColor, axisColor, showGrid, showLegend,\n"
        "  xField, series. Set smooth:true on LineCharts.\n"
        "- Tables MUST use: headerBackgroundColor, stripeRows:true, rowHoverColor,\n"
        "  searchable:true, pagination:true, and explicit columns array.\n"
        "- Buttons MUST stand out: set variant, fontWeight:600, and hoverBackgroundColor.\n"
        "  Always set loadingState:true on buttons that fire queries.\n"
        "- LogsViewer MUST set fontFamily:'Fira Code', infoColor, warnColor, errorColor,\n"
        "  messageField, levelField, timestampField.\n"
        "- Text components for long content MUST set overflow:'Scroll', lineHeight:1.6.\n"
        "- TabbedContainer MUST set tabHeaderActiveBackground and tabStyle.\n"
        "  tabs must be a plain string array: [\"Overview\", \"Details\"] — NOT objects.\n"
        "- Visual hierarchy: StatCards at y:0, charts/tables below.\n"
        "\n"
        "## Hard constraints\n"
        "- Use ONLY resources from the supplied list. Never invent a resource name.\n"
        "- Use ONLY endpoints from the supplied catalog when one exists.\n"
        "- There must be one clear primary query path that drives the dashboard.\n"
        "- StatCards/charts/tables should derive from related datasets, not isolated sources.\n"
        "- Every filter/input must influence at least one query or bound output.\n"
        "- Every component referencing a query must point at a query you also define.\n"
        "- Every query.resource must match a resource.name from the supplied list.\n"
        "- Get the {{ }} binding rules right — Buttons NO braces, Tables/StatCards/Text WITH braces.\n"
        "- Use kebab-case ids that don't conflict (`stat-total`, `tbl-orders`, etc).\n"
        "- Pick a coherent design system: one accent color, neutral backgrounds, subtle borders.\n"
        "- Maintain clear visual hierarchy and consistent spacing.\n"
        "- Components must not overlap on the grid (sum of x..x+w should not collide on the same row).\n"
        "\n"
        "## Async / agent resources — IMPORTANT\n"
        "If a resource has type='agent', the platform's agent executor handles\n"
        "the full kickoff → poll → result loop automatically. For each agent\n"
        "resource, create EXACTLY ONE query that POSTs to the kickoff endpoint\n"
        "(e.g. /scrape, /run, /jobs). The executor will internally poll the\n"
        "result endpoint until completion and return the FINAL result payload\n"
        "as `queries.<name>.data`. So:\n"
        "  - Do NOT create a second query that GETs the /result/{id} endpoint.\n"
        "  - Do NOT chain a result-fetch query off the kickoff. It will 405.\n"
        "  - Bind display components directly to the kickoff query's data,\n"
        "    e.g. `{{queries.run-scrape.data.content}}` for the final result.\n"
        "  - Status badges read `{{queries.<name>.data.status}}` (will show\n"
        "    'done' when the executor finishes polling).\n"
        "\n"
        "## Common response fields — DO NOT invent field names\n"
        "When binding display components to query data, use REAL field names\n"
        "the API actually returns. Don't invent friendly-sounding fields.\n"
        "If you don't know the response shape, prefer the WHOLE object:\n"
        "    `{{queries.X.data}}`\n"
        "and let the user drill in.\n"
        "\n"
        "Common conventions (use these field names, not synonyms):\n"
        "  Async/agent results:        .content   (NOT .markdown, .scraped_text, .body)\n"
        "                              .status    ('queued' | 'running' | 'done' | 'error')\n"
        "                              .error     (string when status='error')\n"
        "                              .elapsed_ms .url .output_format\n"
        "  REST search/list:           .data | .results | .items | .products | .users\n"
        "                              .total | .count | .meta\n"
        "  Single-object GETs:         the response is the object itself —\n"
        "                              bind to `{{queries.X.data}}` or drill into known fields\n"
        "\n"
        "If a resource's endpoint catalog (or the user's prompt) names a\n"
        "specific field, use it. Otherwise fall back to the conventions above.\n"
        "When in doubt, bind to the whole object — broken binding is worse than\n"
        "a slightly-noisy display.\n"
        "\n"
        "Output a SINGLE valid JSON object matching the response schema. No prose, no markdown."
    )


def build_user_prompt(req: GenerateRequest, dashboard_type: DashboardType, confidence: float) -> str:
    sections = [f"## What the user wants\n{req.prompt.strip()}\n"]
    sections.append(
        "## Dashboard type\n"
        f"This dashboard is classified as `{dashboard_type}` (confidence {confidence}).\n"
        "Follow this layout structure strictly unless the prompt explicitly conflicts:\n"
        f"{ARCHETYPE_RULES[dashboard_type]}\n"
    )
    sections.append(
        "## Component relationship rules\n"
        "- No isolated components.\n"
        "- Every chart/table/log viewer must map to a query dataset.\n"
        "- Every button should trigger a manual query.\n"
        "- Prefer predictable layouts over random placement.\n"
    )

    if req.resources:
        sections.append("## Available resources & endpoints")
        sections.append("Use the names below verbatim when wiring queries.\n")
        for resource in req.resources:
            sections.append(_format_resource_block(resource))
        sections.append("")
    else:
        sections.append(
            "## Available resources & endpoints\n"
            "(none — generate a mock-only dashboard with components but no queries)\n"
        )

    if req.docs_urls:
        sections.append("## Reference docs (context only — no fetching)")
        for url in req.docs_urls:
            sections.append(f"- {url}")
        sections.append("")

    sections.append(
        "Return ONE dashboard config now. The platform will derive colour-scheme "
        "variants from this base programmatically — focus on getting the components, "
        "queries, layout, and bindings correct."
    )

    return "\n".join(sections)
