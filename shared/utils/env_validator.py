"""
Centralized environment variable validation utility for Python services.
Import and call validate_required_env_vars() at service startup.
"""
import os
import sys
from typing import List, Optional


def validate_required_env_vars(
    required_vars: List[str],
    service_name: Optional[str] = None
) -> None:
    """
    Validate that all required environment variables are set.
    Exits with code 1 if any are missing.
    
    Args:
        required_vars: List of required environment variable names
        service_name: Optional service name for error messages
    """
    missing = [var for var in required_vars if not os.getenv(var)]
    
    if missing:
        service_prefix = f"[{service_name}] " if service_name else ""
        print(f"FATAL: {service_prefix}Missing required environment variables:", file=sys.stderr)
        for var in missing:
            print(f"  - {var}", file=sys.stderr)
        print("\nPlease set these variables in your .env file or environment.", file=sys.stderr)
        sys.exit(1)


def get_env_or_exit(var_name: str, service_name: Optional[str] = None) -> str:
    """
    Get environment variable or exit if not set.
    
    Args:
        var_name: Environment variable name
        service_name: Optional service name for error messages
        
    Returns:
        Environment variable value
    """
    value = os.getenv(var_name)
    if not value:
        service_prefix = f"[{service_name}] " if service_name else ""
        print(f"FATAL: {service_prefix}Missing required environment variable: {var_name}", file=sys.stderr)
        sys.exit(1)
    return value
