"""
Service-to-Service Authentication Module
Handles JWT token verification for Python services in NovaCoreAI
"""

import os
import logging
from typing import Optional, Dict, Any
from datetime import datetime, timedelta
from fastapi import Header, HTTPException, status
import jwt

logger = logging.getLogger(__name__)

# Get service JWT secret from environment
SERVICE_JWT_SECRET = os.getenv("SERVICE_JWT_SECRET", "")

if not SERVICE_JWT_SECRET:
    logger.warning("SERVICE_JWT_SECRET not set. Service authentication will not work properly!")


class ServiceTokenPayload:
    """Represents a decoded service JWT token payload"""
    
    def __init__(self, service_name: str, token_type: str, issued_at: int, expires_at: int):
        self.service_name = service_name
        self.token_type = token_type
        self.issued_at = issued_at
        self.expires_at = expires_at
    
    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> 'ServiceTokenPayload':
        """Create ServiceTokenPayload from decoded JWT dict"""
        return cls(
            service_name=data.get('serviceName', ''),
            token_type=data.get('type', ''),
            issued_at=data.get('iat', 0),
            expires_at=data.get('exp', 0)
        )


def verify_service_token(token: str) -> ServiceTokenPayload:
    """
    Verify a service-to-service JWT token
    
    Args:
        token: JWT token string
        
    Returns:
        ServiceTokenPayload: Decoded token payload
        
    Raises:
        HTTPException: If token is invalid, expired, or missing
    """
    if not SERVICE_JWT_SECRET:
        logger.error("SERVICE_JWT_SECRET is not configured")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Service authentication is not properly configured"
        )
    
    try:
        decoded = jwt.decode(
            token,
            SERVICE_JWT_SECRET,
            algorithms=["HS256"]
        )
        
        # Verify token type
        if decoded.get('type') != 'service':
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Invalid service token type"
            )
        
        payload = ServiceTokenPayload.from_dict(decoded)
        
        logger.info(f"Service authenticated: {payload.service_name}")
        
        return payload
        
    except jwt.ExpiredSignatureError:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Service token has expired. Please renew your token."
        )
    except jwt.InvalidTokenError as e:
        logger.error(f"Invalid service token: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Invalid service token"
        )
    except Exception as e:
        logger.error(f"Service token verification failed: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Service token verification failed"
        )


def verify_service_token_dependency(
    x_service_token: Optional[str] = Header(None, alias="X-Service-Token")
) -> ServiceTokenPayload:
    """
    FastAPI dependency for service authentication
    
    Use this as a dependency in your FastAPI routes to enforce service authentication:
    
    Example:
        @router.get("/endpoint")
        async def my_endpoint(
            service: ServiceTokenPayload = Depends(verify_service_token_dependency)
        ):
            # Service is authenticated here
            print(f"Called by service: {service.service_name}")
    
    Args:
        x_service_token: Service token from X-Service-Token header
        
    Returns:
        ServiceTokenPayload: Decoded token payload
        
    Raises:
        HTTPException: If token is missing, invalid, or expired
    """
    if not x_service_token:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Service authentication token is required for service-to-service calls"
        )
    
    return verify_service_token(x_service_token)


def generate_service_token(service_name: str) -> str:
    """
    Generate a service-to-service JWT token
    
    Note: In production, services should request tokens from the auth service
    This function is primarily for testing and development
    
    Args:
        service_name: Name of the service
        
    Returns:
        str: JWT token
        
    Raises:
        ValueError: If SERVICE_JWT_SECRET is not configured
    """
    if not SERVICE_JWT_SECRET:
        raise ValueError("SERVICE_JWT_SECRET is not configured")
    
    payload = {
        'serviceName': service_name,
        'type': 'service',
        'iat': datetime.utcnow(),
        'exp': datetime.utcnow() + timedelta(hours=24)
    }
    
    return jwt.encode(payload, SERVICE_JWT_SECRET, algorithm='HS256')


# Create a global instance that can be imported
def get_service_auth_dependency():
    """
    Get the service auth dependency function
    Can be used with FastAPI Depends()
    """
    return verify_service_token_dependency
