"""
Deterministic design enrichment pass.

Runs after Gemini returns valid JSON and before variants are derived.
Uses setdefault throughout — fills gaps only, never overrides AI decisions.
"""

from __future__ import annotations

import copy
import re
from typing import Any

from .schemas import DashboardConfig

HEX_COLOR_RE = re.compile(r"#[0-9a-fA-F]{6}\b")


def enrich_config(config: DashboardConfig, prompt: str | None = None) -> DashboardConfig:
    """
    Apply component-specific polish defaults to a Gemini-generated config.
    Returns a new DashboardConfig — the input is not mutated.
    """
    raw = copy.deepcopy(config.model_dump(by_alias=True))
    _enrich_canvas_style(raw, prompt or "")
    for component in raw.get("components", []):
        _enrich_component(component)
    return DashboardConfig.model_validate(raw)


def _extract_hex_palette(prompt: str) -> list[str]:
    seen: set[str] = set()
    palette: list[str] = []
    for color in HEX_COLOR_RE.findall(prompt or ""):
        normalized = color.lower()
        if normalized in seen:
            continue
        seen.add(normalized)
        palette.append(normalized)
    return palette[:8]


def _extract_role_color(prompt: str, role: str) -> str | None:
    pattern = rf"(?:{role}(?:\s+color)?\s*[:=]?\s*)(#[0-9a-fA-F]{{6}})"
    match = re.search(pattern, prompt or "", re.IGNORECASE)
    if not match:
        return None
    return match.group(1).lower()


def _is_default_canvas(canvas: dict[str, Any]) -> bool:
    bg = str(canvas.get("backgroundColor") or "").lower()
    has_gradient = bool(canvas.get("backgroundGradient"))
    return (not bg or bg == "#f3f4f6") and not has_gradient


def _enrich_canvas_style(raw: dict[str, Any], prompt: str) -> None:
    canvas = raw.setdefault("canvasStyle", {})
    if not isinstance(canvas, dict):
        canvas = {}
        raw["canvasStyle"] = canvas

    palette = _extract_hex_palette(prompt)
    background_role = _extract_role_color(prompt, "background")
    primary_role = _extract_role_color(prompt, "primary")

    if not palette and not background_role and not primary_role:
        canvas.setdefault("backgroundColor", "#f3f4f6")
        return

    if not _is_default_canvas(canvas):
        return

    bg_color = background_role or primary_role or (palette[0] if palette else "#f3f4f6")
    canvas["backgroundColor"] = bg_color

    gradient_stops = palette[:3] if len(palette) >= 2 else []
    if len(gradient_stops) >= 2:
        if len(gradient_stops) == 2:
            positions = [0, 100]
        else:
            positions = [0, 50, 100]
        canvas["backgroundGradient"] = {
            "enabled": True,
            "direction": 135,
            "stops": [
                {"color": gradient_stops[i], "position": positions[i]}
                for i in range(len(gradient_stops))
            ],
        }


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
