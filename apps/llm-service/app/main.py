"""
FastAPI entry point for the LLM service.

Routes:
  GET  /health         - liveness probe
  POST /generate       - take user prompt + resources -> return N variants
"""

from __future__ import annotations

import logging
import os
import time
import uuid
from pathlib import Path

from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException, Request

# Load the LLM service .env explicitly and let it override shell/system values.
SERVICE_ENV_PATH = Path(__file__).resolve().parents[1] / ".env"
load_dotenv(SERVICE_ENV_PATH, override=True)

from .archetypes import classify_prompt
from .chat import CHAT_SYSTEM_PROMPT_VERSION, ChatError, run_chat
from .design_enrichment import enrich_config
from .gemini_client import GeminiError, generate_dashboard_config
from .openai_client import (
    OpenAIError,
    generate_dashboard_config as generate_dashboard_config_openai,
)
from .prompts import SYSTEM_PROMPT_VERSION, build_system_prompt, build_user_prompt
from .schemas import ChatRequest, ChatResponse, GenerateRequest, GenerateResponse
from .variants import derive_variants

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s: %(message)s")
logger = logging.getLogger("llm.main")

app = FastAPI(title="BTB LLM Service", version="0.1.0")


@app.middleware("http")
async def request_logger(request: Request, call_next):
    request_id = request.headers.get("x-request-id") or uuid.uuid4().hex[:12]
    request.state.request_id = request_id
    started = time.perf_counter()
    logger.info("request.start id=%s method=%s path=%s", request_id, request.method, request.url.path)
    try:
        response = await call_next(request)
    except Exception:
        duration_ms = round((time.perf_counter() - started) * 1000)
        logger.exception("request.error id=%s duration_ms=%s", request_id, duration_ms)
        raise

    duration_ms = round((time.perf_counter() - started) * 1000)
    logger.info("request.end id=%s status=%s duration_ms=%s", request_id, response.status_code, duration_ms)
    response.headers["x-request-id"] = request_id
    return response


@app.get("/health")
def health() -> dict:
    return {
        "status": "ok",
        "primary_provider": "gemini",
        "primary_model": os.getenv("GEMINI_MODEL", "gemini-2.5-flash"),
        "has_gemini_key": bool(os.getenv("GEMINI_API_KEY")),
        "fallback_provider": "openai",
        "fallback_model": os.getenv("OPENAI_MODEL", "gpt-4o-mini"),
        "has_openai_key": bool(os.getenv("OPENAI_API_KEY")),
        "chat_prompt_version": CHAT_SYSTEM_PROMPT_VERSION,
    }


@app.post("/chat", response_model=ChatResponse)
def chat(req: ChatRequest, request: Request) -> ChatResponse:
    """
    Multi-turn chat with the builder assistant.

    The assistant has full context of the dashboard's original generation prompt,
    its current config, and the selected component. Returns a free-text reply
    plus optional structured suggestions the user can apply with one click.
    """
    request_id = getattr(request.state, "request_id", "-")
    started = time.perf_counter()

    components_count = len(req.dashboard_config.components) if req.dashboard_config else 0
    queries_count = len(req.dashboard_config.queries) if req.dashboard_config else 0
    logger.info(
        "chat.request id=%s msg_len=%d history=%d components=%d queries=%d selected=%s has_prompt=%s",
        request_id,
        len(req.message),
        len(req.conversation_history),
        components_count,
        queries_count,
        req.selected_component.id if req.selected_component else "-",
        bool(req.generation_prompt),
    )

    try:
        result = run_chat(req)
    except ChatError as exc:
        duration_ms = round((time.perf_counter() - started) * 1000)
        logger.error("chat.failed id=%s duration_ms=%s error=%s", request_id, duration_ms, exc)
        raise HTTPException(status_code=502, detail=str(exc))

    duration_ms = round((time.perf_counter() - started) * 1000)
    logger.info(
        "chat.success id=%s duration_ms=%s response_len=%d suggestions=%d",
        request_id,
        duration_ms,
        len(result.response),
        len(result.suggestions),
    )
    return result


@app.post("/generate", response_model=GenerateResponse)
def generate(req: GenerateRequest, request: Request) -> GenerateResponse:
    """
    Build the prompt, call Gemini once for a base config, then derive
    palette variants programmatically. Returns up to `variant_count`
    candidate dashboards.

    Provider strategy: Gemini first; on GeminiError fall back to OpenAI.
    If both fail, return 502 with provider details.
    """
    request_id = getattr(request.state, "request_id", "-")
    started = time.perf_counter()

    logger.info(
        "generate.request id=%s prompt_v=%s prompt_len=%d resources=%d docs=%d variants=%d",
        request_id,
        SYSTEM_PROMPT_VERSION,
        len(req.prompt),
        len(req.resources),
        len(req.docs_urls),
        req.variant_count,
    )

    archetype = classify_prompt(req.prompt)
    logger.info(
        "generate.archetype id=%s type=%s confidence=%.2f",
        request_id,
        archetype.dashboard_type,
        archetype.confidence,
    )

    system_prompt = build_system_prompt()
    user_prompt = build_user_prompt(req, archetype.dashboard_type, archetype.confidence)

    base_config = None
    gemini_err: GeminiError | None = None
    try:
        base_config = generate_dashboard_config(system_prompt, user_prompt)
        logger.info(
            "generate.provider.ok id=%s provider=gemini components=%d queries=%d",
            request_id,
            len(base_config.components),
            len(base_config.queries),
        )
    except GeminiError as exc:
        gemini_err = exc
        logger.warning(
            "generate.provider.fail id=%s provider=gemini error=%s",
            request_id,
            exc,
            exc_info=True,
        )

    if base_config is None:
        try:
            base_config = generate_dashboard_config_openai(system_prompt, user_prompt)
            logger.info(
                "generate.provider.ok id=%s provider=openai components=%d queries=%d",
                request_id,
                len(base_config.components),
                len(base_config.queries),
            )
        except OpenAIError as exc:
            logger.error(
                "generate.provider.fail id=%s provider=openai error=%s",
                request_id,
                exc,
                exc_info=True,
            )
            logger.error(
                "generate.failed id=%s gemini_error=%s openai_error=%s",
                request_id,
                gemini_err,
                exc,
            )
            raise HTTPException(
                status_code=502,
                detail=f"Gemini failed ({gemini_err}); OpenAI fallback also failed ({exc})",
            )

    base_config = enrich_config(base_config, req.prompt)

    base_name = "Dashboard"
    variants = derive_variants(
        base_config,
        base_name,
        req.variant_count,
        archetype.dashboard_type,
    )

    duration_ms = round((time.perf_counter() - started) * 1000)
    logger.info("generate.success id=%s variants=%d duration_ms=%s", request_id, len(variants), duration_ms)
    return GenerateResponse(success=True, configs=variants)
