"""
FastAPI entry point for the LLM service.

Routes:
  GET  /health         - liveness probe
  POST /generate       - take user prompt + resources → return N variants
"""

from __future__ import annotations

import logging
import os

from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException

from .gemini_client import GeminiError, generate_dashboard_config
from .prompts import SYSTEM_PROMPT_VERSION, build_system_prompt, build_user_prompt
from .schemas import GenerateRequest, GenerateResponse
from .variants import derive_variants

# Load .env BEFORE the SDK imports try to read the key
load_dotenv()

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s: %(message)s")
logger = logging.getLogger("llm.main")

app = FastAPI(title="BTB LLM Service", version="0.1.0")


@app.get("/health")
def health() -> dict:
    return {
        "status": "ok",
        "model":  os.getenv("GEMINI_MODEL", "gemini-2.5-flash"),
        "has_api_key": bool(os.getenv("GEMINI_API_KEY")),
    }


@app.post("/generate", response_model=GenerateResponse)
def generate(req: GenerateRequest) -> GenerateResponse:
    """
    Build the prompt, call Gemini once for a base config, then derive
    palette variants programmatically. Returns up to `variant_count`
    candidate dashboards.
    """
    logger.info(
        "generate request: prompt_v=%s prompt_len=%d resources=%d variants=%d",
        SYSTEM_PROMPT_VERSION,
        len(req.prompt),
        len(req.resources),
        req.variant_count,
    )

    system_prompt = build_system_prompt()
    user_prompt   = build_user_prompt(req)

    try:
        base_config = generate_dashboard_config(system_prompt, user_prompt)
    except GeminiError as e:
        logger.error("Gemini failure: %s", e)
        raise HTTPException(status_code=502, detail=str(e))

    # Use the first 40 chars of the prompt as a friendly base name.
    base_name = req.prompt.strip().splitlines()[0][:40].strip() or "Untitled"
    variants  = derive_variants(base_config, base_name, req.variant_count)

    return GenerateResponse(success=True, configs=variants)
