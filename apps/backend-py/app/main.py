import logging

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.config import settings
from app.db.client import close_pool, get_pool
from app.db.migrate import run_migrations
from app.routes import assistant, auth, customers, dashboards, execute, health, resources

logging.basicConfig(
    level=getattr(logging, settings.log_level.upper(), logging.INFO),
    format="%(asctime)s %(levelname)s [%(name)s] %(message)s",
)

app = FastAPI(title="BTB Backend", version="2.0.0", redirect_slashes=False)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
async def startup() -> None:
    pool = await get_pool()
    await run_migrations(pool)


@app.on_event("shutdown")
async def shutdown() -> None:
    await close_pool()


@app.exception_handler(Exception)
async def unhandled_exception_handler(request, exc: Exception):
    logging.getLogger("server").error("Unhandled exception: %s", exc, exc_info=True)
    return JSONResponse(status_code=500, content={"error": "Internal server error"})


# ─── Route registration ────────────────────────────────────────────────────────

app.include_router(health.router)
app.include_router(auth.router,       prefix="/api/auth",      tags=["auth"])
app.include_router(dashboards.router, prefix="/api/dashboards", tags=["dashboards"])
app.include_router(resources.router,  prefix="/api/resources",  tags=["resources"])
app.include_router(customers.router,  prefix="/api/customers",  tags=["customers"])
app.include_router(execute.router,    prefix="/api/execute",    tags=["execute"])
app.include_router(assistant.router,  prefix="/api/assistant",  tags=["assistant"])

# Legacy /api/v1 alias — same routers mounted at the v1 prefix for compatibility
app.include_router(auth.router,       prefix="/api/v1/auth",      tags=["auth-v1"])
app.include_router(dashboards.router, prefix="/api/v1/dashboards", tags=["dashboards-v1"])
app.include_router(resources.router,  prefix="/api/v1/resources",  tags=["resources-v1"])
app.include_router(customers.router,  prefix="/api/v1/customers",  tags=["customers-v1"])
app.include_router(execute.router,    prefix="/api/v1/execute",    tags=["execute-v1"])
app.include_router(assistant.router,  prefix="/api/v1/assistant",  tags=["assistant-v1"])
