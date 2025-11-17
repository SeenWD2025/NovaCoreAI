"""Domain-specific exceptions for the Quiz Engine."""


class QuizArtifactNotFoundError(Exception):
    """Raised when a referenced quiz artifact cannot be located."""


class QuizOwnershipMismatchError(Exception):
    """Raised when the requester does not own the referenced quiz."""


class QuizSessionNotFoundError(Exception):
    """Raised when a quiz session is not found."""


class QuizSessionPersistenceError(Exception):
    """Raised when a session cannot be persisted to the backing store."""
