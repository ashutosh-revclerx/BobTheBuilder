"""Scoped logger factory — port of `src/utils/logger.ts`.

Produces lines like:
    2026-05-12T15:30:00.000Z INFO  [dashboards] generate success ...

Respects LOG_LEVEL env var (debug | info | warn | error). Output is the
same shape and ordering as the Node logger so docker compose logs stay
greppable across the migration.
"""

from __future__ import annotations

import logging
import sys
from datetime import datetime, timezone

from .config import settings

_LEVEL_MAP: dict[str, int] = {
    "debug": logging.DEBUG,
    "info": logging.INFO,
    "warn": logging.WARNING,
    "warning": logging.WARNING,
    "error": logging.ERROR,
}

_MIN_LEVEL = _LEVEL_MAP.get(settings.log_level, logging.INFO)


class _UtcIsoFormatter(logging.Formatter):
    def format(self, record: logging.LogRecord) -> str:
        ts = datetime.fromtimestamp(record.created, tz=timezone.utc).isoformat(
            timespec="milliseconds"
        ).replace("+00:00", "Z")
        tag = record.levelname.upper().ljust(5)
        scope = getattr(record, "scope", "btb")
        return f"{ts} {tag} [{scope}] {record.getMessage()}"


_handler = logging.StreamHandler(sys.stdout)
_handler.setFormatter(_UtcIsoFormatter())

_root = logging.getLogger("btb")
if not _root.handlers:
    _root.addHandler(_handler)
    _root.setLevel(_MIN_LEVEL)
    _root.propagate = False


class _ScopedLogger:
    """Mimics the Node `Logger` interface: .debug/.info/.warn/.error/.child."""

    def __init__(self, scope: str) -> None:
        self._scope = scope
        self._logger = logging.getLogger(f"btb.{scope}")
        if not self._logger.handlers:
            self._logger.addHandler(_handler)
            self._logger.setLevel(_MIN_LEVEL)
            self._logger.propagate = False

    def _format_extra(self, extras: tuple) -> str:
        if not extras:
            return ""
        parts: list[str] = []
        for e in extras:
            if isinstance(e, BaseException):
                parts.append(f"{type(e).__name__}: {e}")
            elif isinstance(e, (dict, list)):
                import json

                try:
                    parts.append(json.dumps(e, default=str))
                except Exception:
                    parts.append(str(e))
            else:
                parts.append(str(e))
        return " " + " ".join(parts)

    def _emit(self, level: int, msg: str, extras: tuple) -> None:
        self._logger.log(level, msg + self._format_extra(extras), extra={"scope": self._scope})

    def debug(self, msg: str, *extras) -> None:
        self._emit(logging.DEBUG, msg, extras)

    def info(self, msg: str, *extras) -> None:
        self._emit(logging.INFO, msg, extras)

    def warn(self, msg: str, *extras) -> None:
        self._emit(logging.WARNING, msg, extras)

    # Python convention also exposes `warning` as alias.
    warning = warn

    def error(self, msg: str, *extras) -> None:
        self._emit(logging.ERROR, msg, extras)

    def child(self, sub_scope: str) -> "_ScopedLogger":
        return _ScopedLogger(f"{self._scope}:{sub_scope}")


def create_logger(scope: str) -> _ScopedLogger:
    return _ScopedLogger(scope)


root_logger = create_logger("btb")
