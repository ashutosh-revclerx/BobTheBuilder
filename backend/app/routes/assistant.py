"""Assistant route — port of `src/routes/assistant.ts`.

Unlike the Node version, this calls `app.llm.chat.run_chat` directly
(in-process) instead of HTTP-proxying to a separate Python service.
This eliminates one HTTP hop per request.
"""

from __future__ import annotations

import asyncio
import time
from typing import Any, Literal

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from ..auth.deps import require_auth
from ..config import settings
from ..logger import create_logger

log = create_logger("assistant")
router = APIRouter(dependencies=[Depends(require_auth)])


class ChatMessage(BaseModel):
    role: Literal["user", "assistant"]
    content: str


class SelectedComponent(BaseModel):
    model_config = {"extra": "allow"}
    id: str
    type: str
    label: str | None = None
    style: dict[str, Any] | None = None
    data: dict[str, Any] | None = None


class DashboardConfig(BaseModel):
    model_config = {"extra": "allow"}
    components: list[Any]
    queries: list[Any]
    canvasStyle: Any | None = None


class ChatSchema(BaseModel):
    message: str = Field(min_length=1)
    generationPrompt: str | None = None
    dashboardName: str | None = None
    dashboardConfig: DashboardConfig | None = None
    selectedComponent: SelectedComponent | None = None
    conversationHistory: list[ChatMessage] = []


@router.post("/chat")
async def chat(body: ChatSchema):
    started = time.time()

    # In-process LLM call. Import here so module load order works even if
    # the LLM module has heavyweight deps.
    from ..llm.facade import run_chat

    try:
        result = await asyncio.wait_for(
            run_chat(body.model_dump()), timeout=settings.llm_chat_timeout_s
        )
        log.info(f"chat success duration_ms={int((time.time() - started) * 1000)}")
        return result
    except asyncio.TimeoutError:
        seconds = int(settings.llm_chat_timeout_s)
        log.error(f"chat timeout timeout_s={settings.llm_chat_timeout_s}")
        raise HTTPException(
            status_code=504, detail=f"Assistant took longer than {seconds} seconds"
        )
    except Exception as err:
        log.error("chat proxy error:", err)
        raise HTTPException(status_code=502, detail=str(err))
