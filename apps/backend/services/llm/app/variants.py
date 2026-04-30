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
        "philosophy": "Clean enterprise — high contrast, trustworthy blue, generous whitespace",
        # Surfaces
        "surface": "#f0f4f8",
        "panel": "#ffffff",
        "panel_elevated": "#f8fafc",
        # Borders
        "border": "#cbd5e1",
        "border_subtle": "#e2e8f0",
        # Text
        "text": "#0f172a",
        "text_muted": "#475569",
        "text_faint": "#94a3b8",
        # Brand
        "primary": "#2563eb",
        "primary_hover": "#1d4ed8",
        "primary_text": "#ffffff",
        "primary_subtle": "#eff6ff",
        # Semantic
        "success": "#16a34a",
        "warning": "#d97706",
        "error": "#dc2626",
        "info": "#0284c7",
        # Component tints
        "card_tint": "#eff6ff",
        "card_accent": "#2563eb",
        "chart_tint": "#dbeafe",
        "chart_colors": ["#2563eb", "#7c3aed", "#0891b2", "#059669", "#d97706"],
        "table_tint": "#f8fafc",
        "table_header": "#f1f5f9",
        "input_tint": "#ffffff",
        "badge_bg": "#eff6ff",
        "log_info": "#2563eb",
        "log_warn": "#d97706",
        "log_error": "#dc2626",
    },
    {
        "name": "Forest",
        "philosophy": "Calm & natural — muted greens, earthy tones, easy on the eyes",
        "surface": "#f0faf4",
        "panel": "#ffffff",
        "panel_elevated": "#f7fdf9",
        "border": "#bbf7d0",
        "border_subtle": "#dcfce7",
        "text": "#052e16",
        "text_muted": "#166534",
        "text_faint": "#4ade80",
        "primary": "#16a34a",
        "primary_hover": "#15803d",
        "primary_text": "#ffffff",
        "primary_subtle": "#f0fdf4",
        "success": "#15803d",
        "warning": "#ca8a04",
        "error": "#b91c1c",
        "info": "#0369a1",
        "card_tint": "#f0fdf4",
        "card_accent": "#16a34a",
        "chart_tint": "#dcfce7",
        "chart_colors": ["#16a34a", "#0d9488", "#2563eb", "#ca8a04", "#9333ea"],
        "table_tint": "#f7fdf9",
        "table_header": "#dcfce7",
        "input_tint": "#ffffff",
        "badge_bg": "#f0fdf4",
        "log_info": "#0369a1",
        "log_warn": "#ca8a04",
        "log_error": "#b91c1c",
    },
    {
        "name": "Graphite",
        "philosophy": "Dark ops — deep navy blacks, cyan accent, terminal aesthetic",
        "surface": "#080e1a",
        "panel": "#0d1424",
        "panel_elevated": "#111c2e",
        "border": "#1e2d42",
        "border_subtle": "#162030",
        "text": "#e2e8f0",
        "text_muted": "#94a3b8",
        "text_faint": "#475569",
        "primary": "#22d3ee",
        "primary_hover": "#06b6d4",
        "primary_text": "#040e14",
        "primary_subtle": "#0c2331",
        "success": "#34d399",
        "warning": "#fbbf24",
        "error": "#f87171",
        "info": "#60a5fa",
        "card_tint": "#0d1a2d",
        "card_accent": "#22d3ee",
        "chart_tint": "#0a1628",
        "chart_colors": ["#22d3ee", "#818cf8", "#34d399", "#fbbf24", "#f472b6"],
        "table_tint": "#0a1220",
        "table_header": "#111c2e",
        "input_tint": "#0d1424",
        "badge_bg": "#0c2331",
        "log_info": "#60a5fa",
        "log_warn": "#fbbf24",
        "log_error": "#f87171",
    },
    {
        "name": "Amber",
        "philosophy": "Warm editorial — golden tones, readable serif-friendly text, editorial data journalism aesthetic",
        "surface": "#fefce8",
        "panel": "#fffef5",
        "panel_elevated": "#fffdf0",
        "border": "#fde68a",
        "border_subtle": "#fef9c3",
        "text": "#292524",
        "text_muted": "#78716c",
        "text_faint": "#a8a29e",
        "primary": "#b45309",
        "primary_hover": "#92400e",
        "primary_text": "#fffef5",
        "primary_subtle": "#fffbeb",
        "success": "#15803d",
        "warning": "#b45309",
        "error": "#b91c1c",
        "info": "#0369a1",
        "card_tint": "#fefce8",
        "card_accent": "#d97706",
        "chart_tint": "#fef3c7",
        "chart_colors": ["#d97706", "#b45309", "#0369a1", "#15803d", "#7c3aed"],
        "table_tint": "#fffef5",
        "table_header": "#fef9c3",
        "input_tint": "#fffef5",
        "badge_bg": "#fef3c7",
        "log_info": "#0369a1",
        "log_warn": "#b45309",
        "log_error": "#b91c1c",
    },
    {
        "name": "Obsidian",
        "philosophy": "Pure dark — true blacks, indigo/violet accent, premium SaaS",
        "surface": "#09090b",
        "panel": "#0f0f12",
        "panel_elevated": "#141418",
        "border": "#27272a",
        "border_subtle": "#18181b",
        "text": "#fafafa",
        "text_muted": "#a1a1aa",
        "text_faint": "#52525b",
        "primary": "#6366f1",
        "primary_hover": "#4f46e5",
        "primary_text": "#ffffff",
        "primary_subtle": "#1e1b4b",
        "success": "#22c55e",
        "warning": "#f59e0b",
        "error": "#ef4444",
        "info": "#3b82f6",
        "card_tint": "#0f0f14",
        "card_accent": "#6366f1",
        "chart_tint": "#0c0c14",
        "chart_colors": ["#6366f1", "#22d3ee", "#22c55e", "#f59e0b", "#f472b6"],
        "table_tint": "#09090b",
        "table_header": "#141418",
        "input_tint": "#0f0f12",
        "badge_bg": "#1e1b4b",
        "log_info": "#3b82f6",
        "log_warn": "#f59e0b",
        "log_error": "#ef4444",
    },
]


