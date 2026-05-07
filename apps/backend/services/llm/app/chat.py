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
from typing import Any

from pydantic import ValidationError

from .component_capabilities import COMPONENT_CAPABILITIES
from .schemas import ChatRequest, ChatResponse, Suggestion

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


def _call_gemini_chat(system_prompt: str, user_prompt: str, history: list[dict[str, str]]) -> str:
    """Single-shot Gemini call returning raw text. No tools."""
    from google import genai
    from google.genai import types

    api_key = os.getenv("GEMINI_API_KEY")
    if not api_key:
        raise ChatError("GEMINI_API_KEY not set")

    client = genai.Client(api_key=api_key)
    model = os.getenv("GEMINI_MODEL", "gemini-2.5-flash")

    contents: list[types.Content] = []
    for msg in history:
        role = "user" if msg["role"] == "user" else "model"
        contents.append(types.Content(role=role, parts=[types.Part.from_text(text=msg["content"])]))
    contents.append(types.Content(role="user", parts=[types.Part.from_text(text=user_prompt)]))

    try:
        response = client.models.generate_content(
            model=model,
            contents=contents,
            config=types.GenerateContentConfig(
                system_instruction=system_prompt,
                temperature=0.5,
                response_mime_type="application/json",
            ),
        )
    except Exception as exc:
        raise ChatError(f"Gemini chat call failed: {exc}") from exc

    try:
        text = response.text or ""
    except Exception:
        text = ""
    if not text:
        raise ChatError("Gemini returned empty chat response")
    return text


def _call_openai_chat(system_prompt: str, user_prompt: str, history: list[dict[str, str]]) -> str:
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
        completion = client.chat.completions.create(
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


def run_chat(req: ChatRequest) -> ChatResponse:
    """
    Build the chat prompt, call the LLM, parse the structured response.

    Provider strategy: Gemini first; on any error fall back to OpenAI.
    """
    system_prompt = build_chat_system_prompt()
    user_prompt = build_chat_user_prompt(req)
    history = [m.model_dump() for m in req.conversation_history]

    raw: str | None = None
    gemini_err: ChatError | None = None
    try:
        raw = _call_gemini_chat(system_prompt, user_prompt, history)
        logger.info("chat.provider.ok provider=gemini chars=%d", len(raw))
    except ChatError as exc:
        gemini_err = exc
        logger.warning("chat.provider.fail provider=gemini error=%s", exc)

    if raw is None:
        try:
            raw = _call_openai_chat(system_prompt, user_prompt, history)
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
