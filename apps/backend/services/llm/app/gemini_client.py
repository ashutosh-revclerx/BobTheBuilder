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
from typing import Any

from google import genai
from google.genai import types
from pydantic import ValidationError

from .schemas import DashboardConfig
from .tools import execute_tool, gemini_tools

logger = logging.getLogger("llm.gemini")

DEFAULT_MODEL = os.getenv("GEMINI_MODEL", "gemini-2.5-flash")
MAX_TOOL_CALL_TURNS = int(os.getenv("GEMINI_MAX_TOOL_CALL_TURNS", "4"))


class GeminiError(Exception):
    """Raised when Gemini cannot produce a valid DashboardConfig."""


def _client() -> genai.Client:
    api_key = os.getenv("GEMINI_API_KEY")
    if not api_key:
        raise GeminiError("GEMINI_API_KEY is not set in the LLM service env")
    return genai.Client(api_key=api_key)


def _content_from_text(text: str) -> types.Content:
    return types.Content(role="user", parts=[types.Part.from_text(text=text)])


def _extract_function_calls(response: types.GenerateContentResponse) -> list[types.FunctionCall]:
    """Return any function calls from the first candidate."""
    if not response.candidates:
        return []

    content = response.candidates[0].content
    if not content or not content.parts:
        return []

    return [part.function_call for part in content.parts if part.function_call]


def _append_model_response(
    contents: list[types.Content],
    response: types.GenerateContentResponse,
) -> None:
    """Preserve the model turn before appending function responses."""
    if response.candidates and response.candidates[0].content:
        contents.append(response.candidates[0].content)


def _call_gemini_once(
    client: genai.Client,
    system_prompt: str,
    contents: str | list[types.Content],
    *,
    with_tools: bool,
) -> types.GenerateContentResponse:
    return client.models.generate_content(
        model=DEFAULT_MODEL,
        contents=contents,
        config=types.GenerateContentConfig(
            system_instruction=system_prompt,
            response_mime_type="application/json",
            temperature=0.7,
            tools=gemini_tools() if with_tools else None,
        ),
    )


def _response_text(response: types.GenerateContentResponse) -> str:
    if response.text:
        return response.text
    raise GeminiError("Gemini returned an empty response")


def _call_gemini(system_prompt: str, user_prompt: str) -> str:
    """Call Gemini. Returns raw response text.

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
    contents = [_content_from_text(user_prompt)]
    response = _call_gemini_once(client, system_prompt, contents, with_tools=True)

    for _ in range(MAX_TOOL_CALL_TURNS):
        function_calls = _extract_function_calls(response)
        if not function_calls:
            return _response_text(response)

        _append_model_response(contents, response)
        tool_parts: list[types.Part] = []

        for function_call in function_calls:
            name = function_call.name or ""
            args: dict[str, Any] = function_call.args or {}
            result = execute_tool(name, args)
            logger.info("Gemini tool call: %s args=%s", name, args)
            tool_parts.append(
                types.Part.from_function_response(name=name, response=result)
            )

        contents.append(types.Content(role="user", parts=tool_parts))
        response = _call_gemini_once(client, system_prompt, contents, with_tools=True)

    logger.warning(
        "Gemini exceeded max tool-call turns (%d); asking for final JSON without tools",
        MAX_TOOL_CALL_TURNS,
    )
    contents.append(
        _content_from_text(
            "Return the final dashboard config JSON now using the tool results above. "
            "No prose, no markdown."
        )
    )
    response = _call_gemini_once(client, system_prompt, contents, with_tools=False)
    return _response_text(response)


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
