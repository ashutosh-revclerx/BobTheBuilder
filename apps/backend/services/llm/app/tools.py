"""
Callable tools exposed to the LLM.

The component capabilities registry remains the source of truth. This module
wraps it in a small, typed function-call surface so the model can fetch exact
component properties instead of guessing.
"""

from __future__ import annotations

import logging
from functools import lru_cache
from typing import Any

from google.genai import types

from .component_capabilities import COMPONENT_CAPABILITIES

logger = logging.getLogger("llm.tools")

PROPERTY_HINTS: dict[str, str] = {
    # Core visual tokens
    "backgroundColor": "hex color string, e.g. '#0f172a'",
    "textColor": "hex color string, e.g. '#e2e8f0'",
    "fontFamily": "CSS font family string, e.g. 'Inter' or 'Fira Code'",
    "fontSize": "number in px, e.g. 14",
    "fontStyle": "one of: 'normal' | 'italic'",
    "fontWeight": "number, e.g. 400 | 500 | 600 | 700",
    "letterSpacing": "number, e.g. 0",
    "textTransform": "one of: 'none' | 'uppercase' | 'capitalize'",
    "borderRadius": "number in px, e.g. 8",
    "borderColor": "hex color string",
    "borderWidth": "number in px",
    "padding": "number in px",
    "lineHeight": "number, e.g. 1.4",
    "textAlign": "one of: 'Left' | 'Center' | 'Right' | 'Justify'",
    "overflow": "one of: 'Wrap' | 'Truncate' | 'Scroll'",
    "shape": "one of: 'Rounded' | 'Pill' | 'Square'",
    "variant": "component variant string, e.g. 'Primary' | 'Secondary' | 'Danger' | 'Ghost' | 'Clean' | 'Zebra' | 'Bordered'",
    "iconLeft": "icon name string or empty string",
    "fullWidth": "boolean",
    "hoverBackgroundColor": "hex color string",
    "alignItems": "one of: 'Start' | 'Center' | 'End' | 'Stretch'",
    "justifyContent": "one of: 'Start' | 'Center' | 'End' | 'Space Between' | 'Space Around'",

    # Gradient
    "seriesColors": "array of hex colors, e.g. ['#2563eb', '#10b981']",
    "gridColor": "hex color string or rgba string",
    "axisColor": "hex color string",
    "xAxisColor": "hex color string",
    "yAxisColor": "hex color string",
    "showDataLabels": "boolean",
    "visible": "boolean or expression string",
    "visibleForRoles": "array of role strings",
    "dbBinding": "binding string like '{{queries.myQuery.data}}'",
    "backgroundGradient": (
        "object: { enabled: boolean, direction: number(0-360), "
        "stops: [{ color: '#RRGGBB', position: number(0-100) }, ...] }; "
        "use 2-3 stops; positions increasing from 0 to 100"
    ),

    # Table style/data
    "headerBackgroundColor": "hex color string",
    "rowAlternateColor": "hex color string",
    "selectedRowColor": "hex color string",
    "stripeRows": "boolean",
    "strikethrough": "boolean",
    "strikethroughField": "row field key string",
    "strikethroughValue": "string or number to match",
    "searchBarBackground": "hex color string",
    "searchBarTextColor": "hex color string",
    "searchBarBorderColor": "hex color string",
    "columns": "array of objects: [{ name: string, fieldKey: string }]",
    "rows": "array of row objects, e.g. [{ col1: 'A', col2: 10 }]",
    "searchable": "boolean",
    "pagination": "boolean",
    "allowAddRows": "boolean",
    "conditionalRowColor": "array: [{ field: string, operator: '='|'!='|'>'|'<'|'contains', value: string, color: '#RRGGBB' }]",
    "columnVisibility": "object map: { fieldKey: boolean }",
    "onRowSelectAction": "action name string",

    # Charts
    "barRadius": "number in px",
    "lineWidth": "number in px",
    "xField": "string field key in each data row",
    "yField": "string field key in each data row",
    "series": "array of objects: [{ name: string, fieldKey: string }]",
    "showLegend": "boolean",
    "showGrid": "boolean",
    "xAxisLabel": "string",
    "yAxisLabel": "string",
    "showXAxis": "boolean",
    "showYAxis": "boolean",
    "colorScheme": "one of: 'Blue' | 'Green' | 'Amber' | 'Multi'",
    "orientation": "one of: 'Vertical' | 'Horizontal'",
    "stacked": "boolean",
    "smooth": "boolean",
    "showDots": "boolean",
    "fillArea": "boolean",
    "onBarClickAction": "action name string",
    "onPointClickAction": "action name string",

    # StatCard / StatusBadge
    "metricFontSize": "number in px",
    "labelFontSize": "number in px",
    "borderLeftColor": "hex color string",
    "borderLeftWidth": "number in px",
    "trendColorOverride": "hex color string",
    "mutedColor": "hex color string",
    "fieldName": "string key to read from bound object",
    "prffix": "legacy key in this schema; prefix text after value (string)",
    "coefix": "legacy key in this schema; prefix text before value (string)",
    "sumparisonValue": "legacy key in this schema; comparison caption string",
    "trend": "trend label string, e.g. '+12%'",
    "trendType": "one of: 'positive' | 'negative' | 'neutral'",
    "sparklineData": "array of numbers, e.g. [10, 20, 15, 30]",
    "mapping": "object map: { statusValue: '#RRGGBB' }",
    "defaultColor": "hex color string",
    "showDot": "boolean",
    "size": "one of: 'Small' | 'Medium' | 'Large'",
    "symbol": "one of: 'Dot' | 'Check' | 'Warning' | 'None'",

    # Logs
    "levelColors": "object: { INFO: '#RRGGBB', WARN: '#RRGGBB', ERROR: '#RRGGBB', DEBUG: '#RRGGBB' }",
    "levelFilter": "one of: 'all' | 'info' | 'warn' | 'error'",
    "logSearchable": "boolean",
    "maxLines": "number",
    "autoScroll": "boolean",
    "timestampField": "string field name",
    "levelField": "string field name",
    "messageField": "string field name",
    "wrapLines": "boolean",

    # Inputs
    "labelPosition": "one of: 'Top' | 'Left' | 'Hidden'",
    "focusBorderColor": "hex color string",
    "label": "string",
    "placeholder": "string",
    "type": "for TextInput: 'Text' | 'Email' | 'Password' | 'URL' | 'Search'",
    "required": "boolean",
    "regex": "regex pattern string",
    "errorMessage": "string",
    "maxLength": "number or null",
    "onChangeAction": "action name string",
    "onSubmitAction": "action/query trigger string",
    "min": "number",
    "max": "number",
    "step": "number",
    "prefix": "string",
    "suffix": "string",
    "formatter": "one of: 'None' | 'Currency' | 'Percentage' | 'Compact'",
    "showStepper": "boolean",
    "options": "array of strings",
    "optionsList": "array: [{ label: string, value: string }]",
    "multiSelect": "boolean",
    "optionsSource": "one of: 'Static' | 'From query'",
    "labelField": "string field name",
    "valueField": "string field name",

    # Button actions
    "disabled": "boolean expression string, e.g. 'false' or '{{...}}'",
    "loadingState": "boolean",
    "confirmationDialog": "boolean",
    "confirmationMessage": "string",
    "confirmLabel": "string",
    "cancelLabel": "string",
    "onSuccessAction": "action name string",
    "onErrorAction": "action name string",

    # Container / tabs
    "containerLayout": "one of: 'vertical' | 'horizontal'",
    "gap": "number in px",
    "scrollable": "boolean",
    "divider": "boolean",
    "tabPosition": "one of: 'Top' | 'Bottom' | 'Left'",
    "tabStyle": "one of: 'Underline' | 'Pills' | 'Boxed'",
    "tabHeaderBackground": "hex color string",
    "tabHeaderTextColor": "hex color string",
    "tabHeaderActiveBackground": "hex color string",
    "tabHeaderActiveTextColor": "hex color string",
    "tabHeaderBorderColor": "hex color string",
    "tabs": "array of tab labels, e.g. ['View 1', 'View 2']",
    "defaultTab": "string value that must exist in tabs[]",
    "onTabChangeAction": "action name string",
    "tabStyles": "object map: { tabName: Partial<ComponentStyle> }",

    # Text / media
    "expression": "boolean",
    "linkTo": "URL string",
    "enableLink": "boolean",
    "src": "URL string",
    "uploadedSrc": "data URL string for uploaded image, e.g. 'data:image/png;base64,...'",
    "fit": "one of: 'contain' | 'cover' | 'fill' | 'none' | 'scale-down'",
    "alt": "accessibility alt text string",

    # File upload / graph / chat
    "accept": "comma-separated extensions, e.g. '.xlsx,.csv,.pdf'",
    "multiple": "boolean",
    "uploadUrl": "URL string",
    "resourceId": "UUID string",
    "endpointPath": "endpoint path string, e.g. '/upload'",
}


