from typing import Any

import httpx
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from app.config import settings
from app.middleware.auth import require_auth

router = APIRouter()


class ChatMessage(BaseModel):
    role: str
    content: str


class SelectedComponent(BaseModel):
    id: str
    type: str
    label: str | None = None
    style: dict[str, Any] | None = None
    data: dict[str, Any] | None = None


class ChatRequest(BaseModel):
    message: str
    generationPrompt: str | None = None
    dashboardName: str | None = None
    dashboardConfig: dict[str, Any] | None = None
    selectedComponent: SelectedComponent | None = None
    conversationHistory: list[ChatMessage] = []


@router.post("/chat", dependencies=[Depends(require_auth)])
async def chat(body: ChatRequest):
    if not body.message:
        raise HTTPException(status_code=400, detail="message is required")

    timeout_s = settings.llm_chat_timeout_ms / 1000
    llm_url = settings.llm_service_url.rstrip("/")

    try:
        async with httpx.AsyncClient(timeout=timeout_s) as client:
            resp = await client.post(
                f"{llm_url}/chat",
                json=body.model_dump(),
            )

        if not resp.is_success:
            try:
                detail = resp.json().get("detail") or resp.text
            except Exception:
                detail = resp.text
            raise HTTPException(status_code=502, detail=str(detail))

        return resp.json()

    except httpx.TimeoutException:
        secs = int(timeout_s)
        raise HTTPException(status_code=504, detail=f"Assistant took longer than {secs} seconds")
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=502, detail="Could not reach the LLM service") from exc
