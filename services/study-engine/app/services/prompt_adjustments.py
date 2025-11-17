"""Dynamic prompt adjustment state derived from learner feedback."""
from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Dict, Optional


@dataclass
class PromptAdjustmentSnapshot:
    guidance: Optional[str]
    reason: Optional[str]
    metadata: Dict[str, object]
    updated_at: Optional[datetime]


class PromptAdjustmentState:
    """Tracks adaptive guidance appended to generation prompts."""

    def __init__(self) -> None:
        self._guidance: Optional[str] = None
        self._reason: Optional[str] = None
        self._metadata: Dict[str, object] = {}
        self._updated_at: Optional[datetime] = None

    def apply(
        self,
        *,
        guidance: str,
        reason: Optional[str] = None,
        metadata: Optional[Dict[str, object]] = None,
    ) -> None:
        self._guidance = guidance.strip()
        self._reason = reason
        self._metadata = metadata or {}
        self._updated_at = datetime.now(timezone.utc)

    def clear(self) -> None:
        self._guidance = None
        self._reason = None
        self._metadata = {}
        self._updated_at = datetime.now(timezone.utc)

    def render_guidance(self) -> Optional[str]:
        return self._guidance

    def snapshot(self) -> PromptAdjustmentSnapshot:
        return PromptAdjustmentSnapshot(
            guidance=self._guidance,
            reason=self._reason,
            metadata=dict(self._metadata),
            updated_at=self._updated_at,
        )


_STATE = PromptAdjustmentState()


def get_prompt_adjustment_state() -> PromptAdjustmentState:
    return _STATE


def build_guidance_message(*, quiz_id: Optional[str], average: float, window_days: int) -> str:
    return (
        "Learner feedback indicates recommendation quality dipped to "
        f"{average:.2f} over the last {window_days} days"
        + (f" for quiz artifact {quiz_id}." if quiz_id else ".")
        + " Provide clearer rationales, concrete examples, and remediation tips in each generated question."
    )


__all__ = [
    "PromptAdjustmentState",
    "PromptAdjustmentSnapshot",
    "get_prompt_adjustment_state",
    "build_guidance_message",
]
