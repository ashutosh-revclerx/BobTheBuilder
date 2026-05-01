"""
Deterministic design enrichment pass.

Runs after Gemini returns valid JSON and before variants are derived.
Uses setdefault throughout — fills gaps only, never overrides AI decisions.
"""

from __future__ import annotations

import copy
from typing import Any

from .schemas import DashboardConfig


def enrich_config(config: DashboardConfig) -> DashboardConfig:
    """
    Apply component-specific polish defaults to a Gemini-generated config.
    Returns a new DashboardConfig — the input is not mutated.
    """
    raw = copy.deepcopy(config.model_dump(by_alias=True))
    for component in raw.get("components", []):
        _enrich_component(component)
    return DashboardConfig.model_validate(raw)


def _normalize_tabs(data: dict[str, Any]) -> None:
    """Ensure tabs is string[] — the AI sometimes emits objects instead of names."""
    tabs = data.get("tabs")
    if not tabs:
        data.setdefault("tabs", ["View 1", "View 2"])
        return
    normalized: list[str] = []
    for t in tabs:
        if isinstance(t, str):
            normalized.append(t)
        elif isinstance(t, dict):
            label = t.get("label") or t.get("name") or t.get("title") or "Tab"
            normalized.append(str(label))
        else:
            normalized.append(str(t))
    data["tabs"] = normalized
    default = data.get("defaultTab")
    if default and not isinstance(default, str):
        data["defaultTab"] = str(default)


def _enrich_component(component: dict[str, Any]) -> None:
    ctype = component.get("type")
    style: dict[str, Any] = component.setdefault("style", {})
    data:  dict[str, Any] = component.setdefault("data", {})

    if ctype == "StatCard":
        style.setdefault("metricFontSize", 28)
        style.setdefault("labelFontSize", 12)
        style.setdefault("borderLeftWidth", 4)
        style.setdefault("borderRadius", 12)
        style.setdefault("padding", 20)

    elif ctype == "Table":
        data.setdefault("searchable", True)
        data.setdefault("pagination", True)
        style.setdefault("stripeRows", True)
        style.setdefault("borderRadius", 10)

    elif ctype in {"BarChart", "LineChart"}:
        data.setdefault("showGrid", True)
        data.setdefault("showLegend", True)
        style.setdefault("borderRadius", 10)

    elif ctype == "LogsViewer":
        style.setdefault("fontFamily", "Fira Code")
        style.setdefault("fontSize", 12)
        style.setdefault("lineHeight", 1.6)

    elif ctype == "Button":
        style.setdefault("fontWeight", 600)
        style.setdefault("borderRadius", 8)
        style.setdefault("padding", 14)
        data.setdefault("loadingState", True)

    elif ctype in {"TextInput", "NumberInput", "Select"}:
        style.setdefault("borderRadius", 8)
        style.setdefault("padding", 10)

    elif ctype == "Text":
        style.setdefault("lineHeight", 1.6)
        style.setdefault("overflow", "Wrap")

    elif ctype in {"Container", "TabbedContainer"}:
        style.setdefault("borderRadius", 12)
        style.setdefault("padding", 16)
        if ctype == "TabbedContainer":
            _normalize_tabs(data)
