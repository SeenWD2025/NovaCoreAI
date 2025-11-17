"""Quiz provider implementations."""

from .intelligence_provider import IntelligenceProvider
from .local_baseline import LocalBaselineProvider

__all__ = ["IntelligenceProvider", "LocalBaselineProvider"]
