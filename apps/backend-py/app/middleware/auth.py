import logging

from fastapi import Depends, HTTPException
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from app.auth.nervesparks import AuthError, UserProfile, verify_access_token

log = logging.getLogger("auth")
_bearer = HTTPBearer(auto_error=False)


async def require_auth(
    credentials: HTTPAuthorizationCredentials | None = Depends(_bearer),
) -> UserProfile:
    if not credentials:
        log.warning("require_auth: no bearer token in Authorization header")
        raise HTTPException(status_code=401, detail="Missing bearer token")
    try:
        _, profile = await verify_access_token(credentials.credentials)
        return profile
    except AuthError as exc:
        log.warning("require_auth: token verification failed: %s", exc)
        raise HTTPException(status_code=exc.status, detail=str(exc)) from exc
