"""
Thin wrapper around the Gemini SDK. Single responsibility: take a system +
user prompt, get back a JSON object that parses as a DashboardConfig.

Retry strategy: try once. If the JSON doesn't validate, send it back to
Gemini with the validator's error message and try ONE more time. After that,
give up — repeated failures usually mean a prompt issue, not a transient
problem.
"""

from __future__ import annotations

import json
import logging
import os

from google import genai
from google.genai import types
from pydantic import ValidationError

from .schemas import DashboardConfig

logger = logging.getLogger("llm.gemini")

DEFAULT_MODEL = os.getenv("GEMINI_MODEL", "gemini-2.5-flash")


class GeminiError(Exception):
    """Raised when Gemini cannot produce a valid DashboardConfig."""


def _client() -> genai.Client:
    api_key = os.getenv("GEMINI_API_KEY")
    if not api_key:
        raise GeminiError("GEMINI_API_KEY is not set in the LLM service env")
    return genai.Client(api_key=api_key)


def _call_gemini(system_prompt: str, user_prompt: str) -> str:
    """Single call. Returns raw response text.

    NOTE: We deliberately do NOT pass `response_schema=DashboardConfig` here.
    The Gemini SDK can't translate open-ended `dict[str, Any]` fields (used
    for `component.style` and `component.data` because each component type
    has different keys) — it crashes with
    `AttributeError: 'dict' object has no attribute 'upper'` deep in
    google.genai._transformers.process_schema.

    `response_mime_type="application/json"` is sufficient to force JSON
    output. Pydantic validation in `generate_dashboard_config` enforces the
    schema after the fact, with a 1-shot repair retry on failure.
    """
    client = _client()
    response = client.models.generate_content(
        model=DEFAULT_MODEL,
        contents=user_prompt,
        config=types.GenerateContentConfig(
            system_instruction=system_prompt,
            response_mime_type="application/json",
            temperature=0.7,
        ),
    )
    if not response.text:
        raise GeminiError("Gemini returned an empty response")
    return response.text


def generate_dashboard_config(system_prompt: str, user_prompt: str) -> DashboardConfig:
    """
    Call Gemini and validate the result. One automatic retry on schema failure.
    """
    raw = _call_gemini(system_prompt, user_prompt)
    try:
        return DashboardConfig.model_validate(json.loads(raw))
    except (ValidationError, json.JSONDecodeError) as first_error:
        logger.warning("First Gemini response failed validation: %s", first_error)
        # Retry once with the validator's complaint included in the prompt —
        # gives the model concrete feedback about what to fix.
        repair_prompt = (
            f"{user_prompt}\n\n"
            "## Your previous response was rejected\n"
            f"Reason: {first_error}\n\n"
            "Return a corrected JSON object now. No prose, no markdown."
        )
        raw = _call_gemini(system_prompt, repair_prompt)
        try:
            return DashboardConfig.model_validate(json.loads(raw))
        except (ValidationError, json.JSONDecodeError) as second_error:
            logger.error("Second Gemini response also failed: %s", second_error)
            raise GeminiError(
                f"Gemini returned invalid config twice. Last error: {second_error}"
            ) from second_error
