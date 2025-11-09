"""Storage calculation utilities for memory usage tracking."""
import sys
import json
from typing import Any, Dict


class StorageCalculator:
    """Calculate storage size for memory objects."""
    
    @staticmethod
    def calculate_memory_size(
        input_context: str,
        output_response: str = None,
        tags: list = None,
        metadata: Dict[str, Any] = None,
        embedding_dimension: int = 384
    ) -> int:
        """
        Calculate approximate storage size in bytes for a memory object.
        
        Args:
            input_context: Input text
            output_response: Output text
            tags: List of tags
            metadata: Additional metadata
            embedding_dimension: Vector embedding dimension
            
        Returns:
            Storage size in bytes
        """
        size_bytes = 0
        
        # Text fields (UTF-8 encoding)
        if input_context:
            size_bytes += len(input_context.encode('utf-8'))
        
        if output_response:
            size_bytes += len(output_response.encode('utf-8'))
        
        # Tags array
        if tags:
            for tag in tags:
                size_bytes += len(str(tag).encode('utf-8'))
            size_bytes += len(tags) * 4  # Array overhead
        
        # Metadata JSONB
        if metadata:
            size_bytes += len(json.dumps(metadata).encode('utf-8'))
        
        # Vector embedding (float32 = 4 bytes per dimension)
        size_bytes += embedding_dimension * 4
        
        # Add overhead for:
        # - UUID fields (16 bytes each * 3) = 48 bytes
        # - Timestamps (8 bytes each * 3) = 24 bytes
        # - Float fields (8 bytes each * 2) = 16 bytes
        # - String fields (varchar overhead) = ~50 bytes
        # - Row overhead = ~24 bytes
        size_bytes += 162
        
        return size_bytes
    
    @staticmethod
    def bytes_to_human_readable(size_bytes: int) -> str:
        """
        Convert bytes to human-readable format.
        
        Args:
            size_bytes: Size in bytes
            
        Returns:
            Human-readable string (e.g., "1.5 MB")
        """
        if size_bytes < 1024:
            return f"{size_bytes} B"
        elif size_bytes < 1024 * 1024:
            return f"{size_bytes / 1024:.2f} KB"
        elif size_bytes < 1024 * 1024 * 1024:
            return f"{size_bytes / (1024 * 1024):.2f} MB"
        else:
            return f"{size_bytes / (1024 * 1024 * 1024):.2f} GB"
    
    @staticmethod
    def get_tier_storage_limit(tier: str) -> int:
        """
        Get storage limit in bytes for a subscription tier.
        
        Args:
            tier: Subscription tier (free_trial, basic, pro)
            
        Returns:
            Storage limit in bytes (-1 for unlimited)
        """
        limits = {
            "free_trial": 1 * 1024 * 1024 * 1024,  # 1 GB
            "basic": 10 * 1024 * 1024 * 1024,      # 10 GB
            "pro": -1                               # Unlimited
        }
        return limits.get(tier, limits["free_trial"])
    
    @staticmethod
    def check_quota_available(
        current_usage: int,
        additional_size: int,
        tier: str
    ) -> tuple[bool, str]:
        """
        Check if there's enough quota available.
        
        Args:
            current_usage: Current storage usage in bytes
            additional_size: Additional storage needed in bytes
            tier: Subscription tier
            
        Returns:
            Tuple of (has_quota, message)
        """
        limit = StorageCalculator.get_tier_storage_limit(tier)
        
        # Pro tier has unlimited storage
        if limit == -1:
            return True, "Unlimited storage available"
        
        new_total = current_usage + additional_size
        
        if new_total > limit:
            return False, (
                f"Storage quota exceeded. "
                f"Current: {StorageCalculator.bytes_to_human_readable(current_usage)}, "
                f"Requested: {StorageCalculator.bytes_to_human_readable(additional_size)}, "
                f"Limit: {StorageCalculator.bytes_to_human_readable(limit)}"
            )
        
        # Warning at 80%
        if new_total > limit * 0.8:
            percentage = (new_total / limit) * 100
            return True, f"Warning: {percentage:.1f}% of storage quota used"
        
        return True, "Storage quota available"


# Singleton instance
storage_calculator = StorageCalculator()
