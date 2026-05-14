"""
OpenAI fallback for the in-process LLM module.

Mirrors ``gemini_client.generate_dashboard_config`` but uses OpenAI Chat
Completions with JSON mode. Used as a fallback when Gemini fails (expired
key, quota, network, etc.).

Kept deliberately simple: no tool calls. The user prompt already contains the
registered resources, and component capabilities are summarised inline in the
system prompt so the model has everything it needs in one shot.
"""

from __future__ import annotations

import json
import logging
import os
import asyncio
from typing import Any

from pydantic import ValidationError

from .schemas import DashboardConfig

logger = logging.getLogger("llm.openai")

DEFAULT_MODEL = os.getenv("OPENAI_MODEL", "gpt-4o-mini")


class OpenAIError(Exception):
    """Raised when OpenAI cannot produce a valid DashboardConfig."""


def _format_sdk_error(exc: Exception) -> str:
    text = str(exc)
    if "invalid_api_key" in text or "Incorrect API key" in text:
        return "OpenAI API key is invalid. Check OPENAI_API_KEY in the backend env."
    if "insufficient_quota" in text or "exceeded your current quota" in text:
        return "OpenAI quota exceeded. Top up the OPENAI_API_KEY billing."
    return f"OpenAI API call failed: {text}"


def _client() -> Any:
    api_key = os.getenv("OPENAI_API_KEY")
    if not api_key:
        raise OpenAIError("OPENAI_API_KEY is not set in the backend env")
    try:
        from openai import OpenAI  # type: ignore[import-not-found]
    except ImportError as exc:
        raise OpenAIError(
            "The 'openai' package is not installed. Add it to requirements.txt and reinstall."
        ) from exc
    return OpenAI(api_key=api_key)


def _component_capabilities_summary() -> str:
    """Inline summary of component props so the model doesn't need a tool call."""
    from .component_capabilities import COMPONENT_CAPABILITIES

    lines: list[str] = []
    for name, cap in COMPONENT_CAPABILITIES.items():
        style_props = ", ".join(cap.get("style", [])[:12]) or "—"
        data_props = ", ".join(cap.get("data", [])[:12]) or "—"
        lines.append(f"- {name}: style[{style_props}] data[{data_props}]")
    return "\n".join(lines)


def _call_openai(system_prompt: str, user_prompt: str) -> str:
    client = _client()
    augmented_system = (
        f"{system_prompt}\n\n"
        "## Component capabilities (use only these props)\n"
        f"{_component_capabilities_summary()}"
    )
    try:
        completion = client.chat.completions.create(
            model=DEFAULT_MODEL,
            response_format={"type": "json_object"},
            temperature=0.7,
            messages=[
                {"role": "system", "content": augmented_system},
                {"role": "user", "content": user_prompt},
            ],
        )
    except Exception as exc:
        raise OpenAIError(_format_sdk_error(exc)) from exc

    if not completion.choices:
        raise OpenAIError("OpenAI returned no choices")
    content = completion.choices[0].message.content
    if not content:
        raise OpenAIError("OpenAI returned empty content")
    return content


async def generate_dashboard_config(system_prompt: str, user_prompt: str) -> DashboardConfig:
    """Call OpenAI and validate the result. One automatic retry on schema failure."""
    raw = await asyncio.to_thread(_call_openai, system_prompt, user_prompt)
    try:
        return DashboardConfig.model_validate(json.loads(raw))
    except (ValidationError, json.JSONDecodeError) as first_error:
        logger.warning("First OpenAI response failed validation: %s", first_error)
        repair_prompt = (
            f"{user_prompt}\n\n"
            "## Your previous response was rejected\n"
            f"Reason: {first_error}\n\n"
            "Return a corrected JSON object now. No prose, no markdown."
        )
        raw = await asyncio.to_thread(_call_openai, system_prompt, repair_prompt)
        try:
            return DashboardConfig.model_validate(json.loads(raw))
        except (ValidationError, json.JSONDecodeError) as second_error:
            logger.error("Second OpenAI response also failed: %s", second_error)
            raise OpenAIError(
                f"OpenAI returned invalid config twice. Last error: {second_error}"
            ) from second_error
