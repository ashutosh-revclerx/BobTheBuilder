"""
Chat assistant for the BTB builder.

Separate from the dashboard-generation flow: shorter prompts, faster turnaround,
multi-turn conversation with the user. The assistant has full context of:
  - The original generation prompt (if dashboard was AI-generated)
  - The current dashboard config (components + queries + canvas)
  - The currently selected component (if any)
  - The full conversation history

It responds with both a free-text reply AND optional structured `suggestions` —
pre-formed edits the user can apply with one click.

Provider strategy: Gemini first; on failure fall back to OpenAI. Same envs as
the generate flow (GEMINI_API_KEY, OPENAI_API_KEY).
"""

from __future__ import annotations

import json
import logging
import os
import asyncio
from typing import Any

from google.genai import types
from pydantic import ValidationError

from .component_capabilities import COMPONENT_CAPABILITIES
from .gemini_client import (
    MAX_TOOL_CALL_TURNS,
    _append_model_response,
    _call_gemini_once,
    _client,
    _extract_function_calls,
    _response_text,
)
from .schemas import ChatRequest, ChatResponse, Suggestion
from .tools import execute_tool, gemini_tools

logger = logging.getLogger("llm.chat")

CHAT_SYSTEM_PROMPT_VERSION = "v1.1"


# ─── System prompt ──────────────────────────────────────────────────────────


def _component_capabilities_summary() -> str:
    """Inline component reference so the LLM knows what it can suggest."""
    lines: list[str] = []
    for name, cap in COMPONENT_CAPABILITIES.items():
        style_props = ", ".join(cap.get("style", [])[:10]) or "—"
        data_props = ", ".join(cap.get("data", [])[:10]) or "—"
        lines.append(f"- **{name}**: style[{style_props}] data[{data_props}]")
    return "\n".join(lines)


def build_chat_system_prompt() -> str:
    """System prompt for the chat assistant. Contains BTB component knowledge
    AND instructions on how to format suggestions."""
    valid_types = ", ".join(COMPONENT_CAPABILITIES.keys())
    return f"""You are an AI assistant embedded in **BobTheBuilder (BTB)**, a no-code dashboard
builder. You help users understand, refine, and improve their dashboards.

The user is currently editing a dashboard in the builder UI. You have access to:
  - The original prompt that generated the dashboard (if available)
  - The current dashboard config (components, queries, canvas style)
  - The component the user has currently selected (if any)
  - Your previous conversation with this user

## Your Role
- Answer questions about the dashboard, its components, queries, or design choices
- Explain why certain components were chosen given the original prompt
- Suggest improvements (better layout, missing components, query bindings)
- When asked to change something, propose concrete edits as **structured suggestions**

## Available Component Types — USE ONLY THESE EXACT NAMES
**Valid `type` values are EXACTLY:** {valid_types}

**There is NO DatePicker, NO Calendar, NO Dropdown, NO Form, NO Card.**
For date input → use **TextInput** with placeholder like "YYYY-MM-DD".
For dropdown → use **Select**.
For a label/caption → use **Text**.

Component capability reference:
{_component_capabilities_summary()}

## Component Property Lookup Tool

You have access to the `get_component_capabilities` tool.
Call it with a component type name (e.g. "StatCard", "Table") to get the full
list of style and data properties that component accepts — including descriptions
and valid value ranges. Use it whenever you need to suggest specific property changes
or verify that a property exists before recommending it.

## Response Format

You MUST respond with a single JSON object with this exact shape:

```json
{{
  "response": "Your conversational reply to the user. Use markdown. Be concise.",
  "suggestions": [
    {{
      "type": "addComponent" | "updateComponent" | "removeComponent" | "addQuery" | "updateQuery" | "removeQuery" | "updateCanvas",
      "description": "Short human-readable description shown on the Apply button card",
      "payload": {{ ... edit-specific payload ... }}
    }}
  ]
}}
```

If the user is just chatting (asking questions, no change requested), return
an empty `suggestions` array.

## Suggestion Payload Schemas

**addComponent** — adds a new component:
```json
{{
  "type": "addComponent",
  "description": "Add a date picker at the top",
  "payload": {{
    "component": {{
      "id": "auto",
      "type": "DatePicker",
      "label": "Date Range",
      "layout": {{ "x": 0, "y": 0, "w": 4, "h": 2 }},
      "style": {{ "backgroundColor": "#ffffff" }},
      "data": {{ "value": "today" }}
    }}
  }}
}}
```

**updateComponent** — modifies an existing component:
```json
{{
  "type": "updateComponent",
  "description": "Change StatCard background to dark blue",
  "payload": {{
    "id": "stat-1",
    "style": {{ "backgroundColor": "#1e293b", "textColor": "#ffffff" }}
  }}
}}
```
Only include the fields you want to change. Top-level keys allowed: `style`, `data`, `label`, `layout`.

**removeComponent**:
```json
{{ "type": "removeComponent", "description": "Remove the duplicate StatCard", "payload": {{ "id": "stat-2" }} }}
```

**addQuery** / **updateQuery** / **removeQuery** — modify queries.
**updateCanvas** — change canvas background:
```json
{{ "type": "updateCanvas", "description": "Switch to dark theme", "payload": {{ "backgroundColor": "#0f172a" }} }}
```

## Critical Rules
1. **Always return valid JSON.** No prose before or after. No markdown code fences around the JSON.
2. **Component type validation is STRICT.** If you use a `type` value not in the valid list above,
   the user will get an error and your suggestion will fail. When in doubt, prefer TextInput, Text,
   Button, or StatCard — those always work.
3. **Don't propose edits unless the user asks.** Just chat when they're asking questions.
4. **MINIMUM SUGGESTIONS — DO NOT pad responses with layout shifts.** If the user asks to add ONE
   thing, return ONE `addComponent` suggestion. **DO NOT** also propose `updateComponent` for every
   existing component to "shift them down" — the canvas grid handles layout automatically.
   Hard limit: at most **3 suggestions per response**, and only when each is independently useful.
5. **Reference the user's intent.** If you have their original generation prompt, mention it
   when explaining design decisions ("Since you originally asked for X, this StatCard shows...").
6. **Keep responses short.** Users are working — they want answers, not essays.
7. **When the user has a component selected**, focus your suggestions on that component.
8. **For new components, leave the `id` as `"auto"`** so BTB generates a unique id. Don't pick
   `x`/`y` coordinates that overlap existing components — pick a free spot or use `y` larger
   than any existing component's `y + h`.

Now respond to the user's message based on the context provided."""


