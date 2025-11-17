import { useEffect, useMemo } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  Loader2,
  CheckCircle2,
  XCircle,
  AlertCircle,
  ArrowRight,
  ArrowLeft,
  RotateCcw,
  BarChart3,
} from 'lucide-react';
import { useQuizStore } from '@/stores/useQuizStore';
import type { FormEvent } from 'react';
import type { QuizQuestionView, QuizQuestionType, QuizAnswerValue } from '@/types/quiz';

const hasAnswer = (type: QuizQuestionType, value: QuizAnswerValue | undefined): boolean => {
  if (typeof value === 'undefined' || value === null) {
    return false;
  }

  switch (type) {
    case 'MULTIPLE_CHOICE':
      return Array.isArray(value) && value.length > 0;
    case 'TRUE_FALSE':
      return typeof value === 'boolean';
    case 'SHORT_ANSWER':
    case 'WRITTEN_RESPONSE':
      return typeof value === 'string' && value.trim().length > 0;
    default:
      return false;
  }
};

const formatAnswer = (question: QuizQuestionView, value: QuizAnswerValue | undefined): string => {
  if (typeof value === 'undefined' || value === null) {
    return 'No answer provided';
  }

  if (Array.isArray(value)) {
    if (!question.options?.length) {
      return value.join(', ');
    }
    const byId = new Map(question.options.map((option) => [option.optionId, option.text]));
    return value.map((optionId) => byId.get(optionId) ?? optionId).join(', ');
  }

  if (typeof value === 'boolean') {
    return value ? 'True' : 'False';
  }

  return value;
};

function QuizLoading({ message }: { message: string }) {
  return (
    <div className="max-w-3xl mx-auto mt-16">
      <div className="card flex flex-col items-center space-y-4 py-16">
        <Loader2 className="h-10 w-10 animate-spin text-primary-600" />
        <p className="text-lg font-medium text-gray-700">{message}</p>
        <p className="text-sm text-gray-500">This usually takes just a few seconds.</p>
      </div>
    </div>
  );
}

function QuestionMeta({ question }: { question: QuizQuestionView }) {
  return (
    <div className="space-y-3">
      <h2 className="text-2xl font-semibold text-gray-900">{question.prompt}</h2>
      {(question.tags?.length ?? 0) > 0 && (
        <div className="flex flex-wrap gap-2">
          {question.tags?.map((tag) => (
            <span key={tag} className="badge-primary">
              {tag}
            </span>
          ))}
        </div>
      )}
      {question.sourceComponentId && (
        <p className="text-sm text-gray-500">
          Linked note component: <span className="font-medium">{question.sourceComponentId}</span>
        </p>
      )}
    </div>
  );
}

function MultipleChoiceInput({
  question,
  value,
  onChange,
}: {
  question: QuizQuestionView;
  value: string[];
  onChange: (next: string[]) => void;
}) {
  const toggle = (optionId: string) => {
    if (value.includes(optionId)) {
      onChange(value.filter((id) => id !== optionId));
    } else {
      onChange([...value, optionId]);
    }
  };

  return (
    <div className="space-y-3">
      {question.options?.map((option) => (
        <label
          key={option.optionId}
          className="flex items-start gap-3 p-3 border border-gray-200 rounded-lg hover:border-primary-400 cursor-pointer"
        >
          <input
            type="checkbox"
            className="mt-1 h-4 w-4 text-primary-600 focus:ring-primary-500"
            checked={value.includes(option.optionId)}
            onChange={() => toggle(option.optionId)}
          />
          <span className="text-gray-800">{option.text}</span>
        </label>
      )) || <p className="text-sm text-gray-500">This question has no predefined options.</p>}
    </div>
  );
}

function TrueFalseInput({
  value,
  onChange,
  questionId,
}: {
  value: boolean | null;
  onChange: (next: boolean) => void;
  questionId: string;
}) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
      {[true, false].map((choice) => (
        <label
          key={String(choice)}
          className={`flex items-center gap-3 p-4 border rounded-lg cursor-pointer transition-colors ${
            value === choice ? 'border-primary-500 bg-primary-50' : 'border-gray-200 hover:border-primary-400'
          }`}
        >
          <input
            type="radio"
            name={`true-false-${questionId}`}
            className="h-4 w-4 text-primary-600 focus:ring-primary-500"
            checked={value === choice}
            onChange={() => onChange(choice)}
          />
          <span className="text-gray-800 font-medium">{choice ? 'True' : 'False'}</span>
        </label>
      ))}
    </div>
  );
}

