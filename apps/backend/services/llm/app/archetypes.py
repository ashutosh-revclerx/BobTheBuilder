"""
Prompt-level dashboard archetype classifier and layout rules.

This is intentionally heuristic (cheap + deterministic). We can replace it
with model-assisted classification later if needed.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Literal

DashboardType = Literal["analytics", "crud_admin", "monitoring", "form_workflow", "logs"]


@dataclass(frozen=True)
class ArchetypeDecision:
    dashboard_type: DashboardType
    confidence: float


ARCHETYPE_RULES: dict[DashboardType, str] = {
    "analytics": (
        "- Top: 3-4 StatCards across one row.\n"
        "- Middle: one primary chart (LineChart or BarChart).\n"
        "- Bottom: one table for detailed rows.\n"
        "- Filters (if present) must affect the chart and table together."
    ),
    "crud_admin": (
        "- Top: filters + actions.\n"
        "- Middle: primary table as the source of truth.\n"
        "- Optional side/secondary area for edit/view details.\n"
        "- Button actions must trigger explicit queries (manual trigger)."
    ),
    "monitoring": (
        "- Top: KPIs and status indicators.\n"
        "- Middle: trend charts over time.\n"
        "- Bottom: logs/events list using LogsViewer or Table.\n"
        "- Include at least one status-oriented component."
    ),
    "form_workflow": (
        "- Left: input controls (TextInput/NumberInput/Select).\n"
        "- Below inputs: action Button to run the workflow.\n"
        "- Right: output/result panel bound to the workflow query output.\n"
        "- Keep one clear primary user path: input -> action -> result."
    ),
    "logs": (
        "- Top: filters for level/service/time where relevant.\n"
        "- Main area: LogsViewer as primary component.\n"
        "- Optional summary StatCards for counts by level/status.\n"
        "- Prioritize scanability and timestamp visibility."
    ),
}


def classify_prompt(prompt: str) -> ArchetypeDecision:
    p = prompt.lower()

    scores: dict[DashboardType, int] = {
        "analytics": 0,
        "crud_admin": 0,
        "monitoring": 0,
        "form_workflow": 0,
        "logs": 0,
    }

    if any(k in p for k in ("log", "logs", "incident", "trace")):
        scores["logs"] += 3
        scores["monitoring"] += 1
    if any(k in p for k in ("monitor", "uptime", "status", "latency", "health", "alert")):
        scores["monitoring"] += 3
    if any(k in p for k in ("form", "submit", "input", "scrape", "generate", "url")):
        scores["form_workflow"] += 3
    if any(k in p for k in ("admin", "manage", "crud", "create", "update", "delete", "list")):
        scores["crud_admin"] += 3
    if any(k in p for k in ("analytics", "kpi", "metric", "revenue", "trend", "overview")):
        scores["analytics"] += 3

    # Mild fallback bias toward analytics for broad, business-style prompts.
    if any(k in p for k in ("dashboard", "report", "summary")):
        scores["analytics"] += 1

    best = max(scores, key=scores.get)
    top = scores[best]
    second = sorted(scores.values(), reverse=True)[1]
    confidence = 0.55 if top == 0 else min(0.95, 0.6 + 0.08 * (top - second))

    return ArchetypeDecision(dashboard_type=best, confidence=round(confidence, 2))
