"""
Deterministic design enrichment pass.

Runs after Gemini returns valid JSON and before variants are derived.
Two-phase enrichment:
  1. setdefault polish — fills gaps without overriding AI decisions
  2. quality floor — enforces minimum sizes, shadows, hero gradient,
     consistent radii. These are guard-rails: the LLM frequently produces
     cramped or flat-looking layouts; this pass guarantees a baseline.
"""

from __future__ import annotations

import copy
import re
from typing import Any

from .schemas import DashboardConfig

HEX_COLOR_RE = re.compile(r"#[0-9a-fA-F]{6}\b")

# Modern-dashboard size floors. Tables/charts need real estate to breathe;
# StatCards look anemic at h<6. Below these floors the result feels cramped
# regardless of palette quality.
MIN_HEIGHTS = {
    "StatCard":        6,
    "StatusBadge":     4,
    "BarChart":        12,
    "LineChart":       12,
    "PieChart":        12,
    "HeatMap":         12,
    "Table":           14,
    "LogsViewer":      12,
    "Container":       8,
    "TabbedContainer": 12,
    "Text":            4,
    "TextInput":       4,
    "NumberInput":     4,
    "Select":          4,
    "Image":           8,
    "Embed":           10,
    "Button":          3,
}

# Subtle elevation. Two layers: a tight 1px and a softer ambient drop.
# Looks premium without being heavy. Light theme by default; variant
# repaint may swap to dark-theme equivalents.
SHADOW_LIGHT = "0 1px 2px rgba(15, 23, 42, 0.04), 0 4px 12px rgba(15, 23, 42, 0.06)"
SHADOW_HERO  = "0 4px 12px rgba(37, 99, 235, 0.18), 0 12px 32px rgba(37, 99, 235, 0.12)"


def enrich_config(config: DashboardConfig, prompt: str | None = None) -> DashboardConfig:
    """
    Apply component-specific polish defaults to a Gemini-generated config.
    Returns a new DashboardConfig — the input is not mutated.
    """
    raw = copy.deepcopy(config.model_dump(by_alias=True))
    _enrich_canvas_style(raw, prompt or "")
    for component in raw.get("components", []):
        _enrich_component(component)

    # Quality-floor pass — runs after the per-type setdefaults so it
    # catches anything Gemini didn't explicitly set.
    _enforce_size_floor(raw.get("components", []))
    _apply_hero_gradient(raw.get("components", []))
    _apply_visual_polish(raw.get("components", []))

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
        # No prompt-derived palette — give the canvas a soft neutral instead
        # of the legacy #f3f4f6 grey-flat which looks cheap.
        canvas.setdefault("backgroundColor", "#f8fafc")
        return

    if not _is_default_canvas(canvas):
        return

    bg_color = background_role or primary_role or (palette[0] if palette else "#f8fafc")
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
        style.setdefault("metricFontSize", 32)
        style.setdefault("labelFontSize", 13)
        style.setdefault("borderLeftWidth", 4)
        style.setdefault("borderRadius", 14)
        style.setdefault("padding", 22)
        style.setdefault("fontWeight", 700)

    elif ctype == "Table":
        data.setdefault("searchable", True)
        data.setdefault("pagination", True)
        style.setdefault("stripeRows", True)
        style.setdefault("borderRadius", 12)
        style.setdefault("padding", 0)

    elif ctype in {"BarChart", "LineChart", "PieChart", "HeatMap"}:
        data.setdefault("showGrid", True)
        data.setdefault("showLegend", True)
        if ctype == "LineChart":
            data.setdefault("smooth", True)
        if ctype == "HeatMap":
            style.setdefault("minCellColor", "#dbeafe")
            style.setdefault("maxCellColor", "#1d4ed8")
            style.setdefault("emptyCellColor", "#f3f4f6")
            style.setdefault("cellGap", 4)
        if ctype == "PieChart":
            data.setdefault("nameField", "label")
            data.setdefault("valueField", "value")
            data.setdefault("donut", True)
        style.setdefault("borderRadius", 12)
        style.setdefault("padding", 18)

    elif ctype == "LogsViewer":
        style.setdefault("fontFamily", "Fira Code")
        style.setdefault("fontSize", 12)
        style.setdefault("lineHeight", 1.6)
        style.setdefault("borderRadius", 12)

    elif ctype == "Button":
        style.setdefault("fontWeight", 700)
        style.setdefault("borderRadius", 10)
        style.setdefault("padding", 14)
        data.setdefault("loadingState", True)

    elif ctype in {"TextInput", "NumberInput", "Select"}:
        style.setdefault("borderRadius", 10)
        style.setdefault("padding", 12)

    elif ctype == "Text":
        style.setdefault("lineHeight", 1.6)
        style.setdefault("overflow", "Wrap")

    elif ctype in {"Container", "TabbedContainer"}:
        style.setdefault("borderRadius", 14)
        style.setdefault("padding", 20)
        if ctype == "TabbedContainer":
            _normalize_tabs(data)