def build_chat_user_prompt(req: ChatRequest) -> str:
    """Build the user-turn prompt with the current dashboard context."""
    sections: list[str] = []

    if req.generation_prompt:
        sections.append(f"## Original generation prompt\n{req.generation_prompt}")

    if req.dashboard_name:
        sections.append(f"## Dashboard name\n{req.dashboard_name}")

    if req.dashboard_config:
        config_summary = {
            "components": [
                {
                    "id": c.id,
                    "type": c.type,
                    "label": c.label,
                    "layout": c.layout.model_dump(),
                    "style_keys": list(c.style.keys()),
                    "data_keys": list(c.data.keys()),
                }
                for c in req.dashboard_config.components
            ],
            "queries": [
                {
                    "name": q.name,
                    "resource": q.resource,
                    "endpoint": q.endpoint,
                    "method": q.method,
                    "trigger": q.trigger,
                }
                for q in req.dashboard_config.queries
            ],
            "canvas": req.dashboard_config.canvasStyle.model_dump() if req.dashboard_config.canvasStyle else None,
        }
        sections.append(
            "## Current dashboard state\n```json\n"
            + json.dumps(config_summary, indent=2)
            + "\n```"
        )

    if req.selected_component:
        sections.append(
            "## Currently selected component\n```json\n"
            + json.dumps(req.selected_component.model_dump(), indent=2)
            + "\n```"
        )

    sections.append(f"## User's message\n{req.message}")

    return "\n\n".join(sections)


# ─── LLM call (Gemini → OpenAI fallback) ────────────────────────────────────


class ChatError(Exception):
    """Raised when neither provider can produce a valid chat response."""


def _parse_chat_json(raw: str) -> dict[str, Any]:
    """Parse JSON from the LLM, tolerating markdown code fences."""
    text = raw.strip()
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

    return json.loads(text)


