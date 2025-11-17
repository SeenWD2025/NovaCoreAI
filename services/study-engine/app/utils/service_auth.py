"""Utility helpers for Study Engine service-to-service authentication."""
from __future__ import annotations

import os
from datetime import datetime, timedelta
from typing import Optional

import jwt


def generate_service_token(service_name: str, ttl_hours: int = 24) -> Optional[str]:
    """Create a signed service token if the shared secret is configured."""
    secret = os.getenv("SERVICE_JWT_SECRET")
    if not secret:
        return None

    now = datetime.utcnow()
    payload = {
        "serviceName": service_name,
        "type": "service",
        "iat": now,
        "exp": now + timedelta(hours=ttl_hours),
    }
    try:
        return jwt.encode(payload, secret, algorithm="HS256")
    except Exception:
        return None


__all__ = ["generate_service_token"]
