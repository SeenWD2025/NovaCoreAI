"""Domain-specific exceptions for the Quiz Engine."""


class QuizArtifactNotFoundError(Exception):
    """Raised when a referenced quiz artifact cannot be located."""


class QuizOwnershipMismatchError(Exception):
    """Raised when the requester does not own the referenced quiz."""


class QuizSessionNotFoundError(Exception):
    """Raised when a quiz session is not found."""


class QuizSessionPersistenceError(Exception):
    """Raised when a session cannot be persisted to the backing store."""


class QuizSessionAlreadyCompletedError(Exception):
    """Raised when attempting to modify a session that has already been completed."""


class QuizSubmissionValidationError(Exception):
    """Raised when a quiz submission payload cannot be processed."""


class ReflectionFeedbackValidationError(Exception):
    """Raised when reflection feedback input fails validation checks."""


class ReflectionFeedbackPersistenceError(Exception):
    """Raised when reflection feedback cannot be persisted."""
