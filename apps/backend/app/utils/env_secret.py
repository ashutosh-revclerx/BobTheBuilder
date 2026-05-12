"""resolveEnvSecret — port of the helper from `src/routes/execute.ts`.

Converts "{{env.NEXUS_API_KEY}}" -> os.environ["NEXUS_API_KEY"] (or None).
Plain literal values pass through unchanged.
"""

from __future__ import annotations

import os
import re

_PATTERN = re.compile(r"^\{\{env\.([A-Z0-9_]+)\}\}$", re.IGNORECASE)


def resolve_env_secret(secret_ref: str | None) -> str | None:
    if not secret_ref:
        return None
    m = _PATTERN.match(secret_ref)
    if not m:
        return secret_ref
    return os.environ.get(m.group(1))
