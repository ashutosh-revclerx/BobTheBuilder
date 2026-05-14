"""FastAPI auth dependencies — port of `src/middleware/auth.ts`.

Two flavours:
- require_auth: standard bearer-token requirement (used by most routes)
- require_auth_unless_public_customer_dashboard: same, but lets the
  public-facing customer dashboard view through (matches Node middleware)
"""

from __future__ import annotations

import re

from fastapi import Header, HTTPException, Request

from ..http_client import get_client
from .nervesparks import (
    AuthError,
    AuthenticatedUserProfile,
    extract_bearer_token,
    verify_access_token,
)


async def _verify(authorization: str | None) -> AuthenticatedUserProfile:
    token = extract_bearer_token(authorization)
    if not token:
        raise HTTPException(status_code=401, detail="Missing bearer token")
    try:
        _, profile = await verify_access_token(token, get_client())
        return profile
    except AuthError as e:
        raise HTTPException(status_code=e.status, detail=e.message)


async def require_auth(
    request: Request,
    authorization: str | None = Header(default=None),
) -> AuthenticatedUserProfile:
    """Standard auth dependency — returns the user profile, attaches it to
    request.state.user for handlers that need it without re-declaring the dep."""
    profile = await _verify(authorization)
    request.state.user = profile
    return profile


_PUBLIC_CUSTOMER_DASHBOARD_RE = re.compile(r"^/[^/]+/dashboard$")


async def require_auth_unless_public_customer_dashboard(
    request: Request,
    authorization: str | None = Header(default=None),
) -> AuthenticatedUserProfile | None:
    """Mirrors the Node middleware: GET /customers/:slug/dashboard is public
    (token gating is enforced inside the route based on the customer's
    per-customer access_token). All other paths require a bearer token."""
    is_public = request.method == "GET" and bool(
        _PUBLIC_CUSTOMER_DASHBOARD_RE.match(request.url.path.split("/customers", 1)[-1])
    )
    if is_public:
        return None
    profile = await _verify(authorization)
    request.state.user = profile
    return profile


def make_route_error(err: AuthError) -> HTTPException:
    return HTTPException(status_code=err.status, detail=err.message)
