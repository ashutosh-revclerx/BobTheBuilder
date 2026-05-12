"""Centralized environment-variable parsing — single source of truth.

Mirrors the Node `src/config/env.ts` module.
"""

from __future__ import annotations

import os
from pathlib import Path
from typing import Literal

from dotenv import load_dotenv

# Load .env from apps/backend/.env (next to this app/ package)
_ENV_PATH = Path(__file__).resolve().parents[1] / ".env"
load_dotenv(_ENV_PATH, override=False)


def _read_positive_int(name: str, fallback: int) -> int:
    raw = os.environ.get(name)
    if not raw:
        return fallback
    try:
        parsed = int(raw)
    except ValueError:
        return fallback
    return parsed if parsed > 0 else fallback


class Settings:
    """Process-wide settings. Instantiate once at startup and import the singleton."""

    def __init__(self) -> None:
        self.port: int = _read_positive_int("PORT", 3002)  # default 3002 during dev overlap
        self.database_url: str = os.environ.get(
            "DATABASE_URL",
            "postgresql://dashboard_user:dashboard_pass@localhost:5432/dashboard_db",
        )
        self.cors_origin: str = os.environ.get("CORS_ORIGIN", "*")
        self.log_level: str = os.environ.get("LOG_LEVEL", "info").lower()

        # LLM provider keys (LLM now runs in-process, not as a separate service)
        self.gemini_api_key: str | None = os.environ.get("GEMINI_API_KEY")
        self.gemini_model: str = os.environ.get("GEMINI_MODEL", "gemini-2.5-flash")
        self.openai_api_key: str | None = os.environ.get("OPENAI_API_KEY")
        self.openai_model: str = os.environ.get("OPENAI_MODEL", "gpt-4o-mini")

        # Auth provider
        self.auth_base_url: str = os.environ.get(
            "AUTH_BASE_URL", "https://auth.nervesparks.com"
        )

        # Generation timeouts (seconds)
        self.llm_timeout_s: float = _read_positive_int("LLM_TIMEOUT_MS", 180_000) / 1000.0
        self.llm_chat_timeout_s: float = (
            _read_positive_int("LLM_CHAT_TIMEOUT_MS", 60_000) / 1000.0
        )


settings = Settings()
