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
import asyncio
from pathlib import Path
from typing import Any

from dotenv import load_dotenv
from google import genai
from google.genai import types
from pydantic import ValidationError

from .schemas import DashboardConfig
from .tools import execute_tool, gemini_tools

logger = logging.getLogger("llm.gemini")


SERVICE_ENV_PATH = Path(__file__).resolve().parents[1] / ".env"
load_dotenv(SERVICE_ENV_PATH, override=True)

DEFAULT_MODEL = os.getenv("GEMINI_MODEL", "gemini-2.5-flash")
MAX_TOOL_CALL_TURNS = int(os.getenv("GEMINI_MAX_TOOL_CALL_TURNS", "4"))
PROXY_ENV_VARS = (
    "HTTP_PROXY",
    "HTTPS_PROXY",
    "ALL_PROXY",
    "http_proxy",
    "https_proxy",
    "all_proxy",
)


class GeminiError(Exception):
    """Raised when Gemini cannot produce a valid DashboardConfig."""


def _disable_ambient_proxies() -> None:
    """Avoid broken shell proxy vars hijacking Gemini API calls in local dev."""
    if os.getenv("LLM_ALLOW_PROXY", "").lower() in {"1", "true", "yes"}:
        return

    removed = [name for name in PROXY_ENV_VARS if os.environ.pop(name, None)]
    if removed:
        logger.info("Ignoring proxy env vars for Gemini calls: %s", ", ".join(removed))


def _format_sdk_error(exc: Exception) -> str:
    text = str(exc)
    if "API key expired" in text:
        return "Gemini API key expired. Renew GEMINI_API_KEY in the backend env."
    if "API_KEY_INVALID" in text:
        return "Gemini API key is invalid. Check GEMINI_API_KEY in the backend env."
    return f"Gemini API call failed: {text}"


def _client() -> genai.Client:
    _disable_ambient_proxies()
    api_key = os.getenv("GEMINI_API_KEY")
    if not api_key:
        raise GeminiError("GEMINI_API_KEY is not set in the backend env")
    return genai.Client(api_key=api_key)


def _content_from_text(text: str) -> types.Content:
    return types.Content(role="user", parts=[types.Part.from_text(text=text)])


def _extract_function_calls(response: types.GenerateContentResponse) -> list[types.FunctionCall]:
    """Return any function calls from candidates and SDK AFC history."""
    calls: list[types.FunctionCall] = []

    for candidate in response.candidates or []:
        content = candidate.content
        if not content or not content.parts:
            continue
        calls.extend(part.function_call for part in content.parts if part.function_call)

    # Some SDK versions keep tool calls in automatic_function_calling_history.
    for entry in getattr(response, "automatic_function_calling_history", []) or []:
        for part in getattr(entry, "parts", []) or []:
            function_call = getattr(part, "function_call", None)
            if function_call:
                calls.append(function_call)

    return calls


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
    config_kwargs: dict[str, Any] = {
        "system_instruction": system_prompt,
        "temperature": 0.7,
        "tools": gemini_tools() if with_tools else None,
    }
    if not with_tools:
        config_kwargs["response_mime_type"] = "application/json"

    try:
        response = client.models.generate_content(
            model=DEFAULT_MODEL,
            contents=contents,
            config=types.GenerateContentConfig(**config_kwargs),
        )
    except Exception as exc:
        # Normalize SDK/network failures into GeminiError so FastAPI returns a
        # controlled 502 instead of an unhandled 500.
        raise GeminiError(_format_sdk_error(exc)) from exc

    # response.text raises if the candidate has only function_call parts. Read
    # it defensively so logging never crashes a successful tool-calling turn.
    try:
        has_text = bool(response.text)
    except Exception:
        has_text = False

    candidate_count = len(response.candidates or [])
    logger.info(
        "gemini.call.ok model=%s with_tools=%s candidates=%d has_text=%s",
        DEFAULT_MODEL,
        with_tools,
        candidate_count,
        has_text,
    )
    return response


def _response_text(response: types.GenerateContentResponse) -> str:
    # response.text may raise if the candidate has only function_call parts.
    try:
        if response.text:
            return response.text
    except Exception as exc:
        logger.debug("gemini.response_text fallback due to exception: %s", exc)

    text_parts: list[str] = []
    for candidate in response.candidates or []:
        content = candidate.content
        if not content or not content.parts:
            continue
        for part in content.parts:
            text = getattr(part, "text", None)
            if text:
                text_parts.append(text)

    if text_parts:
        return "\n".join(text_parts)

    calls = _extract_function_calls(response)
    if calls:
        names = ",".join(sorted({call.name or "unknown" for call in calls}))
        raise GeminiError(
            f"Gemini returned only tool calls ({names}) without final text response"
        )

    raise GeminiError("Gemini returned an empty response")


def _parse_dashboard_json(raw: str) -> Any:
    """Parse JSON even when the model wraps it in a markdown code fence."""
    text = raw.strip()
    original_len = len(text)
    if text.startswith("```"):
        lines = text.splitlines()
        if lines and lines[0].startswith("```"):
            lines = lines[1:]
        if lines and lines[-1].strip() == "```":
            lines = lines[:-1]
        text = "\n".join(lines).strip()

    if not text.startswith("{"):
        start = text.find("{")
        end = text.rfind("}")
        if start != -1 and end != -1 and end > start:
            text = text[start : end + 1]

    logger.info("gemini.parse_json length_before=%d length_after=%d", original_len, len(text))
    return json.loads(text)


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
    logger.info("gemini.call.start model=%s max_tool_turns=%d", DEFAULT_MODEL, MAX_TOOL_CALL_TURNS)
    response = _call_gemini_once(client, system_prompt, contents, with_tools=True)

    for turn in range(MAX_TOOL_CALL_TURNS):
        function_calls = _extract_function_calls(response)
        logger.info("gemini.tool_turn turn=%d function_calls=%d", turn + 1, len(function_calls))
        if not function_calls:
            return _response_text(response)

        _append_model_response(contents, response)
        tool_parts: list[types.Part] = []

        for function_call in function_calls:
            name = function_call.name or ""
            args: dict[str, Any] = function_call.args or {}
            result = execute_tool(name, args)
            logger.info("gemini.tool_call name=%s args=%s", name, args)
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


async def generate_dashboard_config(system_prompt: str, user_prompt: str) -> DashboardConfig:
    """
    Call Gemini and validate the result. One automatic retry on schema failure.
    """
    raw = await asyncio.to_thread(_call_gemini, system_prompt, user_prompt)
    try:
        return DashboardConfig.model_validate(_parse_dashboard_json(raw))
    except (ValidationError, json.JSONDecodeError) as first_error:
        preview = raw[:200].replace("\n", "\\n")
        logger.warning("gemini.validation.first_fail error=%s raw_preview=%s", first_error, preview)
        # Retry once with the validator's complaint included in the prompt —
        # gives the model concrete feedback about what to fix.
        repair_prompt = (
            f"{user_prompt}\n\n"
            "## Your previous response was rejected\n"
            f"Reason: {first_error}\n\n"
            "Return a corrected JSON object now. No prose, no markdown."
        )
        raw = await asyncio.to_thread(_call_gemini, system_prompt, repair_prompt)
        try:
            return DashboardConfig.model_validate(_parse_dashboard_json(raw))
        except (ValidationError, json.JSONDecodeError) as second_error:
            preview = raw[:200].replace("\n", "\\n")
            logger.error("gemini.validation.second_fail error=%s raw_preview=%s", second_error, preview)
            raise GeminiError(
                f"Gemini returned invalid config twice. Last error: {second_error}"
            ) from second_error
