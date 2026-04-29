"""
Programmatic variant generator.

Takes ONE LLM-generated dashboard and derives N-1 alternatives using both:
  1) Palette/style changes
  2) Lightweight layout profile transforms

This is intentionally NOT another Gemini call; variants stay cheap and fast.
"""

from __future__ import annotations

import copy
from typing import Any, Literal

from .schemas import DashboardConfig, GeneratedVariant

DashboardType = Literal["analytics", "crud_admin", "monitoring", "form_workflow", "logs"]

PALETTES: list[dict[str, str]] = [
    {
        "name": "Cobalt",
        "surface": "#f8fafc",
        "panel": "#ffffff",
        "border": "#dbe2ea",
        "text": "#0f172a",
        "muted": "#475569",
        "primary": "#2563eb",
        "primary_text": "#ffffff",
        "card_tint": "#eff6ff",
        "chart_tint": "#dbeafe",
        "table_tint": "#f8fafc",
        "input_tint": "#ffffff",
    },
    {
        "name": "Forest",
        "surface": "#f6fbf8",
        "panel": "#ffffff",
        "border": "#d6eadf",
        "text": "#0b1f16",
        "muted": "#3d5a4c",
        "primary": "#0f766e",
        "primary_text": "#ffffff",
        "card_tint": "#ecfdf5",
        "chart_tint": "#d1fae5",
        "table_tint": "#f7fcfa",
        "input_tint": "#ffffff",
    },
    {
        "name": "Graphite",
        "surface": "#0b1220",
        "panel": "#111827",
        "border": "#243041",
        "text": "#e5e7eb",
        "muted": "#cbd5e1",
        "primary": "#22d3ee",
        "primary_text": "#06202a",
        "card_tint": "#0f1b2d",
        "chart_tint": "#10243a",
        "table_tint": "#0f172a",
        "input_tint": "#111827",
    },
    {
        "name": "Amber",
        "surface": "#fffbeb",
        "panel": "#ffffff",
        "border": "#f3e1b5",
        "text": "#3b2f13",
        "muted": "#7c5f20",
        "primary": "#d97706",
        "primary_text": "#ffffff",
        "card_tint": "#fff7ed",
        "chart_tint": "#ffedd5",
        "table_tint": "#fffbeb",
        "input_tint": "#ffffff",
    },
]


def _repaint_component(component: dict[str, Any], palette: dict[str, str]) -> dict[str, Any]:
    """Apply palette + baseline style consistency to one component."""
    style = component.setdefault("style", {})
    style["backgroundColor"] = palette["panel"]
    style["borderColor"] = palette["border"]
    style["textColor"] = palette["text"]
    style.setdefault("borderWidth", 1)
    style.setdefault("borderRadius", 10)
    style.setdefault("padding", 12)

    ctype = component.get("type")
    if ctype in {"StatCard", "StatusBadge"}:
        style["backgroundColor"] = palette["card_tint"]
        style["borderLeftColor"] = palette["primary"]
        style["borderLeftWidth"] = 4
    elif ctype in {"LineChart", "BarChart"}:
        style["backgroundColor"] = palette["chart_tint"]
        style["borderColor"] = palette["primary"]
    elif ctype in {"Table", "LogsViewer"}:
        style["backgroundColor"] = palette["table_tint"]
    elif ctype in {"TextInput", "NumberInput", "Select"}:
        style["backgroundColor"] = palette["input_tint"]
        style["borderColor"] = palette["primary"]
        style["borderWidth"] = 1
    elif ctype in {"Container", "TabbedContainer"}:
        style["backgroundColor"] = palette["surface"]

    if ctype == "Button":
        style["backgroundColor"] = palette["primary"]
        style["borderColor"] = palette["primary"]
        style["textColor"] = palette["primary_text"]
        style["fontWeight"] = 600
        style["padding"] = 14

    if ctype == "StatCard":
        style["borderColor"] = palette["border"]
        style.setdefault("shadowColor", palette["border"])

    return component


