"""Service for managing quiz sessions."""
from __future__ import annotations

from datetime import datetime, timezone
from typing import Any, Dict, List, Optional
from uuid import uuid4

from ..models.quiz_artifact import ArtifactQuestion, QuizArtifact
from ..models.quiz_session import (
    QuizResultsResponse,
    QuizSessionCreateRequest,
    QuizSessionRecord,
    QuizSessionResponse,
    QuizSessionResults,
    QuizSessionStatus,
    QuizSessionView,
    QuizSubmissionRequest,
    QuestionResult,
    Recommendation,
    SessionQuestion,
    SessionQuestionOption,
    SessionQuestionType,
    SessionReflection,
)
from ..repositories.quiz_artifact_repository import QuizArtifactRepository
from ..repositories.quiz_session_repository import QuizSessionRepository
from .errors import (
    QuizArtifactNotFoundError,
    QuizOwnershipMismatchError,
    QuizSessionNotFoundError,
    QuizSessionPersistenceError,
    QuizSessionAlreadyCompletedError,
    QuizSubmissionValidationError,
)


_TYPE_MAPPING = {
    "multiple_choice": SessionQuestionType.MULTIPLE_CHOICE,
    "multiple-choice": SessionQuestionType.MULTIPLE_CHOICE,
    "true_false": SessionQuestionType.TRUE_FALSE,
    "true-false": SessionQuestionType.TRUE_FALSE,
    "short_answer": SessionQuestionType.SHORT_ANSWER,
    "short-answer": SessionQuestionType.SHORT_ANSWER,
    "fill_in_the_blank": SessionQuestionType.SHORT_ANSWER,
    "fill-in-the-blank": SessionQuestionType.SHORT_ANSWER,
    "written_response": SessionQuestionType.WRITTEN_RESPONSE,
    "written-response": SessionQuestionType.WRITTEN_RESPONSE,
}