function OpenResponseInput({ value, onChange }: { value: string; onChange: (next: string) => void }) {
  return (
    <textarea
      className="input min-h-[160px] text-base"
      value={value}
      onChange={(event) => onChange(event.target.value)}
      placeholder="Type your answer in your own words..."
    />
  );
}

export default function QuizTaker() {
  const navigate = useNavigate();
  const { noteId } = useParams<{ noteId: string }>();
  const {
    session,
    status,
    isLoading,
    error,
    currentQuestionIndex,
    answers,
    results,
    generateQuiz,
    setAnswer,
    nextQuestion,
    previousQuestion,
    goToQuestion,
    submitQuiz,
    viewSummary,
    resetSession,
  } = useQuizStore();

  useEffect(() => {
    if (!noteId) {
      return;
    }

    if (!session || session.noteId !== noteId || status === 'IDLE') {
      generateQuiz(noteId).catch(() => {
        /* error surfaced via store */
      });
    }
  }, [noteId, session, status, generateQuiz]);

  const totalQuestions = session?.questions.length ?? 0;
  const currentQuestion: QuizQuestionView | undefined = session?.questions[currentQuestionIndex];
  const currentDraft = currentQuestion ? answers[currentQuestion.questionId] : undefined;
  const currentAnswerValue = currentDraft?.value ?? currentQuestion?.userAnswer ?? null;
  const isLastQuestion = totalQuestions > 0 && currentQuestionIndex === totalQuestions - 1;

  const gradingSummary = useMemo(() => {
    if (!results) {
      return null;
    }
    const percent = results.maxScore > 0 ? Math.round((results.totalScore / results.maxScore) * 100) : 0;
    return {
      totalScore: results.totalScore,
      maxScore: results.maxScore,
      percent,
      requiresReview: results.requiresReview,
      pendingWrittenCount: results.pendingWrittenCount,
    };
  }, [results]);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!currentQuestion) {
      return;
    }

    if (isLastQuestion) {
      try {
        await submitQuiz();
      } catch {
        /* errors already surfaced via store */
      }
    } else {
      nextQuestion();
    }
  };

  const handleRetake = async () => {
    if (!noteId) {
      resetSession();
      return;
    }
    resetSession();
    await generateQuiz(noteId).catch(() => undefined);
  };

  if (!noteId) {
    return (
      <div className="max-w-2xl mx-auto mt-16">
        <div className="card">
          <div className="flex items-start gap-3">
            <AlertCircle className="h-6 w-6 text-red-500" />
            <div>
              <h2 className="text-xl font-semibold text-gray-900">Note not specified</h2>
              <p className="text-gray-600 mt-2">Return to your dashboard and choose a note to start a quiz.</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (status === 'LOADING') {
    const message = session ? 'Grading your answers...' : 'Generating your personalized quiz...';
    return <QuizLoading message={message} />;
  }

  if (status === 'IDLE') {
    return <QuizLoading message="Preparing your quiz session..." />;
  }

  const renderActiveQuestion = () => {
    if (!currentQuestion) {
      return null;
    }

    const answerValue = currentAnswerValue;
    const submitDisabled = isLoading || !hasAnswer(currentQuestion.type, answerValue as QuizAnswerValue | undefined);

    return (
      <form onSubmit={handleSubmit} className="card space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-gray-500">
              Question {currentQuestionIndex + 1} of {totalQuestions}
            </p>
            <h1 className="text-xl font-semibold text-gray-900">Quiz Session</h1>
          </div>
        </div>

        <QuestionMeta question={currentQuestion} />

        <div className="space-y-4">
          {currentQuestion.type === 'MULTIPLE_CHOICE' && (
            <MultipleChoiceInput
              question={currentQuestion}
              value={Array.isArray(answerValue) ? answerValue : []}
              onChange={(next) => setAnswer(currentQuestion.questionId, currentQuestion.type, next)}
            />
          )}

          {currentQuestion.type === 'TRUE_FALSE' && (
            <TrueFalseInput
              value={typeof answerValue === 'boolean' ? answerValue : null}
              onChange={(next) => setAnswer(currentQuestion.questionId, currentQuestion.type, next)}
              questionId={currentQuestion.questionId}
            />
          )}

          {(currentQuestion.type === 'SHORT_ANSWER' || currentQuestion.type === 'WRITTEN_RESPONSE') && (
            <OpenResponseInput
              value={typeof answerValue === 'string' ? answerValue : ''}
              onChange={(next) => setAnswer(currentQuestion.questionId, currentQuestion.type, next)}
            />
          )}
        </div>

        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="flex gap-2">
            <button
              type="button"
              className="btn-outline"
              onClick={previousQuestion}
              disabled={currentQuestionIndex === 0}
            >
              <ArrowLeft className="h-4 w-4 mr-2 inline" /> Previous
            </button>
            <button
              type="button"
              className="btn-outline"
              onClick={handleRetake}
            >
              <RotateCcw className="h-4 w-4 mr-2 inline" /> Restart Quiz
            </button>
          </div>

          <button
            type="submit"
            className={`btn-primary flex items-center justify-center gap-2 ${submitDisabled ? 'opacity-60 cursor-not-allowed' : ''}`}
            disabled={submitDisabled}
          >
            {isLastQuestion ? 'Submit for Grading' : 'Next Question'}
            <ArrowRight className="h-4 w-4" />
          </button>
        </div>
      </form>
    );
  };

  const renderGradedQuestion = () => {
    if (!currentQuestion || !results) {
      return null;
    }

    const questionResult = results.questionResults.find((result) => result.questionId === currentQuestion.questionId);
    const isCorrect = questionResult?.correct ?? false;
    const pendingReview = questionResult?.pendingReview ?? false;
    const icon = pendingReview ? null : isCorrect ? (
      <CheckCircle2 className="h-6 w-6 text-green-500" />
    ) : (
      <XCircle className="h-6 w-6 text-red-500" />
    );

    return (
      <div className="card space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-gray-500">
              Review {currentQuestionIndex + 1} of {totalQuestions}
            </p>
            <h1 className="text-xl font-semibold text-gray-900">Graded Result</h1>
          </div>
          {icon}
        </div>

        <QuestionMeta question={currentQuestion} />

        <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
          <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">Your Answer</h3>
          <p className="mt-2 text-gray-900 text-lg">
            {formatAnswer(currentQuestion, currentAnswerValue as QuizAnswerValue | undefined)}
          </p>
        </div>

        {pendingReview ? (
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 flex items-start gap-3">
            <AlertCircle className="h-5 w-5 text-yellow-600 mt-1" />
            <div>
              <p className="font-medium text-yellow-700">Pending instructor review</p>
              <p className="text-sm text-yellow-700 mt-1">
                Written responses are awaiting deeper evaluation. You'll be notified once the review completes.
              </p>
            </div>
          </div>
        ) : (
          <div className={`rounded-lg p-4 border ${isCorrect ? 'border-green-200 bg-green-50' : 'border-rose-200 bg-rose-50'}`}>
            <p className="font-medium text-gray-900">{isCorrect ? 'Great job! You nailed it.' : 'Needs review'}</p>
            <p className="text-sm text-gray-700 mt-1">{questionResult?.feedback || 'Keep practicing this concept to improve retention.'}</p>
            {typeof questionResult?.score === 'number' && typeof questionResult?.maxScore === 'number' && (
              <p className="text-sm text-gray-500 mt-2">
                Score: {questionResult.score} / {questionResult.maxScore}
              </p>
            )}
          </div>
        )}

        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="flex gap-2">
            <button
              type="button"
              className="btn-outline"
              onClick={previousQuestion}
              disabled={currentQuestionIndex === 0}
            >
              <ArrowLeft className="h-4 w-4 mr-2 inline" /> Previous
            </button>
            <button
              type="button"
              className="btn-outline"
              onClick={() => goToQuestion(0)}
            >
              Jump to First
            </button>
          </div>

          <div className="flex gap-2">
            <button
              type="button"
              className="btn-secondary"
              onClick={viewSummary}
            >
              <BarChart3 className="h-4 w-4 mr-2 inline" /> View Summary
            </button>
            <button
              type="button"
              className="btn-primary"
              onClick={() => {
                if (currentQuestionIndex < totalQuestions - 1) {
                  nextQuestion();
                } else {
                  viewSummary();
                }
              }}
            >
              Next <ArrowRight className="h-4 w-4 ml-2 inline" />
            </button>
          </div>
        </div>
      </div>
    );
  };

  const renderSummary = () => {
    if (!results || !gradingSummary) {
      return null;
    }

    return (
      <div className="space-y-6">
        <div className="card space-y-4">
          <div className="flex items-center gap-3">
            <BarChart3 className="h-6 w-6 text-primary-600" />
            <div>
              <h2 className="text-2xl font-semibold text-gray-900">Quiz Results</h2>
              <p className="text-gray-600">Great work! Here's how you performed.</p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="bg-primary-50 border border-primary-200 rounded-lg p-4 text-center">
              <p className="text-sm text-primary-700">Score</p>
              <p className="text-2xl font-bold text-primary-900">
                {gradingSummary.totalScore} / {gradingSummary.maxScore}
              </p>
            </div>
            <div className="bg-secondary-50 border border-secondary-200 rounded-lg p-4 text-center">
              <p className="text-sm text-secondary-700">Percentage</p>
              <p className="text-2xl font-bold text-secondary-900">{gradingSummary.percent}%</p>
            </div>
            <div className="bg-gray-100 border border-gray-200 rounded-lg p-4 text-center">
              <p className="text-sm text-gray-600">Questions</p>
              <p className="text-2xl font-bold text-gray-900">{results.questionResults.length}</p>
            </div>
          </div>

          {gradingSummary.requiresReview && (
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 text-sm text-yellow-800">
              {gradingSummary.pendingWrittenCount > 0 ? (
                <p>
                  {gradingSummary.pendingWrittenCount} written response
                  {gradingSummary.pendingWrittenCount > 1 ? 's are' : ' is'} awaiting deeper evaluation. You'll receive an
                  update once they are reviewed.
                </p>
              ) : (
                <p>Some responses need a manual review. We'll notify you as soon as they're completed.</p>
              )}
            </div>
          )}
        </div>

        {session?.reflection && (
          <div className="card space-y-3">
            <h3 className="text-lg font-semibold text-gray-900">Reflection Prompt</h3>
            <p className="text-gray-700 whitespace-pre-wrap">{session.reflection.prompt}</p>
            {session.reflection.guidance && (
              <p className="text-sm text-gray-500">Guidance: {session.reflection.guidance}</p>
            )}
          </div>
        )}

        {results.recommendations.length > 0 && (
          <div className="card space-y-3">
            <h3 className="text-lg font-semibold text-gray-900">Study Recommendations</h3>
            <ul className="list-disc list-inside space-y-2 text-gray-700">
              {results.recommendations.map((recommendation) => (
                <li key={recommendation.recommendationId}>{recommendation.text}</li>
              ))}
            </ul>
          </div>
        )}

        {results.noteImprovementSuggestions.length > 0 && (
          <div className="card space-y-3">
            <h3 className="text-lg font-semibold text-gray-900">Improve Your Notes</h3>
            <ul className="list-disc list-inside space-y-2 text-gray-700">
              {results.noteImprovementSuggestions.map((suggestion) => (
                <li key={suggestion.recommendationId}>{suggestion.text}</li>
              ))}
            </ul>
          </div>
        )}

        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <button type="button" className="btn-outline" onClick={() => navigate('/dashboard')}>
            Back to Dashboard
          </button>
          <div className="flex gap-2">
            <button type="button" className="btn-outline" onClick={() => goToQuestion(0)}>
              Review Questions
            </button>
            <button type="button" className="btn-primary" onClick={handleRetake}>
              <RotateCcw className="h-4 w-4 mr-2 inline" /> Retake Quiz
            </button>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {error && (
        <div className="flex items-start gap-3 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
          <AlertCircle className="h-5 w-5 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      {status === 'ACTIVE' && renderActiveQuestion()}
      {status === 'GRADED' && renderGradedQuestion()}
      {status === 'FEEDBACK' && renderSummary()}
    </div>
  );
}