def _score_component(component: dict[str, Any]) -> int:
    ctype = component.get("type")
    if ctype == "StatCard":
        return 100
    if ctype in {"LineChart", "BarChart"}:
        return 90
    if ctype in {"Table", "LogsViewer"}:
        return 80
    if ctype in {"TextInput", "NumberInput", "Select"}:
        return 70
    if ctype == "Button":
        return 65
    return 50


def _ordered_components(components: list[dict[str, Any]]) -> list[dict[str, Any]]:
    return sorted(
        components,
        key=lambda c: (
            -(_score_component(c)),
            c.get("layout", {}).get("y", 0),
            c.get("layout", {}).get("x", 0),
        ),
    )


def _pack_rows(components: list[dict[str, Any]], height_scale: float = 1.0) -> list[dict[str, Any]]:
    """Deterministic 12-col row packer to avoid overlap after transforms."""
    x = 0
    y = 0
    row_h = 0
    packed: list[dict[str, Any]] = []
    for comp in components:
        clone = copy.deepcopy(comp)
        layout = clone.setdefault("layout", {})
        w = int(layout.get("w", 4))
        h = max(2, int(round(int(layout.get("h", 4)) * height_scale)))
        w = max(2, min(12, w))
        if x + w > 12:
            x = 0
            y += row_h
            row_h = 0
        layout["x"] = x
        layout["y"] = y
        layout["w"] = w
        layout["h"] = h
        x += w
        row_h = max(row_h, h)
        packed.append(clone)
    return packed


def _overview_transform(components: list[dict[str, Any]]) -> list[dict[str, Any]]:
    ordered = _ordered_components(components)
    transformed: list[dict[str, Any]] = []
    for c in ordered:
        clone = copy.deepcopy(c)
        ctype = clone.get("type")
        if ctype == "StatCard":
            clone["layout"]["w"] = 3
            clone["layout"]["h"] = 5
        elif ctype in {"LineChart", "BarChart"}:
            clone["layout"]["w"] = 6
            clone["layout"]["h"] = 10
        elif ctype in {"Table", "LogsViewer"}:
            clone["layout"]["w"] = 12
            clone["layout"]["h"] = 11
        transformed.append(clone)
    return _pack_rows(transformed, height_scale=0.95)


def _detailed_transform(components: list[dict[str, Any]]) -> list[dict[str, Any]]:
    ordered = _ordered_components(components)
    transformed: list[dict[str, Any]] = []
    for c in ordered:
        clone = copy.deepcopy(c)
        ctype = clone.get("type")
        if ctype in {"Table", "LogsViewer"}:
            clone["layout"]["w"] = 12
            clone["layout"]["h"] = 14
        elif ctype in {"LineChart", "BarChart"}:
            clone["layout"]["w"] = 8
            clone["layout"]["h"] = 11
        elif ctype == "StatCard":
            clone["layout"]["w"] = 4
            clone["layout"]["h"] = 5
        transformed.append(clone)
    return _pack_rows(transformed, height_scale=1.15)


def _visual_transform(components: list[dict[str, Any]]) -> list[dict[str, Any]]:
    ordered = _ordered_components(components)
    transformed: list[dict[str, Any]] = []
    for c in ordered:
        clone = copy.deepcopy(c)
        ctype = clone.get("type")
        if ctype in {"LineChart", "BarChart"}:
            clone["layout"]["w"] = 12
            clone["layout"]["h"] = 12
        elif ctype == "StatCard":
            clone["layout"]["w"] = 3
            clone["layout"]["h"] = 5
        elif ctype in {"Table", "LogsViewer", "Text"}:
            clone["layout"]["w"] = 12
            clone["layout"]["h"] = 8
        transformed.append(clone)
    return _pack_rows(transformed, height_scale=1.0)


