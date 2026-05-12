"""Unified FastAPI backend entrypoint."""

from __future__ import annotations

from contextlib import asynccontextmanager
from typing import AsyncIterator

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .auth import nervesparks
from .db.pool import close_pool, get_pool, init_pool
from .http_client import close_client, get_client, init_client
from .logger import create_logger
from .routes import assistant, auth, customers, dashboards, execute, resources

log = create_logger("main")


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncIterator[None]:
    await init_pool()
    await init_client()
    try:
        await nervesparks._fetch_jwks(get_client())
    except Exception as exc:
        log.warning(f"JWKS warmup failed: {exc}")
    try:
        yield
    finally:
        await close_client()
        await close_pool()


app = FastAPI(title="BTB Backend", version="0.2.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
async def health() -> dict[str, str]:
    pool = get_pool()
    await pool.fetchval("SELECT 1")
    return {"status": "ok", "db": "connected"}


for api_prefix in ("/api/v1", "/api"):
    app.include_router(auth.router, prefix=f"{api_prefix}/auth", tags=["auth"])
    app.include_router(
        dashboards.router, prefix=f"{api_prefix}/dashboards", tags=["dashboards"]
    )
    app.include_router(resources.router, prefix=f"{api_prefix}/resources", tags=["resources"])
    app.include_router(customers.router, prefix=f"{api_prefix}/customers", tags=["customers"])
    app.include_router(execute.router, prefix=f"{api_prefix}/execute", tags=["execute"])
    app.include_router(assistant.router, prefix=f"{api_prefix}/assistant", tags=["assistant"])
