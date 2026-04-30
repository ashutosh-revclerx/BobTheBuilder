"""
Structured catalog of every supported component's available style and data properties.
Injected into the system prompt so Gemini knows what properties exist per component type.
"""

from __future__ import annotations

COMPONENT_CAPABILITIES: dict[str, dict] = {
    "StatCard": {
        "visual_role": "Top-level KPI metric card — highest visual priority on any dashboard",
        "style": [
            "backgroundGradient",       # gradient fill: { enabled, direction, stops: [{color, position}] }
            "borderLeftColor",          # accent stripe color on the left edge
            "borderLeftWidth",          # width of the left accent stripe (px)
            "metricFontSize",           # font size of the primary metric number (px, e.g. 28-40)
            "labelFontSize",            # font size of the card label/title (px, e.g. 11-14)
            "metricColor",              # color override for the metric value
            "mutedColor",               # color for secondary/label text
            "trendColorOverride",       # override the auto red/green trend color
            "padding",
            "borderRadius",
        ],
        "data": [
            "mockValue",                # fallback display value before data loads
            "fieldName",                # key to extract from bound data object
            "prefix",                   # e.g. "$" prepended to metric
            "suffix",                   # e.g. "%" appended to metric
            "trend",                    # e.g. "+12%" shown below metric
            "trendType",                # "positive" | "negative" | "neutral"
            "sparklineData",            # small inline chart array
            "dbBinding",
        ],
    },
    "Table": {
        "visual_role": "Dense data exploration — rows, columns, search, pagination",
        "style": [
            "headerBackgroundColor",    # background of the column header row
            "headerTextColor",          # text color of column headers
            "rowAlternateColor",        # alternating row background (if stripeRows true)
            "stripeRows",               # true | false — zebra striping
            "selectedRowColor",         # background of the currently selected row
            "rowHoverColor",            # row background on mouse hover
            "searchBarBackground",      # background of the search input
            "searchBarTextColor",
            "searchBarBorderColor",
        ],
        "data": [
            "columns",                  # [{ name, fieldKey }]
            "searchable",               # true | false
            "pagination",               # true | false
            "conditionalRowColor",      # { fieldKey, rules: [{value, color}] }
            "columnVisibility",         # { fieldKey: true|false }
            "dbBinding",
        ],
    },
    "BarChart": {
        "visual_role": "Categorical comparison — bars representing discrete values",
        "style": [
            "seriesColors",             # array of hex colors, one per series
            "gridColor",                # color of background grid lines
            "axisColor",                # color of axis lines and tick labels
            "axisLabelColor",
            "legendColor",
            "barRadius",                # corner radius on bars (px)
            "barGap",                   # gap between bar groups
        ],
        "data": [
            "showGrid",                 # true | false
            "showLegend",               # true | false
            "xField",                   # field name for the X axis
            "series",                   # [{ name, fieldKey }] fields to plot
            "stacked",                  # true | false — stacked bars
            "dbBinding",
        ],
    },
    "LineChart": {
        "visual_role": "Time-series trends — connected data points over time",
        "style": [
            "seriesColors",
            "gridColor",
            "axisColor",
            "axisLabelColor",
            "legendColor",
            "lineWidth",                # stroke width (px)
            "areaFill",                 # true | false — fill area under line
            "dotSize",                  # size of data point dots (px)
        ],
        "data": [
            "showGrid",
            "showLegend",
            "xField",
            "series",
            "smooth",                   # true | false — curved lines
            "dbBinding",
        ],
    },
    "LogsViewer": {
        "visual_role": "Scrollable log stream — entries colored by log level",
        "style": [
            "infoColor",                # color for INFO level entries
            "warnColor",                # color for WARN level entries
            "errorColor",               # color for ERROR level entries
            "debugColor",               # color for DEBUG level entries
            "levelColors",              # { info, warn, error, debug } override map
            "fontFamily",               # e.g. "Fira Code" for monospace look
            "fontSize",
            "lineHeight",
        ],
        "data": [
            "messageField",             # field name for the log message
            "levelField",               # field name for the log level
            "timestampField",           # field name for the timestamp
            "dbBinding",
        ],
    },
    "Button": {
        "visual_role": "Trigger action — fires a query or navigates",
        "style": [
            "variant",                  # "Primary" | "Secondary" | "Ghost" | "Danger"
            "hoverBackgroundColor",
            "activeBackgroundColor",
            "fontWeight",
            "fullWidth",                # true | false — stretches to container width
            "iconLeft",                 # icon name shown before label
            "iconRight",                # icon name shown after label
            "shape",                    # "Rounded" | "Pill" | "Square"
        ],
        "data": [
            "dbBinding",                # "queries.X.trigger" — NO braces
            "loadingState",             # true | false — shows spinner while query runs
            "confirmationDialog",       # true | false — ask before firing
        ],
    },
    "TextInput": {
        "visual_role": "Single-line text entry — feeds into query params or body",
        "style": [
            "focusBorderColor",
            "placeholderColor",
        ],
        "data": [
            "placeholder",
            "type",                     # "Text" | "URL" | "Email"
            "defaultValue",
        ],
    },
    "NumberInput": {
        "visual_role": "Numeric entry with optional min/max constraints",
        "style": [
            "focusBorderColor",
        ],
        "data": [
            "placeholder",
            "min",
            "max",
            "step",
            "defaultValue",
        ],
    },
    "Select": {
        "visual_role": "Dropdown picker — feeds selected value into queries",
        "style": [
            "focusBorderColor",
            "optionBackgroundColor",
            "optionHoverColor",
        ],
        "data": [
            "options",                  # [{ label, value }]
            "placeholder",
            "defaultValue",
            "dbBinding",
        ],
    },
    "Container": {
        "visual_role": "Layout wrapper — groups related components visually",
        "style": [
            "gap",
            "direction",                # "row" | "column"
            "headerBackgroundColor",
            "headerTextColor",
            "headerBorderColor",
        ],
        "data": [],
    },
    "TabbedContainer": {
        "visual_role": "Tabbed layout — organises multiple views in one panel",
        "style": [
            "tabHeaderBackground",
            "tabHeaderActiveBackground",  # background of the active tab button
            "tabHeaderTextColor",
            "tabHeaderActiveTextColor",
            "tabBorderColor",
            "tabStyle",                   # "underline" | "pill" | "boxed"
        ],
        "data": [
            "tabs",                       # string[] — plain tab names e.g. ["Overview","Details","Settings"]
            "defaultTab",                 # must match one of the tab name strings
        ],
    },
    "Text": {
        "visual_role": "Read-only text display — markdown, labels, or bound string values",
        "style": [
            "fontSize",
            "fontFamily",
            "fontWeight",
            "lineHeight",
            "overflow",                 # "Wrap" | "Scroll" | "Truncate"
            "textAlign",                # "Left" | "Center" | "Right"
        ],
        "data": [
            "dbBinding",
            "mockValue",
            "markdown",                 # true | false — render as markdown
        ],
    },
    "StatusBadge": {
        "visual_role": "Inline status chip — maps string values to colors",
        "style": [
            "badgeRadius",
            "fontSize",
            "fontWeight",
        ],
        "data": [
            "mapping",                  # { "ok": "#22c55e", "error": "#ef4444" }
            "defaultColor",
            "dbBinding",
        ],
    },
    "Image": {
        "visual_role": "Static or dynamic image — logo, chart screenshot, preview",
        "style": [
            "objectFit",                # "cover" | "contain" | "fill"
            "borderRadius",
        ],
        "data": [
            "src",                      # static image URL
            "alt",
            "dbBinding",                # dynamic URL from a query
        ],
    },
    "Embed": {
        "visual_role": "Iframe embed — external URL, report, or tool",
        "style": [
            "borderRadius",
        ],
        "data": [
            "url",                      # static URL to embed
            "dbBinding",                # dynamic URL from a query
            "allowFullscreen",
        ],
    },
}


def format_capabilities_for_prompt() -> str:
    """Return a compact, LLM-readable reference of all component properties."""
    lines = [
        "## Component-specific style & data properties",
        "",
        "Use these aggressively to create polished, visually distinct dashboards.",
        "Do NOT only set backgroundColor / textColor / borderColor on every component.",
        "",
    ]
    for ctype, cap in COMPONENT_CAPABILITIES.items():
        style_str = ", ".join(cap["style"]) if cap["style"] else "(none beyond base)"
        data_str  = ", ".join(cap["data"])  if cap["data"]  else "(none beyond dbBinding)"
        lines.append(f"{ctype} — {cap['visual_role']}")
        lines.append(f"  style: {style_str}")
        lines.append(f"  data:  {data_str}")
        lines.append("")
    return "\n".join(lines)
