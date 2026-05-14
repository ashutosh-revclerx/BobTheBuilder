"""Auth proxy routes — port of `src/routes/auth.ts`.

Proxies POST {login, register, refresh, logout} to the upstream NerveSparks
auth service, verifying any returned access token before forwarding the
response to the client. Also exposes GET/POST /me.
"""

from __future__ import annotations

from typing import Any, Literal

from fastapi import APIRouter, Depends, Header, HTTPException, Request
from fastapi.responses import JSONResponse

from ..auth.deps import require_auth
from ..auth.nervesparks import (
    AUTH_BASE_URL,
    AuthError,
    AuthenticatedUserProfile,
    extract_auth_tokens_from_response,
    extract_bearer_token,
    verify_access_token,
)
from ..http_client import get_client

router = APIRouter()
_AUTH_API_BASE = f"{AUTH_BASE_URL}/api/v1/auth"


async def _proxy_auth(
    path: Literal["login", "register", "refresh", "logout"],
    body: Any,
    authorization: str | None,
) -> tuple[int, Any]:
    headers: dict[str, str] = {"Content-Type": "application/json"}
    if authorization:
        headers["Authorization"] = authorization

    client = get_client()
    response = await client.post(
        f"{_AUTH_API_BASE}/{path}", headers=headers, json=body or {}, timeout=30.0
    )

    text = response.text
    try:
        json_body: Any = response.json() if text else {}
    except Exception:
        json_body = {"error": text or response.reason_phrase}

    return response.status_code, json_body


async def _handle_proxy(path: Literal["login", "register", "refresh", "logout"], request: Request):
    try:
        body = await request.json()
    except Exception:
        body = {}

    try:
        status, json_body = await _proxy_auth(
            path, body, request.headers.get("authorization")
        )
        if status < 400 and path != "logout":
            tokens = extract_auth_tokens_from_response(json_body)
            if not tokens:
                return JSONResponse(
                    status_code=502,
                    content={"error": "Auth provider did not return an access token"},
                )
            _, profile = await verify_access_token(tokens["access_token"], get_client())
            return JSONResponse(
                status_code=status,
                content={**tokens, "user": profile.as_dict()},
            )
        return JSONResponse(status_code=status, content=json_body)
    except AuthError as e:
        return JSONResponse(status_code=e.status, content={"error": e.message})


@router.post("/login")
async def login(request: Request):
    return await _handle_proxy("login", request)


@router.post("/register")
async def register(request: Request):
    return await _handle_proxy("register", request)


@router.post("/refresh")
async def refresh(request: Request):
    return await _handle_proxy("refresh", request)


@router.post("/logout")
async def logout(request: Request):
    return await _handle_proxy("logout", request)


@router.get("/me")
async def get_me(user: AuthenticatedUserProfile = Depends(require_auth)):
    return {"user": user.as_dict()}


@router.post("/me")
async def post_me(authorization: str | None = Header(default=None)):
    token = extract_bearer_token(authorization)
    if not token:
        raise HTTPException(status_code=401, detail="Missing bearer token")
    try:
        _, profile = await verify_access_token(token, get_client())
        return {"user": profile.as_dict()}
    except AuthError as e:
        raise HTTPException(status_code=e.status, detail=e.message)
