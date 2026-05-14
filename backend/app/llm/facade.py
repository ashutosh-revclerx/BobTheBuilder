"""Internal facade exposing async LLM entry points used by the FastAPI routes.

The dashboard `/generate` route and assistant `/chat` route call these
functions directly (no HTTP hop) — this is the win promised in
MIGRATION_PLAN.md §4.

Orchestration logic is a port of the old `apps/llm-service/app/main.py`
`/generate` handler with all sync I/O wrapped via `asyncio.to_thread`
when the underlying client is sync.
"""

from __future__ import annotations

import logging
import time
from typing import Any

from .archetypes import classify_prompt
from .design_enrichment import enrich_config
from .gemini_client import GeminiError, generate_dashboard_config
from .openai_client import (
    OpenAIError,
    generate_dashboard_config as generate_dashboard_config_openai,
)
from .prompts import SYSTEM_PROMPT_VERSION, build_system_prompt, build_user_prompt
from .schemas import GenerateRequest, GenerateResponse
from .variants import derive_variants

logger = logging.getLogger("llm.facade")


async def generate_variants(
    *,
    prompt: str,
    resources: list[dict[str, Any]],
    docs_urls: list[str],
    variant_count: int,
) -> dict[str, Any]:
    """Orchestrate the full dashboard-generate flow.

    Returns a dict shaped like the old llm-service `/generate` response:
        {"success": True, "configs": [<variant>, ...]}

    Raises on terminal failure (FastAPI route catches and returns 502).
    """
    started = time.perf_counter()

    # Build GenerateRequest — uses populate_by_name so we can pass the
    # snake_case names directly.
    req = GenerateRequest.model_validate(
        {
            "prompt": prompt,
            "resources": resources,
            "docsUrls": docs_urls,
            "variantCount": variant_count,
        }
    )

    archetype = classify_prompt(req.prompt)
    logger.info(
        "generate.archetype type=%s confidence=%.2f",
        archetype.dashboard_type,
        archetype.confidence,
    )

    system_prompt = build_system_prompt()
    user_prompt = build_user_prompt(req, archetype.dashboard_type, archetype.confidence)

    # ── Provider chain: Gemini first, OpenAI fallback ───────────────────────
    base_config = None
    gemini_err: GeminiError | None = None
    try:
        base_config = await generate_dashboard_config(system_prompt, user_prompt)
        logger.info(
            "generate.provider.ok provider=gemini components=%d queries=%d",
            len(base_config.components),
            len(base_config.queries),
        )
    except GeminiError as exc:
        gemini_err = exc
        logger.warning("generate.provider.fail provider=gemini error=%s", exc)

    if base_config is None:
        try:
            base_config = await generate_dashboard_config_openai(system_prompt, user_prompt)
            logger.info(
                "generate.provider.ok provider=openai components=%d queries=%d",
                len(base_config.components),
                len(base_config.queries),
            )
        except OpenAIError as exc:
            logger.error("generate.provider.fail provider=openai error=%s", exc)
            raise RuntimeError(
                f"Gemini failed ({gemini_err}); OpenAI fallback also failed ({exc})"
            ) from exc

    # ── Enrich + derive variants (pure-Python, no I/O) ──────────────────────
    base_config = enrich_config(base_config, req.prompt)
    base_name = "Dashboard"
    variants = derive_variants(
        base_config,
        base_name,
        req.variant_count,
        archetype.dashboard_type,
    )

    duration_ms = round((time.perf_counter() - started) * 1000)
    logger.info(
        "generate.success variants=%d duration_ms=%s prompt_v=%s",
        len(variants),
        duration_ms,
        SYSTEM_PROMPT_VERSION,
    )

    response = GenerateResponse(success=True, configs=variants)
    return response.model_dump(mode="json")


# Re-export run_chat from chat module so routes can do
#     from ..llm.facade import run_chat
# alongside generate_variants for a single, stable import path.
from .chat import run_chat  # noqa: E402  (re-export)

__all__ = ["generate_variants", "run_chat"]