def _apply_archetype_adjustments(
    components: list[dict[str, Any]],
    dashboard_type: DashboardType,
    profile: str,
) -> list[dict[str, Any]]:
    """
    Final pass that keeps each variant aligned with the dashboard archetype.
    """
    adjusted: list[dict[str, Any]] = []
    for c in components:
        clone = copy.deepcopy(c)
        ctype = clone.get("type")
        layout = clone.setdefault("layout", {})

        if dashboard_type == "form_workflow":
            if ctype in {"TextInput", "NumberInput", "Select"}:
                layout["w"] = min(4, int(layout.get("w", 4)))
            elif ctype == "Button":
                layout["w"] = min(4, int(layout.get("w", 4)))
                layout["h"] = max(3, int(layout.get("h", 3)))
            elif ctype in {"Text", "Table", "LogsViewer", "LineChart", "BarChart"}:
                layout["w"] = max(8, int(layout.get("w", 8)))

        elif dashboard_type == "logs":
            if ctype == "LogsViewer":
                layout["w"] = 12
                layout["h"] = 14 if profile == "Detailed" else 12
            elif ctype in {"Table", "LineChart", "BarChart"}:
                layout["w"] = max(8, int(layout.get("w", 8)))

        elif dashboard_type == "monitoring":
            if ctype in {"StatusBadge", "StatCard"}:
                layout["w"] = 3 if ctype == "StatCard" else min(4, int(layout.get("w", 4)))
                layout["h"] = max(4, int(layout.get("h", 4)))
            elif ctype in {"LineChart", "BarChart"}:
                layout["w"] = 6 if profile != "Visual" else 12
                layout["h"] = max(10, int(layout.get("h", 10)))
            elif ctype == "LogsViewer":
                layout["w"] = 12

        elif dashboard_type == "crud_admin":
            if ctype == "Table":
                layout["w"] = 12
                layout["h"] = 14 if profile in {"Detailed", "Overview"} else 10
            elif ctype in {"TextInput", "NumberInput", "Select", "Button"}:
                layout["w"] = min(4, int(layout.get("w", 4)))

        elif dashboard_type == "analytics":
            if ctype == "StatCard":
                layout["w"] = 3
            elif ctype in {"LineChart", "BarChart"}:
                layout["w"] = 12 if profile == "Visual" else 6
                layout["h"] = max(10, int(layout.get("h", 10)))
            elif ctype == "Table":
                layout["w"] = 12

        adjusted.append(clone)

    return _pack_rows(adjusted, height_scale=1.0)


def _apply_profile(components: list[dict[str, Any]], profile: str) -> list[dict[str, Any]]:
    if profile == "Overview":
        return _overview_transform(components)
    if profile == "Detailed":
        return _detailed_transform(components)
    if profile == "Visual":
        return _visual_transform(components)
    return _pack_rows(_ordered_components(components))


def _apply_palette(
    config: DashboardConfig,
    palette: dict[str, str],
    profile: str,
    dashboard_type: DashboardType,
) -> DashboardConfig:
    cloned = copy.deepcopy(config.model_dump(by_alias=True))
    cloned["components"] = _apply_profile(cloned["components"], profile)
    cloned["components"] = _apply_archetype_adjustments(
        cloned["components"], dashboard_type, profile
    )
    cloned["components"] = [_repaint_component(c, palette) for c in cloned["components"]]
    return DashboardConfig.model_validate(cloned)


def derive_variants(
    base: DashboardConfig,
    base_name: str,
    count: int,
    dashboard_type: DashboardType = "analytics",
) -> list[GeneratedVariant]:
    """Returns up to `count` variants: original + profile/style alternatives."""
    variants: list[GeneratedVariant] = [GeneratedVariant(name=f"{base_name} - Original", config=base)]
    profiles = ["Overview", "Detailed", "Visual"]
    for i, palette in enumerate(PALETTES[: max(0, count - 1)]):
        profile = profiles[i % len(profiles)]
        variants.append(
            GeneratedVariant(
                name=f"{base_name} - {profile} {palette['name']}",
                config=_apply_palette(base, palette, profile, dashboard_type),
            )
        )
    return variants[:count]
