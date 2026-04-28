"""
Programmatic variant generator. Takes ONE LLM-generated dashboard and derives
N-1 more by swapping the colour palette, leaving components/queries untouched.

This is intentionally NOT another Gemini call — variants should be cheap.
"""

from __future__ import annotations

import copy
from typing import Any

from .schemas import DashboardConfig, GeneratedVariant


# Each palette is a coherent colour set used to repaint a base config.
# Keep these tasteful and accessible — the LLM-picked colours are the
# "primary" variant; these are alternatives.
PALETTES: list[dict[str, str]] = [
    {
        "name": "Indigo",
        "background": "#ffffff",
        "border":     "#e5e7eb",
        "text":       "#0f1117",
        "primary":    "#6366f1",
        "success":    "#22c55e",
        "warning":    "#f59e0b",
        "danger":     "#ef4444",
    },
    {
        "name": "Slate",
        "background": "#0f172a",
        "border":     "#1e293b",
        "text":       "#e2e8f0",
        "primary":    "#38bdf8",
        "success":    "#4ade80",
        "warning":    "#facc15",
        "danger":     "#f87171",
    },
    {
        "name": "Mint",
        "background": "#f8fafc",
        "border":     "#d1fae5",
        "text":       "#0f172a",
        "primary":    "#10b981",
        "success":    "#22c55e",
        "warning":    "#f59e0b",
        "danger":     "#ef4444",
    },
    {
        "name": "Sunset",
        "background": "#fff7ed",
        "border":     "#fed7aa",
        "text":       "#1c1917",
        "primary":    "#f97316",
        "success":    "#84cc16",
        "warning":    "#f59e0b",
        "danger":     "#dc2626",
    },
]


def _repaint_component(component: dict[str, Any], palette: dict[str, str]) -> dict[str, Any]:
    """Apply a palette to a single component's style block."""
    style = component.setdefault("style", {})
    style["backgroundColor"] = palette["background"]
    style["borderColor"]     = palette["border"]
    style["textColor"]       = palette["text"]

    # Buttons get the primary accent so they stand out.
    if component.get("type") == "Button":
        style["backgroundColor"] = palette["primary"]
        style["borderColor"]     = palette["primary"]
        style["textColor"]       = "#ffffff"

    # StatCards: use the primary as a coloured border accent.
    if component.get("type") == "StatCard":
        style["borderColor"] = palette["primary"]

    return component


def _apply_palette(config: DashboardConfig, palette: dict[str, str]) -> DashboardConfig:
    cloned = copy.deepcopy(config.model_dump(by_alias=True))
    cloned["components"] = [
        _repaint_component(c, palette) for c in cloned["components"]
    ]
    return DashboardConfig.model_validate(cloned)


def derive_variants(base: DashboardConfig, base_name: str, count: int) -> list[GeneratedVariant]:
    """
    Returns up to `count` variants. The first is the LLM's original config
    (untouched); the rest are palette swaps. Caller decides what to do if
    fewer palettes than `count` are available.
    """
    variants: list[GeneratedVariant] = [
        GeneratedVariant(name=f"{base_name} — Original", config=base)
    ]
    for palette in PALETTES[: max(0, count - 1)]:
        variants.append(
            GeneratedVariant(
                name=f"{base_name} — {palette['name']}",
                config=_apply_palette(base, palette),
            )
        )
    return variants[:count]