# ─── Quality-floor passes ────────────────────────────────────────────────────


def _enforce_size_floor(components: list[dict[str, Any]]) -> None:
    """
    Bump any component that's smaller than the modern-dashboard floor.
    Width is left alone (LLM picked a layout); only height grows so the
    user doesn't see a tiny crammed widget that the preview made look bigger.
    """
    for c in components:
        layout = c.setdefault("layout", {})
        ctype = c.get("type")
        floor = MIN_HEIGHTS.get(ctype)
        if floor is None:
            continue
        try:
            current = int(layout.get("h", 0) or 0)
        except (TypeError, ValueError):
            current = 0
        if current < floor:
            layout["h"] = floor


def _apply_hero_gradient(components: list[dict[str, Any]]) -> None:
    """
    Pick the first StatCard (by render order) and give it a hero gradient if
    it doesn't already have one. Modern dashboards have one feature component
    that draws the eye — without this, every card looks identical.
    """
    stat_cards = [c for c in components if c.get("type") == "StatCard"]
    if not stat_cards:
        return

    # Sort by canvas position so the "hero" is whatever appears first visually.
    stat_cards.sort(
        key=lambda c: (
            c.get("layout", {}).get("y", 0),
            c.get("layout", {}).get("x", 0),
        )
    )
    hero = stat_cards[0]
    style = hero.setdefault("style", {})

    if style.get("backgroundGradient"):
        return  # LLM already chose a gradient — respect it.

    primary = style.get("borderLeftColor") or style.get("borderColor") or "#2563eb"
    style["backgroundGradient"] = {
        "enabled":   True,
        "direction": 135,
        "stops": [
            {"color": primary, "position": 0},
            {"color": _darken(primary, 0.3), "position": 100},
        ],
    }
    # White text reads on every brand color — safer default for hero card.
    style.setdefault("textColor", "#ffffff")
    style.setdefault("metricFontSize", 36)


def _apply_visual_polish(components: list[dict[str, Any]]) -> None:
    """
    Apply box-shadow and consistent border-radius across all components.
    These are setdefault calls — nothing the LLM explicitly set is overridden.
    """
    for c in components:
        style = c.setdefault("style", {})
        ctype = c.get("type")

        # Text and StatusBadge are inherently transparent / inline — shadow
        # would look weird. Buttons get their own pop via color.
        if ctype not in {"Text", "StatusBadge", "Button"}:
            style.setdefault("boxShadow", SHADOW_LIGHT)

        # Modern radius floor — anything below 10 looks dated.
        if "borderRadius" not in style:
            style["borderRadius"] = 12

        # Hero stat card gets the heavier accent shadow.
        if ctype == "StatCard" and style.get("backgroundGradient"):
            style["boxShadow"] = SHADOW_HERO


def _darken(hex_color: str, amount: float) -> str:
    """Darken a #rrggbb hex by `amount` (0..1). Used for gradient end-stops."""
    color = hex_color.lstrip("#")
    if len(color) != 6:
        return hex_color
    try:
        r, g, b = int(color[0:2], 16), int(color[2:4], 16), int(color[4:6], 16)
    except ValueError:
        return hex_color
    factor = max(0.0, 1.0 - amount)
    r = max(0, min(255, int(r * factor)))
    g = max(0, min(255, int(g * factor)))
    b = max(0, min(255, int(b * factor)))
    return f"#{r:02x}{g:02x}{b:02x}"