async def _call_gemini_chat(system_prompt: str, user_prompt: str, history: list[dict[str, str]]) -> str:
    """Gemini chat call with component tool support.

    Runs the same tool-call loop as the generation flow so Gemini can call
    get_component_capabilities during the conversation turn.
    """
    client = _client()
    model = os.getenv("GEMINI_MODEL", "gemini-2.5-flash")

    # Build contents: history + current user message
    contents: list[types.Content] = []
    for msg in history:
        role = "user" if msg["role"] == "user" else "model"
        contents.append(
            types.Content(role=role, parts=[types.Part.from_text(text=msg["content"])])
        )
    contents.append(
        types.Content(role="user", parts=[types.Part.from_text(text=user_prompt)])
    )

    logger.info("chat.gemini.start max_tool_turns=%d", MAX_TOOL_CALL_TURNS)
    try:
        response = await asyncio.to_thread(
            _call_gemini_once, client, system_prompt, contents, with_tools=True
        )
    except Exception as exc:
        raise ChatError(f"Gemini chat call failed: {exc}") from exc

    for turn in range(MAX_TOOL_CALL_TURNS):
        function_calls = _extract_function_calls(response)
        logger.info("chat.tool_turn turn=%d calls=%d", turn + 1, len(function_calls))

        if not function_calls:
            # No tool calls — extract text and return it for JSON parsing
            try:
                return _response_text(response)
            except Exception as exc:
                raise ChatError(f"Gemini chat returned no usable text: {exc}") from exc

        _append_model_response(contents, response)
        tool_parts: list[types.Part] = []
        for fc in function_calls:
            name = fc.name or ""
            args = fc.args or {}
            result = execute_tool(name, args)
            logger.info("chat.tool_call name=%s", name)
            tool_parts.append(types.Part.from_function_response(name=name, response=result))

        contents.append(types.Content(role="user", parts=tool_parts))
        try:
            response = await asyncio.to_thread(
                _call_gemini_once, client, system_prompt, contents, with_tools=True
            )
        except Exception as exc:
            raise ChatError(f"Gemini chat tool turn failed: {exc}") from exc

    # Exceeded max tool turns — force the final JSON answer without tools
    logger.warning("chat.tool_turns.exceeded max=%d; forcing final answer", MAX_TOOL_CALL_TURNS)
    contents.append(
        types.Content(
            role="user",
            parts=[types.Part.from_text(
                text='Return your final answer now as JSON with "response" and "suggestions" keys. '
                     "No prose, no markdown fences."
            )],
        )
    )
    try:
        response = await asyncio.to_thread(
            _call_gemini_once, client, system_prompt, contents, with_tools=False
        )
        return _response_text(response)
    except Exception as exc:
        raise ChatError(f"Gemini forced-final-answer call failed: {exc}") from exc


async def _call_openai_chat(system_prompt: str, user_prompt: str, history: list[dict[str, str]]) -> str:
    """Single-shot OpenAI call returning raw text. JSON mode."""
    api_key = os.getenv("OPENAI_API_KEY")
    if not api_key:
        raise ChatError("OPENAI_API_KEY not set")

    try:
        from openai import OpenAI  # type: ignore[import-not-found]
    except ImportError as exc:
        raise ChatError("'openai' package not installed") from exc

    client = OpenAI(api_key=api_key)
    model = os.getenv("OPENAI_MODEL", "gpt-4o-mini")

    messages: list[dict[str, str]] = [{"role": "system", "content": system_prompt}]
    for msg in history:
        messages.append({"role": msg["role"], "content": msg["content"]})
    messages.append({"role": "user", "content": user_prompt})

    try:
        completion = await asyncio.to_thread(
            client.chat.completions.create,
            model=model,
            response_format={"type": "json_object"},
            temperature=0.5,
            messages=messages,  # type: ignore[arg-type]
        )
    except Exception as exc:
        raise ChatError(f"OpenAI chat call failed: {exc}") from exc

    text = completion.choices[0].message.content or ""
    if not text:
        raise ChatError("OpenAI returned empty chat response")
    return text


async def run_chat(req: ChatRequest | dict[str, Any]) -> ChatResponse:
    """
    Build the chat prompt, call the LLM, parse the structured response.

    Provider strategy: Gemini first; on any error fall back to OpenAI.
    """
    if isinstance(req, dict):
        req = ChatRequest.model_validate(req)

    system_prompt = build_chat_system_prompt()
    user_prompt = build_chat_user_prompt(req)
    history = [m.model_dump() for m in req.conversation_history]

    raw: str | None = None
    gemini_err: ChatError | None = None
    try:
        raw = await _call_gemini_chat(system_prompt, user_prompt, history)
        logger.info("chat.provider.ok provider=gemini chars=%d", len(raw))
    except ChatError as exc:
        gemini_err = exc
        logger.warning("chat.provider.fail provider=gemini error=%s", exc)

    if raw is None:
        try:
            raw = await _call_openai_chat(system_prompt, user_prompt, history)
            logger.info("chat.provider.ok provider=openai chars=%d", len(raw))
        except ChatError as exc:
            logger.error("chat.provider.fail provider=openai error=%s", exc)
            raise ChatError(f"Both providers failed. Gemini: {gemini_err}; OpenAI: {exc}") from exc

    try:
        parsed = _parse_chat_json(raw)
    except json.JSONDecodeError as exc:
        # Tolerant fallback: treat the whole raw output as the response text
        # so the user gets _something_ even if the JSON wrapping is broken.
        logger.warning("chat.parse.fail error=%s preview=%s", exc, raw[:200])
        return ChatResponse(success=True, response=raw, suggestions=[])

    response_text = str(parsed.get("response", "") or "")
    raw_suggestions = parsed.get("suggestions") or []

    suggestions: list[Suggestion] = []
    for s in raw_suggestions:
        try:
            suggestions.append(Suggestion.model_validate(s))
        except ValidationError as exc:
            logger.warning("chat.suggestion.invalid error=%s payload=%s", exc, s)
            continue

    return ChatResponse(success=True, response=response_text, suggestions=suggestions)
