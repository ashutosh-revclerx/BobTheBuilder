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
    return {name: "supported property" for name in properties}


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
                        type=types.Type.OBJECT,
                        properties={
                            "component_type": types.Schema(
                                type=types.Type.STRING,
                                description="Component name like StatCard, Table",
                            )
                        },
                        required=["component_type"],
                    ),
                )
            ]
        )
    ]
