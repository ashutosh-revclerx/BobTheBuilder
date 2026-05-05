"""
Structured catalog of supported dashboard component capabilities.

This mirrors the current frontend implementation in:
  - apps/frontend/src/types/template.ts
  - apps/frontend/src/components/dashboard-components/*

The registry is injected into the prompt and exposed through the LLM tool layer,
so keep it conservative: include properties the current components actually
accept/render, and avoid aspirational keys that the UI ignores.
"""

from __future__ import annotations

COMMON_CARD_STYLE = [
    "backgroundColor",      # hex color solid background
    "backgroundGradient",   # { enabled, direction, stops: [{ color, position }] }
    "textColor",            # hex color for primary text
    "fontFamily",           # CSS font family
    "fontSize",             # number in px
    "borderRadius",         # number in px
    "borderColor",          # hex color
    "borderWidth",          # number in px
    "padding",              # number in px
]

COMMON_VISIBILITY_DATA = [
    "visible",              # boolean or expression string
    "visibleForRoles",      # string[] role allow-list
    "mockValue",            # fallback display/input value
    "dbBinding",            # display binding, usually {{queries.name.data}}
]

INPUT_STYLE = [
    "backgroundColor",
    "backgroundGradient",
    "textColor",
    "fontFamily",
    "fontSize",
    "borderRadius",
    "borderColor",
    "borderWidth",
    "padding",
    "labelPosition",        # "Top" | "Left" | "Hidden"
    "focusBorderColor",     # editor-supported focus accent
]

CHART_STYLE = COMMON_CARD_STYLE + [
    "seriesColors",         # string[] of hex colors
    "gridColor",            # chart grid stroke color
    "axisColor",            # fallback axis/tick color
    "xAxisColor",           # x-axis/tick color override
    "yAxisColor",           # y-axis/tick color override
    "showDataLabels",       # boolean; renders value labels
]


