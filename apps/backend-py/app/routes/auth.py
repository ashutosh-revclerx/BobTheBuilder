from fastapi import APIRouter, Depends, HTTPException, Request

from app.auth.nervesparks import (
    AuthError,
    UserProfile,
    extract_auth_tokens_from_response,
    extract_bearer_token,
    verify_access_token,
)
from app.middleware.auth import require_auth
import httpx

router = APIRouter()

AUTH_BASE_URL = "https://auth.nervesparks.com"
AUTH_API_BASE = f"{AUTH_BASE_URL}/api/v1/auth"


async def _proxy_auth_request(
    path: str,
    body: dict,
    authorization: str | None = None,
) -> tuple[int, dict]:
    headers: dict[str, str] = {"Content-Type": "application/json"}
    if authorization:
        headers["Authorization"] = authorization

    async with httpx.AsyncClient(timeout=30) as client:
        resp = await client.post(f"{AUTH_API_BASE}/{path}", headers=headers, json=body)

    try:
        json_body: dict = resp.json()
    except Exception:
        json_body = {"error": resp.text or resp.reason_phrase}

    return resp.status_code, json_body


async def _handle_auth(path: str, request: Request) -> dict:
    try:
        body = await request.json()
    except Exception:
        body = {}

    authorization = request.headers.get("authorization")
    status, json_body = await _proxy_auth_request(path, body, authorization)

    if status < 400 and path != "logout":
        tokens = extract_auth_tokens_from_response(json_body)
        if not tokens:
            raise HTTPException(status_code=502, detail="Auth provider did not return an access token")
        try:
            _, profile = await verify_access_token(tokens["access_token"])
        except AuthError as exc:
            raise HTTPException(status_code=exc.status, detail=str(exc))

        return {
            **tokens,
            "user": {
                "uid": profile.uid,
                "id": profile.id,
                "email": profile.email,
                "full_name": profile.full_name,
                "tenant_id": profile.tenant_id,
                "role": profile.role,
            },
        }

    if status >= 400:
        raise HTTPException(status_code=status, detail=json_body)
    return json_body


@router.post("/login")
async def login(request: Request):
    return await _handle_auth("login", request)


@router.post("/register")
async def register(request: Request):
    return await _handle_auth("register", request)


@router.post("/refresh")
async def refresh(request: Request):
    return await _handle_auth("refresh", request)


@router.post("/logout")
async def logout(request: Request):
    return await _handle_auth("logout", request)


@router.get("/me")
async def get_me(profile: UserProfile = Depends(require_auth)):
    return {
        "user": {
            "uid": profile.uid,
            "id": profile.id,
            "email": profile.email,
            "full_name": profile.full_name,
            "tenant_id": profile.tenant_id,
            "role": profile.role,
        }
    }


@router.post("/me")
async def post_me(request: Request):
    authorization = request.headers.get("authorization")
    token = extract_bearer_token(authorization)
    if not token:
        raise HTTPException(status_code=401, detail="Missing bearer token")
    try:
        _, profile = await verify_access_token(token)
    except AuthError as exc:
        raise HTTPException(status_code=exc.status, detail=str(exc))
    return {
        "user": {
            "uid": profile.uid,
            "id": profile.id,
            "email": profile.email,
            "full_name": profile.full_name,
            "tenant_id": profile.tenant_id,
            "role": profile.role,
        }
    }