class QuizSessionService:
    """Coordinate quiz session creation and retrieval."""

    def __init__(
        self,
        artifact_repository: QuizArtifactRepository,
        session_repository: QuizSessionRepository,
    ) -> None:
        self._artifact_repository = artifact_repository
        self._session_repository = session_repository

    async def create_session(self, request: QuizSessionCreateRequest) -> QuizSessionResponse:
        artifact = await self._artifact_repository.get_quiz(request.quiz_id)
        if artifact is None:
            raise QuizArtifactNotFoundError(f"Quiz {request.quiz_id} was not found")

        self._assert_ownership(artifact, request.app_id, request.user_id)

        now = datetime.now(timezone.utc)
        session_id = str(uuid4())
        session_metadata: Dict[str, Any] = {
            "artifact": artifact.metadata or {},
            "session": request.metadata or {},
        }

        record = QuizSessionRecord(
            sessionId=session_id,
            quizId=artifact.quiz_id,
            appId=request.app_id,
            userId=request.user_id,
            noteId=artifact.note_id,
            status=QuizSessionStatus.IN_PROGRESS,
            createdAt=now,
            updatedAt=now,
            isDeleted=False,
            deletedAt=None,
            metadata=session_metadata,
            quizSnapshot=artifact,
            answers=[],
            results=None,
        )

        try:
            await self._session_repository.create_session(record)
        except Exception as exc:  # pragma: no cover - surfaced as domain error
            raise QuizSessionPersistenceError("Failed to persist quiz session") from exc

        view = self._build_view(record)
        return QuizSessionResponse(session=view)

    async def get_session(self, session_id: str, *, app_id: str, user_id: str) -> QuizSessionResponse:
        record = await self._session_repository.get_session(session_id)
        if record is None:
            raise QuizSessionNotFoundError(f"Quiz session {session_id} was not found")

        self._assert_ownership(record.quiz_snapshot, app_id, user_id)
        view = self._build_view(record)
        return QuizSessionResponse(session=view)

    async def submit_session(
        self,
        session_id: str,
        submission: QuizSubmissionRequest,
    ) -> QuizResultsResponse:
        record = await self._session_repository.get_session(session_id)
        if record is None:
            raise QuizSessionNotFoundError(f"Quiz session {session_id} was not found")

        if submission.session_id and submission.session_id != session_id:
            raise QuizSubmissionValidationError("Submission sessionId does not match route parameter")

        if submission.quiz_id != record.quiz_id:
            raise QuizSubmissionValidationError("Submission quizId does not match session quiz")

        if submission.user_id != record.user_id:
            raise QuizOwnershipMismatchError("Submission user does not match session owner")

        self._assert_ownership(record.quiz_snapshot, submission.app_id, submission.user_id)

        if record.status not in {QuizSessionStatus.IN_PROGRESS, QuizSessionStatus.AWAITING_REVIEW}:
            raise QuizSessionAlreadyCompletedError("Quiz session has already been completed")

        submitted_at = submission.submitted_at or datetime.now(timezone.utc)

        answers = {answer.question_id: answer for answer in submission.answers}
        for question_id in answers:
            if question_id not in {q.question_id for q in record.quiz_snapshot.questions}:
                raise QuizSubmissionValidationError(f"Unknown questionId {question_id} in submission")

        results = self._grade_submission(record, submission, submitted_at=submitted_at)

        record.answers = [answer.model_dump(by_alias=True) for answer in submission.answers]
        record.results = results.results
        record.status = (
            QuizSessionStatus.AWAITING_REVIEW if results.results.requires_review else QuizSessionStatus.COMPLETED
        )
        record.updated_at = results.results.completed_at
        record.metadata = {
            **(record.metadata or {}),
            "lastSubmissionAt": results.results.submitted_at.isoformat(),
            "submissionMetadata": submission.metadata,
        }

        try:
            await self._session_repository.save_session(record)
        except Exception as exc:  # pragma: no cover - surfaced as domain error
            raise QuizSessionPersistenceError("Failed to persist quiz submission") from exc

        return results

    async def get_results(self, session_id: str, *, app_id: str, user_id: str) -> QuizResultsResponse:
        record = await self._session_repository.get_session(session_id)
        if record is None:
            raise QuizSessionNotFoundError(f"Quiz session {session_id} was not found")

        self._assert_ownership(record.quiz_snapshot, app_id, user_id)
        if record.results is None:
            raise QuizSubmissionValidationError("Results not available for this session")

        return QuizResultsResponse(results=record.results)

    def _build_view(self, record: QuizSessionRecord) -> QuizSessionView:
        questions = [self._to_session_question(question) for question in record.quiz_snapshot.questions]
        reflection = None
        if record.quiz_snapshot.reflection:
            reflection = SessionReflection(
                prompt=record.quiz_snapshot.reflection.prompt,
                guidance=record.quiz_snapshot.reflection.guidance,
            )

        return QuizSessionView(
            sessionId=record.session_id,
            quizId=record.quiz_id,
            appId=record.app_id,
            userId=record.user_id,
            noteId=record.note_id,
            status=record.status,
            createdAt=record.created_at,
            updatedAt=record.updated_at,
            questions=questions,
            reflection=reflection,
            metadata=record.metadata,
        )

    @staticmethod
    def _assert_ownership(artifact: QuizArtifact, app_id: str, user_id: str) -> None:
        if artifact.app_id and artifact.app_id != app_id:
            raise QuizOwnershipMismatchError("Quiz artifact belongs to a different app")
        if artifact.user_id and artifact.user_id != user_id:
            raise QuizOwnershipMismatchError("Quiz artifact belongs to a different user")

    def _to_session_question(self, question: ArtifactQuestion) -> SessionQuestion:
        qtype_key = (question.type or "").lower()
        mapped_type = _TYPE_MAPPING.get(qtype_key, SessionQuestionType.SHORT_ANSWER)
        options = self._build_options(question)

        metadata = question.metadata or {}
        tags = metadata.get("tags") if isinstance(metadata.get("tags"), list) else []
        difficulty = metadata.get("difficulty") or metadata.get("Difficulty")
        points = self._coerce_points(metadata)
        source_component_id = (
            metadata.get("sourceComponentId")
            or metadata.get("source_component_id")
            or metadata.get("componentId")
        )

        return SessionQuestion(
            questionId=question.question_id,
            prompt=question.prompt,
            type=mapped_type,
            options=options,
            difficulty=difficulty,
            tags=[str(tag) for tag in tags],
            sourceComponentId=source_component_id,
            points=points,
        )

    @staticmethod
    def _build_options(question: ArtifactQuestion) -> List[SessionQuestionOption] | None:
        if not question.options:
            return None

        options: List[SessionQuestionOption] = []
        for index, option in enumerate(question.options, start=1):
            option_id = option.label or f"{question.question_id}-opt-{index}"
            options.append(SessionQuestionOption(optionId=option_id, text=option.text))
        return options

    @staticmethod
    def _coerce_points(metadata: Dict[str, Any]) -> float | None:
        raw = metadata.get("points") or metadata.get("pointValue")
        if raw is None:
            return None
        try:
            return float(raw)
        except (TypeError, ValueError):  # pragma: no cover - defensive guard
            return None

    def _grade_submission(
        self,
        record: QuizSessionRecord,
        submission: QuizSubmissionRequest,
        *,
        submitted_at: datetime,
    ) -> QuizResultsResponse:
        questions = record.quiz_snapshot.questions
        answers_by_id = {answer.question_id: answer for answer in submission.answers}

        question_results: List[QuestionResult] = []
        recommendations: List[Recommendation] = []
        note_suggestions: List[Recommendation] = []

        total_score = 0.0
        max_score = 0.0
        requires_review = False
        pending_written = 0
        objective_correct = 0
        objective_questions = 0

        for index, question in enumerate(questions, start=1):
            max_points = self._coerce_points(question.metadata or {}) or 1.0
            max_score += max_points

            answer = answers_by_id.get(question.question_id)
            result = self._evaluate_question(
                record,
                question,
                answer,
                max_points=max_points,
                option_index=index,
            )

            total_score += result.score
            if not result.pending_review:
                objective_questions += 1
                if result.correct:
                    objective_correct += 1
            else:
                requires_review = True
                pending_written += 1

            question_results.append(result)

            if not result.correct and not result.pending_review:
                recommendations.append(
                    self._build_recommendation(
                        record=record,
                        question=question,
                        result=result,
                        submitted_at=submitted_at,
                        kind="study",
                    )
                )
                note_suggestions.append(
                    self._build_recommendation(
                        record=record,
                        question=question,
                        result=result,
                        submitted_at=submitted_at,
                        kind="note",
                    )
                )

        completed_at = datetime.now(timezone.utc)

        results_payload = QuizSessionResults(
            sessionId=record.session_id,
            quizId=record.quiz_id,
            userId=record.user_id,
            appId=record.app_id,
            noteId=record.note_id,
            totalScore=round(total_score, 4),
            maxScore=round(max_score, 4),
            questionResults=question_results,
            recommendations=recommendations,
            noteImprovementSuggestions=note_suggestions,
            completedAt=completed_at,
            submittedAt=submitted_at,
            requiresReview=requires_review,
            pendingWrittenCount=pending_written,
            metadata={
                "objective": {
                    "correct": objective_correct,
                    "total": objective_questions,
                },
                "submission": submission.metadata,
            },
        )

        return QuizResultsResponse(results=results_payload)

    def _evaluate_question(
        self,
        record: QuizSessionRecord,
        question: ArtifactQuestion,
        answer: Optional[Any],
        *,
        max_points: float,
        option_index: int,
    ) -> QuestionResult:
        mapped_type = self._map_question_type(question)
        metadata = question.metadata or {}
        source_component_id = (
            metadata.get("sourceComponentId")
            or metadata.get("source_component_id")
            or metadata.get("componentId")
        )

        feedback: Optional[str] = question.answer_explanation or metadata.get("feedback")
        submitted_value: Any = None
        correct = False
        pending_review = False
        score = 0.0

        if answer is None:
            feedback = feedback or "No answer provided."
        elif mapped_type is SessionQuestionType.MULTIPLE_CHOICE:
            if not hasattr(answer, "selected_option_ids"):
                raise QuizSubmissionValidationError("Multiple choice submission missing selectedOptionIds")
            submitted_value = list(answer.selected_option_ids)
            score, correct = self._grade_multiple_choice(question, submitted_value, max_points)
            if not correct and not feedback:
                feedback = "Review the explanation and correct options."
        elif mapped_type is SessionQuestionType.TRUE_FALSE:
            if not hasattr(answer, "answer"):
                raise QuizSubmissionValidationError("True/false submission missing answer value")
            submitted_value = bool(answer.answer)
            score, correct = self._grade_true_false(question, submitted_value, max_points)
            if not correct and not feedback:
                feedback = "Revisit the concept and confirm the true/false statement."
        elif mapped_type is SessionQuestionType.SHORT_ANSWER:
            if not hasattr(answer, "answer"):
                raise QuizSubmissionValidationError("Short answer submission missing answer value")
            submitted_value = answer.answer
            score, correct = self._grade_short_answer(question, submitted_value, max_points)
            if not correct and not feedback:
                feedback = "Compare your answer with the expected keywords."
        elif mapped_type is SessionQuestionType.WRITTEN_RESPONSE:
            if not hasattr(answer, "answer"):
                raise QuizSubmissionValidationError("Written response submission missing answer value")
            submitted_value = answer.answer
            pending_review = True
            feedback = feedback or "Written response queued for evaluation."
        else:  # pragma: no cover - defensive branch
            feedback = feedback or "Unsupported question type."

        return QuestionResult(
            questionId=question.question_id,
            score=round(score, 4),
            maxScore=round(max_points, 4),
            correct=correct,
            pendingReview=pending_review,
            feedback=feedback,
            submittedAnswer=submitted_value,
            sourceComponentId=source_component_id,
            metadata={
                "expectedAnswer": question.answer,
                "questionType": mapped_type.value,
            },
        )

    def _grade_multiple_choice(
        self,
        question: ArtifactQuestion,
        submitted_option_ids: List[str],
        max_points: float,
    ) -> tuple[float, bool]:
        expected_ids: set[str] = set()
        all_ids: set[str] = set()

        if not question.options:
            return 0.0, False

        for index, option in enumerate(question.options, start=1):
            option_id = self._resolve_option_id(question, option, index)
            all_ids.add(option_id)
            if option.is_correct:
                expected_ids.add(option_id)

        submitted_set = {value for value in submitted_option_ids}
        if not submitted_set.issubset(all_ids):
            raise QuizSubmissionValidationError("Submission contains unknown option identifiers")

        correct = submitted_set == expected_ids
        score = max_points if correct else 0.0
        return score, correct

    def _grade_true_false(
        self,
        question: ArtifactQuestion,
        submitted_answer: bool,
        max_points: float,
    ) -> tuple[float, bool]:
        expected_raw = question.answer
        if expected_raw is None:
            raise QuizSubmissionValidationError("True/false question missing expected answer")

        expected_bool = self._coerce_bool(expected_raw)
        correct = submitted_answer is expected_bool
        score = max_points if correct else 0.0
        return score, correct

    def _grade_short_answer(
        self,
        question: ArtifactQuestion,
        submitted_answer: str,
        max_points: float,
    ) -> tuple[float, bool]:
        expected_values: List[str] = []

        metadata = question.metadata or {}
        acceptable = metadata.get("acceptableAnswers") or metadata.get("acceptable_answers")
        if isinstance(acceptable, list):
            expected_values.extend(str(item) for item in acceptable)
        if question.answer:
            expected_values.append(str(question.answer))

        if not expected_values:
            raise QuizSubmissionValidationError("Short answer question missing acceptable answers")

        submitted_norm = self._normalize_text(submitted_answer)
        expected_norm = {self._normalize_text(value) for value in expected_values}

        correct = submitted_norm in expected_norm
        score = max_points if correct else 0.0
        return score, correct

    @staticmethod
    def _resolve_option_id(question: ArtifactQuestion, option: Any, index: int) -> str:
        return option.label or f"{question.question_id}-opt-{index}"

    @staticmethod
    def _coerce_bool(value: Any) -> bool:
        if isinstance(value, bool):
            return value
        if isinstance(value, (int, float)):
            return bool(value)
        if isinstance(value, str):
            lowered = value.strip().lower()
            if lowered in {"true", "t", "1", "yes"}:
                return True
            if lowered in {"false", "f", "0", "no"}:
                return False
        raise QuizSubmissionValidationError("Unable to coerce expected answer to boolean")

    @staticmethod
    def _normalize_text(value: str) -> str:
        return " ".join(value.strip().lower().split())

    def _map_question_type(self, question: ArtifactQuestion) -> SessionQuestionType:
        qtype_key = (question.type or "").lower()
        return _TYPE_MAPPING.get(qtype_key, SessionQuestionType.SHORT_ANSWER)

    def _build_recommendation(
        self,
        *,
        record: QuizSessionRecord,
        question: ArtifactQuestion,
        result: QuestionResult,
        submitted_at: datetime,
        kind: str,
    ) -> Recommendation:
        recommendation_id = str(uuid4())
        source_component_id = result.source_component_id

        if kind == "study":
            text = (
                "Review the related note component"
                if source_component_id
                else "Revisit this concept in your notes."
            )
            if source_component_id:
                text = f"Review component {source_component_id} to reinforce this concept."
        else:
            text = "Consider enhancing your notes with additional detail for this concept."
            if source_component_id:
                text = (
                    f"Add more depth to notes linked to component {source_component_id} "
                    "to clarify this topic."
                )

        return Recommendation(
            recommendationId=recommendation_id,
            sessionId=record.session_id,
            quizId=record.quiz_id,
            userId=record.user_id,
            appId=record.app_id,
            noteId=record.note_id,
            questionId=question.question_id,
            sourceComponentId=source_component_id,
            text=text,
            createdAt=submitted_at,
            isDeleted=False,
            deletedAt=None,
        )
