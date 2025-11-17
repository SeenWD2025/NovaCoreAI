"""Health endpoints for readiness and liveness probes."""
from fastapi import APIRouter, HTTPException, status

from ..config import settings
from ..database import healthcheck

router = APIRouter(prefix="/health", tags=["health"])


@router.get("/readiness", summary="Readiness probe")
def readiness() -> dict[str, str]:
    if not healthcheck():
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail={"service": settings.app_name, "message": "database unavailable"},
        )
    return {"status": "ok", "service": settings.app_name}


@router.get("/liveness", summary="Liveness probe")
def liveness() -> dict[str, str]:
    return {"status": "alive"}
