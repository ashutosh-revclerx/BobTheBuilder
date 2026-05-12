from fastapi import APIRouter, Depends
from app.db.client import get_pool
import asyncpg

router = APIRouter()


@router.get("/healthz")
async def healthz(pool: asyncpg.Pool = Depends(get_pool)):
    try:
        await pool.fetchval("SELECT 1")
        return {"status": "ok"}
    except Exception as exc:
        return {"status": "error", "detail": str(exc)}
