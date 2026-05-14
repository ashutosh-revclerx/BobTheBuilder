"""NerveSparks JWT verification — port of `src/auth/nervesparks.ts`.

Verifies RS256 JWTs issued by https://auth.nervesparks.com using JWKS fetched
on first use and cached in-memory for 6 hours. The cache and TTL behaviour
matches the Node implementation 1:1 so behaviour does not change at cutover.
"""

from __future__ import annotations

import base64
import json
import time
from dataclasses import dataclass
from typing import Any

import httpx
import jwt
from jwt.algorithms import RSAAlgorithm

from ..config import settings

AUTH_BASE_URL = settings.auth_base_url
JWKS_URL = f"{AUTH_BASE_URL}/api/v1/auth/.well-known/jwks.json"
ALGORITHM = "RS256"
ISSUER = "auth-gateway"
ACCESS_AUDIENCE = "auth-gateway-access"
REFRESH_AUDIENCE = "auth-gateway-refresh"
ACCESS_TOKEN_TYPE = "access"
REFRESH_TOKEN_TYPE = "refresh"

_JWKS_CACHE_TTL_S = 6 * 60 * 60  # 6 hours


class AuthError(Exception):
    """Raised on any auth failure. status defaults to 401."""

    status: int = 401

    def __init__(self, message: str = "Unauthorized") -> None:
        super().__init__(message)
        self.message = message


@dataclass
class AuthenticatedUserProfile:
    uid: str
    id: str
    email: str
    full_name: str
    tenant_id: str | None = None
    role: str | None = None

    def as_dict(self) -> dict[str, Any]:
        d = {
            "uid": self.uid,
            "id": self.id,
            "email": self.email,
            "full_name": self.full_name,
        }
        if self.tenant_id is not None:
            d["tenant_id"] = self.tenant_id
        if self.role is not None:
            d["role"] = self.role
        return d


# ─── JWKS cache ──────────────────────────────────────────────────────────────

_cached_keys: list[dict[str, Any]] | None = None
_cached_at: float = 0.0


async def _fetch_jwks(client: httpx.AsyncClient, force: bool = False) -> list[dict[str, Any]]:
    global _cached_keys, _cached_at
    fresh_enough = _cached_keys and (time.time() - _cached_at) < _JWKS_CACHE_TTL_S
    if not force and fresh_enough:
        return _cached_keys  # type: ignore[return-value]

    try:
        resp = await client.get(JWKS_URL, timeout=10.0)
    except httpx.HTTPError as e:
        raise AuthError("Could not load auth keys") from e
    if resp.status_code >= 400:
        raise AuthError("Could not load auth keys")

    try:
        body = resp.json()
    except Exception as e:
        raise AuthError("Could not load auth keys") from e

    keys = (body.get("data") or {}).get("keys") if isinstance(body, dict) else None
    if not keys and isinstance(body, dict):
        keys = body.get("keys")
    if not isinstance(keys, list) or len(keys) == 0:
        raise AuthError("No auth keys available")

    _cached_keys = keys
    _cached_at = time.time()
    return keys


async def _get_key_for_kid(client: httpx.AsyncClient, kid: str) -> dict[str, Any]:
    keys = await _fetch_jwks(client, force=False)
    for k in keys:
        if k.get("kid") == kid:
            return k
    # Cache miss — refresh once
    keys = await _fetch_jwks(client, force=True)
    for k in keys:
        if k.get("kid") == kid:
            return k
    raise AuthError("Unknown token key")


# ─── Decoding helpers ────────────────────────────────────────────────────────


def _b64url_decode(s: str) -> bytes:
    pad = "=" * (-len(s) % 4)
    return base64.urlsafe_b64decode(s + pad)


def _decode_header(token: str) -> dict[str, Any]:
    parts = token.split(".")
    if len(parts) != 3 or not all(parts):
        raise AuthError("Invalid token")
    try:
        return json.loads(_b64url_decode(parts[0]))
    except Exception as e:
        raise AuthError("Invalid token") from e


def _audience_matches(claim_aud: Any, expected: str) -> bool:
    if isinstance(claim_aud, list):
        return expected in claim_aud
    return claim_aud == expected


# ─── Public API ──────────────────────────────────────────────────────────────


async def verify_access_token(
    token: str, client: httpx.AsyncClient
) -> tuple[dict[str, Any], AuthenticatedUserProfile]:
    """Verify an RS256 JWT. Returns (payload, profile). Raises AuthError on any
    invalid token (status=401)."""
    header = _decode_header(token)
    if header.get("alg") != ALGORITHM or not header.get("kid"):
        raise AuthError("Invalid token header")

    jwk = await _get_key_for_kid(client, header["kid"])
    if jwk.get("kty") != "RSA" or (jwk.get("alg") and jwk["alg"] != ALGORITHM):
        raise AuthError("Unsupported auth key")

    public_key = RSAAlgorithm.from_jwk(json.dumps(jwk))

    try:
        payload = jwt.decode(
            token,
            public_key,
            algorithms=[ALGORITHM],
            audience=ACCESS_AUDIENCE,
            issuer=ISSUER,
            # We do our own type+claim checks below to match Node messages exactly.
            options={"verify_aud": True, "verify_iss": True, "verify_exp": True},
        )
    except jwt.ExpiredSignatureError as e:
        raise AuthError("Token expired") from e
    except jwt.InvalidAudienceError as e:
        raise AuthError("Invalid token audience") from e
    except jwt.InvalidIssuerError as e:
        raise AuthError("Invalid token issuer") from e
    except jwt.InvalidSignatureError as e:
        raise AuthError("Invalid token signature") from e
    except jwt.InvalidTokenError as e:
        raise AuthError("Invalid token") from e

    if payload.get("type") != ACCESS_TOKEN_TYPE:
        raise AuthError("Invalid token type")
    sub = payload.get("sub")
    email = payload.get("email")
    if not sub or not email:
        raise AuthError("Invalid token claims")

    profile = AuthenticatedUserProfile(
        uid=sub,
        id=sub,
        email=email,
        full_name=payload.get("display_name") or str(email).split("@")[0],
        tenant_id=payload.get("tenant_id"),
        role=payload.get("role"),
    )
    return payload, profile


def extract_bearer_token(value: str | None) -> str | None:
    if not value:
        return None
    parts = value.split(None, 1)
    if len(parts) == 2 and parts[0].lower() == "bearer":
        return parts[1].strip() or None
    return None


def extract_auth_tokens_from_response(body: Any) -> dict[str, Any] | None:
    """Tolerant extraction matching the Node helper — looks at body and body.data."""
    if not isinstance(body, dict):
        return None
    candidates: list[dict[str, Any]] = [body]
    if isinstance(body.get("data"), dict):
        candidates.append(body["data"])

    for cand in candidates:
        access = (
            cand.get("access_token")
            or cand.get("accessToken")
            or cand.get("token")
        )
        if isinstance(access, str) and access:
            refresh = cand.get("refresh_token") or cand.get("refreshToken")
            token_type = cand.get("token_type") or cand.get("tokenType") or "bearer"
            result: dict[str, Any] = {"access_token": access, "token_type": token_type}
            if isinstance(refresh, str):
                result["refresh_token"] = refresh
            return result
    return None


def extract_token_from_auth_response(body: Any) -> str | None:
    tokens = extract_auth_tokens_from_response(body)
    return tokens["access_token"] if tokens else None