TOOLS = [
    {
        "name": "get_component_capabilities",
        "description": "Fetch style and data properties for a UI component",
        "parameters": {
            "type": "object",
            "properties": {
                "component_type": {
                    "type": "string",
                    "description": "Component name like StatCard, Table",
                }
            },
            "required": ["component_type"],
        },
    }
]


def _properties_as_schema(properties: list[str]) -> dict[str, str]:
    """Turn the compact registry list into a property-description mapping."""
    return {name: PROPERTY_HINTS.get(name, "supported property") for name in properties}


@lru_cache(maxsize=64)
def get_component_capabilities(component_type: str) -> dict[str, Any]:
    """
    Returns style and data capabilities for a given component type.

    Unknown components return an empty dict so tool use stays optional and
    backward compatible.
    """
    capabilities = COMPONENT_CAPABILITIES.get(component_type)
    if not capabilities:
        logger.warning("component capability lookup failed: %s", component_type)
        return {}

    logger.info("component capability lookup: %s", component_type)
    return {
        "description": capabilities.get("description")
        or capabilities.get("visual_role", ""),
        "style": _properties_as_schema(capabilities.get("style", [])),
        "data": _properties_as_schema(capabilities.get("data", [])),
        "required": capabilities.get("required", {"style": [], "data": []}),
    }


def execute_tool(tool_name: str, arguments: dict[str, Any] | None) -> dict[str, Any]:
    """Dispatch one model-requested tool call."""
    arguments = arguments or {}

    if tool_name == "get_component_capabilities":
        component_type = str(arguments.get("component_type", "")).strip()
        return {
            "component_type": component_type,
            "capabilities": get_component_capabilities(component_type),
        }

    logger.warning("unknown tool requested: %s", tool_name)
    return {"error": f"Unknown tool: {tool_name}"}


def gemini_tools() -> list[types.Tool]:
    """Return Gemini SDK tool declarations."""
    return [
        types.Tool(
            function_declarations=[
                types.FunctionDeclaration(
                    name="get_component_capabilities",
                    description="Fetch style and data properties for a UI component",
                    parameters=types.Schema(
                        type="OBJECT",
                        properties={
                            "component_type": types.Schema(
                                type="STRING",
                                description="Component name like StatCard, Table",
                            )
                        },
                        required=["component_type"],
                    ),
                )
            ]
        )
    ]