def _repaint_component(component: dict[str, Any], palette: dict[str, str]) -> dict[str, Any]:
    """Apply palette + baseline style consistency to one component."""
    style = component.setdefault("style", {})
    ctype = component.get("type")

    # Base — every component
    style["backgroundColor"] = palette["panel"]
    style["borderColor"] = palette["border"]
    style["textColor"] = palette["text"]
    style.setdefault("borderWidth", 1)
    style.setdefault("borderRadius", 10)
    style.setdefault("padding", 12)

    if ctype in {"StatCard", "StatusBadge"}:
        style["backgroundColor"] = palette["card_tint"]
        style["borderLeftColor"] = palette["card_accent"]
        style.setdefault("borderLeftWidth", 4)
        style["textColor"] = palette["text"]
        style["mutedColor"] = palette["text_muted"]

    elif ctype in {"LineChart", "BarChart"}:
        style["backgroundColor"] = palette["chart_tint"]
        style["borderColor"] = palette["border_subtle"]
        style["seriesColors"] = palette.get("chart_colors", [palette["primary"]])
        style["gridColor"] = palette["border_subtle"]
        style["axisColor"] = palette["text_faint"]

    elif ctype == "Table":
        style["backgroundColor"] = palette["table_tint"]
        style["headerBackgroundColor"] = palette.get("table_header", palette["panel"])
        style["borderColor"] = palette["border_subtle"]
        style["rowHoverColor"] = palette.get("primary_subtle", palette["primary"] + "22")
        style["textColor"] = palette["text"]
        style["mutedColor"] = palette["text_muted"]
        style.setdefault("stripeRows", True)

    elif ctype == "LogsViewer":
        style["backgroundColor"] = palette["panel"]
        style["borderColor"] = palette["border"]
        style["textColor"] = palette["text_muted"]
        style["infoColor"] = palette.get("log_info", palette["info"])
        style["warnColor"] = palette.get("log_warn", palette["warning"])
        style["errorColor"] = palette.get("log_error", palette["error"])
        style.setdefault("fontFamily", "Fira Code")

    elif ctype in {"TextInput", "NumberInput", "Select"}:
        style["backgroundColor"] = palette["input_tint"]
        style["borderColor"] = palette["border"]
        style["textColor"] = palette["text"]
        style["focusBorderColor"] = palette["primary"]

    elif ctype in {"Container", "TabbedContainer"}:
        style["backgroundColor"] = palette["surface"]
        style["borderColor"] = palette.get("border_subtle", palette["border"])

    elif ctype == "StatusBadge":
        style["backgroundColor"] = palette.get("badge_bg", palette["panel"])
        style["borderColor"] = palette["border"]

    elif ctype == "Text":
        style["backgroundColor"] = "transparent"
        style["textColor"] = palette["text"]
        style["mutedColor"] = palette["text_muted"]

    if ctype == "Button":
        style["backgroundColor"] = palette["primary"]
        style["borderColor"] = palette["primary"]
        style["textColor"] = palette["primary_text"]
        style["hoverBackgroundColor"] = palette.get("primary_hover", palette["primary"])
        style.setdefault("fontWeight", 600)
        style.setdefault("padding", 14)

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
    variants: list[GeneratedVariant] = [
        GeneratedVariant(
            name=f"{base_name} - Original",
            philosophy="Original generated layout and styling.",
            config=base,
        )
    ]
    profiles = ["Overview", "Detailed", "Visual"]
    for i, palette in enumerate(PALETTES[: max(0, count - 1)]):
        profile = profiles[i % len(profiles)]
        variants.append(
            GeneratedVariant(
                name=f"{base_name} - {profile} {palette['name']}",
                philosophy=palette.get("philosophy"),
                config=_apply_palette(base, palette, profile, dashboard_type),
            )
        )
    return variants[:count]
