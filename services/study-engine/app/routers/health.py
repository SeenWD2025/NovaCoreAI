"""Health endpoints for readiness and liveness probes."""
from fastapi import APIRouter

from ..config import settings

router = APIRouter(prefix="/health", tags=["health"])


@router.get("/readiness", summary="Readiness probe")
def readiness() -> dict[str, str]:
    return {"status": "ok", "service": settings.app_name}


@router.get("/liveness", summary="Liveness probe")
def liveness() -> dict[str, str]:
    return {"status": "alive"}
