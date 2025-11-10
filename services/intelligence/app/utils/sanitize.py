"""
XSS Prevention and Input Sanitization Module
Provides utilities to sanitize user input and prevent XSS attacks
"""
import bleach
import logging
from typing import Optional

logger = logging.getLogger(__name__)

# No HTML tags allowed - strip all HTML
ALLOWED_TAGS = []
ALLOWED_ATTRIBUTES = {}


def sanitize_text(text: str) -> str:
    """
    Sanitize user input by stripping all HTML tags and attributes.
    This prevents XSS attacks by ensuring only plain text is processed.
    
    Args:
        text: Raw user input text
        
    Returns:
        Sanitized plain text with all HTML removed
    """
    if not text:
        return text
    
    # Strip all HTML tags and attributes
    sanitized = bleach.clean(
        text,
        tags=ALLOWED_TAGS,
        attributes=ALLOWED_ATTRIBUTES,
        strip=True  # Strip tags completely instead of escaping
    )
    
    # Additional cleanup - remove any remaining HTML entities
    sanitized = bleach.linkify(sanitized, parse_email=False)
    
    return sanitized


def sanitize_message(message: str, max_length: int = 10000) -> str:
    """
    Sanitize a chat message by:
    1. Stripping all HTML tags
    2. Enforcing maximum length
    3. Trimming whitespace
    
    Args:
        message: Raw message input
        max_length: Maximum allowed message length
        
    Returns:
        Sanitized message
        
    Raises:
        ValueError: If message exceeds maximum length after sanitization
    """
    if not message:
        return message
    
    # First sanitize HTML
    sanitized = sanitize_text(message)
    
    # Trim whitespace
    sanitized = sanitized.strip()
    
    # Check length after sanitization
    if len(sanitized) > max_length:
        logger.warning(f"Message exceeds maximum length: {len(sanitized)} > {max_length}")
        raise ValueError(f"Message too long. Maximum {max_length} characters allowed.")
    
    return sanitized


def sanitize_metadata(metadata: dict) -> dict:
    """
    Sanitize metadata dictionary by removing HTML from all string values.
    
    Args:
        metadata: Dictionary with potentially unsafe values
        
    Returns:
        Dictionary with sanitized string values
    """
    if not metadata:
        return metadata
    
    sanitized = {}
    for key, value in metadata.items():
        if isinstance(value, str):
            sanitized[key] = sanitize_text(value)
        elif isinstance(value, dict):
            sanitized[key] = sanitize_metadata(value)
        elif isinstance(value, list):
            sanitized[key] = [
                sanitize_text(item) if isinstance(item, str) else item
                for item in value
            ]
        else:
            sanitized[key] = value
    
    return sanitized
