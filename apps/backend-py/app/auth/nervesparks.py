"""
RS256 JWT verification against NerveSparks JWKS endpoint.
Uses PyJWT for reliable JWK handling. Mirrors the logic in
apps/backend/src/auth/nervesparks.ts.
"""
import logging
import time
from dataclasses import dataclass
from typing import Any

import httpx
import jwt
from jwt import PyJWKClient, algorithms
from jwt.exceptions import PyJWTError

log = logging.getLogger("auth")

AUTH_BASE_URL = "https://auth.nervesparks.com"
JWKS_URL = f"{AUTH_BASE_URL}/api/v1/auth/.well-known/jwks.json"
ALGORITHM = "RS256"
ISSUER = "auth-gateway"
ACCESS_AUDIENCE = "auth-gateway-access"
ACCESS_TOKEN_TYPE = "access"
JWKS_CACHE_TTL_S = 6 * 60 * 60  # 6 hours


class AuthError(Exception):
    def __init__(self, message: str = "Unauthorized", status: int = 401) -> None:
        super().__init__(message)
        self.status = status


@dataclass
class UserProfile:
    uid: str
    id: str
    email: str
    full_name: str
    tenant_id: str | None = None
    role: str | None = None


_cached_keys: dict[str, Any] | None = None  # kid → RSAPublicKey
_cached_at: float = 0.0


async def _fetch_jwks(force: bool = False) -> dict[str, Any]:
    """Fetch JWKS and return a dict mapping kid → constructed public key."""
    global _cached_keys, _cached_at

    if not force and _cached_keys and (time.time() - _cached_at) < JWKS_CACHE_TTL_S:
        return _cached_keys

    async with httpx.AsyncClient(timeout=10) as client:
        resp = await client.get(JWKS_URL)
    if resp.status_code != 200:
        raise AuthError("Could not load auth keys")

    body: dict = resp.json()
    keys: list[dict] = (
        body.get("data", {}).get("keys")
        or body.get("keys")
        or []
    )
    if not keys:
        raise AuthError("No auth keys available")

    # Construct each public key from its JWK representation
    import json as _json
    constructed: dict[str, Any] = {}
    for jwk_dict in keys:
        kid = jwk_dict.get("kid")
        if not kid:
            continue
        try:
            public_key = algorithms.RSAAlgorithm.from_jwk(_json.dumps(jwk_dict))
            constructed[kid] = public_key
        except Exception as exc:
            log.warning("Failed to construct key for kid=%s: %s", kid, exc)

    if not constructed:
        raise AuthError("No usable auth keys")

    _cached_keys = constructed
    _cached_at = time.time()
    return constructed


async def _get_key_for_kid(kid: str) -> Any:
    keys = await _fetch_jwks(force=False)
    if kid in keys:
        return keys[kid]
    keys = await _fetch_jwks(force=True)
    if kid in keys:
        return keys[kid]
    raise AuthError("Unknown token key")


async def verify_access_token(token: str) -> tuple[dict, UserProfile]:
    try:
        header = jwt.get_unverified_header(token)
    except PyJWTError as exc:
        log.warning("Invalid token header: %s", exc)
        raise AuthError("Invalid token") from exc

    alg = header.get("alg")
    kid = header.get("kid")

    if alg != ALGORITHM or not kid:
        raise AuthError("Invalid token header")

    public_key = await _get_key_for_kid(kid)

    try:
        payload: dict = jwt.decode(
            token,
            public_key,
            algorithms=[ALGORITHM],
            audience=ACCESS_AUDIENCE,
            issuer=ISSUER,
            options={"verify_exp": True, "require": ["exp", "iss", "aud", "sub"]},
        )
    except jwt.ExpiredSignatureError as exc:
        raise AuthError("Token expired") from exc
    except jwt.InvalidAudienceError as exc:
        raise AuthError("Invalid token audience") from exc
    except jwt.InvalidIssuerError as exc:
        raise AuthError("Invalid token issuer") from exc
    except PyJWTError as exc:
        log.warning("JWT verification failed: %s", exc)
        raise AuthError(f"Invalid token: {exc}") from exc

    if payload.get("type") != ACCESS_TOKEN_TYPE:
        raise AuthError("Invalid token type")

    sub: str | None = payload.get("sub")
    email: str | None = payload.get("email")
    if not sub or not email:
        raise AuthError("Invalid token claims")

    display_name: str | None = payload.get("display_name")
    profile = UserProfile(
        uid=sub,
        id=sub,
        email=email,
        full_name=display_name or email.split("@")[0],
        tenant_id=payload.get("tenant_id"),
        role=payload.get("role"),
    )
    return payload, profile


def extract_bearer_token(authorization: str | None) -> str | None:
    if not authorization:
        return None
    parts = authorization.split(" ", 1)
    if len(parts) == 2 and parts[0].lower() == "bearer":
        return parts[1]
    return None


def extract_auth_tokens_from_response(body: Any) -> dict | None:
    if not isinstance(body, dict):
        return None

    candidates = [body]
    data = body.get("data")
    if isinstance(data, dict):
        candidates.append(data)

    for candidate in candidates:
        access_token = (
            candidate.get("access_token")
            or candidate.get("accessToken")
            or candidate.get("token")
        )
        if isinstance(access_token, str) and access_token:
            refresh_token = candidate.get("refresh_token") or candidate.get("refreshToken")
            token_type = candidate.get("token_type") or candidate.get("tokenType") or "bearer"
            result = {"access_token": access_token, "token_type": token_type}
            if isinstance(refresh_token, str):
                result["refresh_token"] = refresh_token
            return result

    return None