COMPONENT_CAPABILITIES: dict[str, dict] = {
    "StatCard": {
        "description": "Top KPI card showing a single metric, trend, and optional sparkline.",
        "visual_role": "Top-level KPI metric card with the highest dashboard priority.",
        "style": COMMON_CARD_STYLE + [
            "metricFontSize",          # number in px for primary metric
            "labelFontSize",           # supported in editor/types for label sizing
            "borderLeftColor",         # variant/editor accent stripe color
            "borderLeftWidth",         # variant/editor accent stripe width in px
            "trendColorOverride",      # hex color override for trend text/sparkline
            "mutedColor",              # variant-generated muted text color
        ],
        "data": COMMON_VISIBILITY_DATA + [
            "fieldName",               # key to extract from bound object
            "prefix",                  # text before value, e.g. "$"
            "suffix",                  # text after value, e.g. "%"
            "trend",                   # trend text, e.g. "+12%"
            "trendType",               # "positive" | "negative" | "neutral"
            "comparisonValue",         # secondary comparison caption
            "sparklineData",           # number[] rendered as small bars
        ],
        "required": {
            "style": ["metricFontSize", "borderLeftColor", "borderLeftWidth"],
            "data": ["dbBinding"],
        },
    },
    "Table": {
        "description": "Tabular data display with optional search, pagination, row selection, and inline rows.",
        "visual_role": "Dense data exploration and source-of-truth row display.",
        "style": COMMON_CARD_STYLE + [
            "variant",                 # "Clean" | "Zebra" | "Bordered"
            "headerBackgroundColor",   # header row background
            "rowAlternateColor",       # alternating row background
            "selectedRowColor",        # selected row background
            "stripeRows",              # boolean zebra striping
            "strikethrough",           # boolean row text decoration rule
            "strikethroughField",      # row field used for strike rule
            "strikethroughValue",      # row value used for strike rule
            "searchBarBackground",     # search input background
            "searchBarTextColor",      # search input text
            "searchBarBorderColor",    # search input border
        ],
        "data": COMMON_VISIBILITY_DATA + [
            "columns",                 # [{ name, fieldKey }]
            "rows",                    # local fallback/editable rows
            "searchable",              # boolean
            "pagination",              # boolean
            "allowAddRows",            # boolean; enables add row in editor/runtime
            "conditionalRowColor",     # [{ field, operator, value, color }]
            "columnVisibility",        # { fieldKey: boolean }
            "onRowSelectAction",       # action name
        ],
        "required": {
            "style": ["headerBackgroundColor", "stripeRows"],
            "data": ["columns", "dbBinding"],
        },
    },
    "BarChart": {
        "description": "Categorical comparison chart using vertical or horizontal bars.",
        "visual_role": "Compares discrete categories or series.",
        "style": CHART_STYLE + [
            "barRadius",               # number in px
        ],
        "data": COMMON_VISIBILITY_DATA + [
            "xField",                  # category field
            "yField",                  # single value field shortcut
            "series",                  # [{ name, fieldKey }]
            "showLegend",              # boolean
            "showGrid",                # boolean
            "xAxisLabel",              # label string
            "yAxisLabel",              # label string
            "showXAxis",               # boolean
            "showYAxis",               # boolean
            "colorScheme",             # "Blue" | "Green" | "Amber" | "Multi"
            "orientation",             # "Vertical" | "Horizontal"
            "stacked",                 # boolean
            "onBarClickAction",        # action name
        ],
        "required": {
            "style": ["seriesColors", "gridColor", "axisColor"],
            "data": ["xField", "series", "dbBinding"],
        },
    },
    "LineChart": {
        "description": "Time-series or ordered trend chart with optional area fill and point actions.",
        "visual_role": "Shows trends and movement over time or ordered categories.",
        "style": CHART_STYLE + [
            "lineWidth",               # number in px
        ],
        "data": COMMON_VISIBILITY_DATA + [
            "xField",
            "yField",
            "series",
            "showLegend",
            "showGrid",
            "xAxisLabel",
            "yAxisLabel",
            "showXAxis",
            "showYAxis",
            "colorScheme",
            "smooth",                  # boolean; false uses linear segments
            "showDots",                # boolean
            "fillArea",                # boolean
            "onPointClickAction",      # action name
        ],
        "required": {
            "style": ["seriesColors", "gridColor", "axisColor", "lineWidth"],
            "data": ["xField", "series", "dbBinding"],
        },
    },
    "LogsViewer": {
        "description": "Scrollable log stream with level colors, search, filtering, and auto-scroll.",
        "visual_role": "Terminal-like event/log inspection surface.",
        "style": COMMON_CARD_STYLE + [
            "lineHeight",
            "levelColors",             # { INFO, WARN, ERROR, DEBUG }
            "searchBarBackground",
            "searchBarTextColor",
            "searchBarBorderColor",
        ],
        "data": COMMON_VISIBILITY_DATA + [
            "levelFilter",             # "all" | "info" | "warn" | "error"
            "logSearchable",           # boolean
            "maxLines",                # number
            "autoScroll",              # boolean
            "timestampField",          # field name
            "levelField",              # field name
            "messageField",            # field name
            "wrapLines",               # boolean
        ],
        "required": {
            "style": ["fontFamily", "levelColors"],
            "data": ["messageField", "levelField", "timestampField", "dbBinding"],
        },
    },
    "Button": {
        "description": "Action button that can trigger a query with loading, confirmation, and callbacks.",
        "visual_role": "Primary interaction trigger.",
        "style": [
            "backgroundColor",
            "backgroundGradient",
            "textColor",
            "fontFamily",
            "fontStyle",
            "fontWeight",
            "letterSpacing",
            "textTransform",
            "borderRadius",
            "borderColor",
            "borderWidth",
            "padding",
            "fullWidth",
            "iconLeft",
            "hoverBackgroundColor",
            "variant",
            "shape",
        ],
        "data": COMMON_VISIBILITY_DATA + [
            "disabled",                # boolean expression string
            "loadingState",            # boolean
            "confirmationDialog",      # boolean
            "confirmationMessage",     # string
            "confirmLabel",            # string
            "cancelLabel",             # string
            "onSuccessAction",         # action name
            "onErrorAction",           # action name
        ],
        "required": {
            "style": ["variant", "fontWeight", "hoverBackgroundColor"],
            "data": ["dbBinding"],
        },
    },
    "TextInput": {
        "description": "Single-line text input that writes to componentState[id].value.",
        "visual_role": "User text entry for query params or request bodies.",
        "style": INPUT_STYLE,
        "data": COMMON_VISIBILITY_DATA + [
            "label",
            "placeholder",
            "type",                    # "Text" | "Email" | "Password" | "URL" | "Search"
            "required",
            "regex",
            "errorMessage",
            "maxLength",
            "onChangeAction",
            "onSubmitAction",          # query trigger binding/action
        ],
        "required": {"style": [], "data": ["placeholder", "type"]},
    },
    "NumberInput": {
        "description": "Numeric input with min/max validation, step size, and formatted helper output.",
        "visual_role": "User numeric entry for filters, params, and workflow inputs.",
        "style": INPUT_STYLE + [
            "showStepper",             # false hides formatted helper
        ],
        "data": COMMON_VISIBILITY_DATA + [
            "label",
            "min",
            "max",
            "step",
            "required",
            "prefix",
            "suffix",
            "formatter",               # "None" | "Currency" | "Percentage" | "Compact"
            "errorMessage",
            "onChangeAction",
        ],
        "required": {"style": [], "data": []},
    },
    "Select": {
        "description": "Dropdown or multi-select input with static or query-derived options.",
        "visual_role": "Option picker for filters and workflow inputs.",
        "style": INPUT_STYLE,
        "data": COMMON_VISIBILITY_DATA + [
            "label",
            "options",                 # string[]
            "optionsList",             # [{ label, value }]
            "multiSelect",
            "optionsSource",           # "Static" | "From query"
            "labelField",              # dynamic option label field
            "valueField",              # dynamic option value field
            "required",
            "onChangeAction",
        ],
        "required": {"style": [], "data": ["options"]},
    },
    "Container": {
        "description": "Layout wrapper that hosts child components on a nested grid.",
        "visual_role": "Groups related components and controls nested layout spacing.",
        "style": COMMON_CARD_STYLE + [
            "alignItems",              # "Start" | "Center" | "End" | "Stretch"
            "justifyContent",          # "Start" | "Center" | "End" | "Space Between" | "Space Around"
        ],
        "data": [
            "containerLayout",         # editor-supported "vertical" | "horizontal"
            "gap",                     # nested grid gap
            "scrollable",              # boolean
            "divider",                 # boolean top divider inside container
            "visible",
            "visibleForRoles",
        ],
        "required": {"style": [], "data": []},
    },
    "TabbedContainer": {
        "description": "Tabbed layout wrapper that hosts child components per tab.",
        "visual_role": "Organizes multiple views in one bounded area.",
        "style": COMMON_CARD_STYLE + [
            "tabPosition",             # "Top" | "Bottom" | "Left"
            "tabStyle",                # "Underline" | "Pills" | "Boxed"
            "tabHeaderBackground",
            "tabHeaderTextColor",
            "tabHeaderActiveBackground",
            "tabHeaderActiveTextColor",
            "tabHeaderBorderColor",
        ],
        "data": [
            "tabs",                    # string[]
            "defaultTab",              # must match a tab string
            "onTabChangeAction",
            "tabStyles",               # { tabName: Partial<ComponentStyle> }
            "gap",
            "visible",
            "visibleForRoles",
        ],
        "required": {
            "style": ["tabHeaderActiveBackground", "tabStyle"],
            "data": ["tabs"],
        },
    },
    "Text": {
        "description": "Read-only text block for labels, long content, JSON, or bound values.",
        "visual_role": "Displays static or bound text/content.",
        "style": COMMON_CARD_STYLE + [
            "fontWeight",
            "lineHeight",
            "overflow",                # "Wrap" | "Truncate" | "Scroll"
            "textAlign",               # "Left" | "Center" | "Right" | "Justify"
            "textTransform",           # "none" | "uppercase" | "capitalize"
        ],
        "data": COMMON_VISIBILITY_DATA + [
            "expression",              # boolean; evaluate string expression
            "linkTo",                  # URL opened on click
            "enableLink",              # editor-supported link toggle
        ],
        "required": {"style": [], "data": []},
    },
    "StatusBadge": {
        "description": "Status chip with value-to-color mapping and optional symbol.",
        "visual_role": "Compact health/status indicator.",
        "style": COMMON_CARD_STYLE + [
            "shape",                   # "Rounded" | "Pill" | "Square"
            "fontWeight",
        ],
        "data": COMMON_VISIBILITY_DATA + [
            "mapping",                 # { statusValue: hexColor }
            "defaultColor",
            "showDot",                 # editor-supported
            "size",                    # "Small" | "Medium" | "Large"
            "symbol",                  # "Dot" | "Check" | "Warning" | "None"
        ],
        "required": {
            "style": ["shape"],
            "data": ["dbBinding", "mapping"],
        },
    },
    "Image": {
        "description": "Static or uploaded image with optional outbound link.",
        "visual_role": "Visual media, logo, preview, or screenshot.",
        "style": COMMON_CARD_STYLE,
        "data": COMMON_VISIBILITY_DATA + [
            "src",                     # image URL
            "uploadedSrc",             # base64 data URL
            "alt",
            "fit",                     # "contain" | "cover" | "fill" | "none" | "scale-down"
            "linkTo",
        ],
        "required": {"style": [], "data": ["src"]},
    },
    "Embed": {
        "description": "Sandboxed iframe embed for YouTube, Vimeo, Loom, reports, or iframe-friendly URLs.",
        "visual_role": "External interactive/media embed.",
        "style": COMMON_CARD_STYLE,
        "data": COMMON_VISIBILITY_DATA + [
            "src",                     # URL to embed; YouTube/Vimeo/Loom are normalized
        ],
        "required": {"style": [], "data": ["src"]},
    },
}


def format_capabilities_for_prompt() -> str:
    """Return a compact, LLM-readable reference of all component properties."""
    lines = [
        "## Component-specific style & data properties",
        "",
        "Use these aggressively to create polished, visually distinct dashboards.",
        "Most components support backgroundGradient:",
        "{ enabled: true, direction: 90, stops: [{ color: '#hex', position: 0 }, { color: '#hex', position: 100 }] }.",
        "Do NOT invent properties outside this registry.",
        "",
    ]
    for ctype, cap in COMPONENT_CAPABILITIES.items():
        style_str = ", ".join(cap["style"]) if cap["style"] else "(none)"
        data_str = ", ".join(cap["data"]) if cap["data"] else "(none)"
        required = cap.get("required", {"style": [], "data": []})
        required_style = ", ".join(required.get("style", [])) or "(none)"
        required_data = ", ".join(required.get("data", [])) or "(none)"

        lines.append(f"{ctype} - {cap['visual_role']}")
        lines.append(f"  style: {style_str}")
        lines.append(f"  data:  {data_str}")
        lines.append(f"  required.style: {required_style}")
        lines.append(f"  required.data:  {required_data}")
        lines.append("")
    return "\n".join(lines)
