import { create } from 'zustand';
import axios from 'axios';
import { APP_ID, DEFAULT_QUIZ_QUESTION_COUNT } from '@/config/appConfig';
import quizService from '@/services/quiz';
import { useAuthStore } from '@/stores/authStore';
import type {
  QuizDraftAnswer,
  QuizQuestionResult,
  QuizQuestionType,
  QuizQuestionView,
  QuizResults,
  QuizSession,
  QuizSessionApi,
  QuizStatus,
  QuizSubmissionAnswer,
  QuizAnswerValue,
} from '@/types/quiz';
import { showError } from '@/utils/toast';
import { recordQuizSubmissionTelemetry } from '@/utils/telemetry';

interface QuizState {
  session: QuizSession | null;
  status: QuizStatus;
  isLoading: boolean;
  error: string | null;
  currentQuestionIndex: number;
  answers: Record<string, QuizDraftAnswer>;
  results: QuizResults | null;
  questionResultsById: Record<string, QuizQuestionResult>;
  activeNoteId: string | null;
  generateQuiz: (noteId: string, options?: { questionCount?: number }) => Promise<void>;
  setAnswer: (questionId: string, type: QuizQuestionType, value: QuizAnswerValue) => void;
  nextQuestion: () => void;
  previousQuestion: () => void;
  goToQuestion: (index: number) => void;
  submitQuiz: () => Promise<void>;
  viewSummary: () => void;
  resetSession: () => void;
  clearError: () => void;
}

const hasAnswer = (draft?: QuizDraftAnswer): boolean => {
  if (!draft) {
    return false;
  }

  switch (draft.type) {
    case 'MULTIPLE_CHOICE':
      return Array.isArray(draft.value) && draft.value.length > 0;
    case 'TRUE_FALSE':
      return typeof draft.value === 'boolean';
    case 'SHORT_ANSWER':
    case 'WRITTEN_RESPONSE':
      return typeof draft.value === 'string' && draft.value.trim().length > 0;
    default:
      return false;
  }
};

const mapQuestion = (question: QuizSessionApi['questions'][number]): QuizQuestionView => ({
  questionId: question.questionId,
  prompt: question.prompt,
  type: question.type,
  options: question.options ?? undefined,
  difficulty: question.difficulty ?? null,
  tags: Array.isArray(question.tags) ? question.tags : [],
  sourceComponentId: question.sourceComponentId ?? null,
  points: typeof question.points === 'number' ? question.points : null,
  userAnswer: null,
  isCorrect: null,
  feedback: null,
  pendingReview: false,
  score: null,
  maxScore: null,
});

const mapSession = (session: QuizSessionApi): QuizSession => ({
  sessionId: session.sessionId,
  quizId: session.quizId,
  appId: session.appId,
  userId: session.userId,
  noteId: session.noteId ?? null,
  status: session.status,
  createdAt: session.createdAt,
  updatedAt: session.updatedAt,
  questions: session.questions.map(mapQuestion),
  reflection: session.reflection ?? undefined,
  metadata: session.metadata,
});

const createDefaultState = () => ({
  session: null as QuizSession | null,
  status: 'IDLE' as QuizStatus,
  isLoading: false,
  error: null as string | null,
  currentQuestionIndex: 0,
  answers: {} as Record<string, QuizDraftAnswer>,
  results: null as QuizResults | null,
  questionResultsById: {} as Record<string, QuizQuestionResult>,
  activeNoteId: null as string | null,
});

export const useQuizStore = create<QuizState>((set, get) => ({
  ...createDefaultState(),

  async generateQuiz(noteId, options) {
    const user = useAuthStore.getState().user;
    if (!user) {
      const message = 'You need to be signed in to start a quiz.';
      showError(message);
      throw new Error(message);
    }

    const questionCount = options?.questionCount ?? DEFAULT_QUIZ_QUESTION_COUNT;

    set({
      ...createDefaultState(),
      status: 'LOADING',
      isLoading: true,
      activeNoteId: noteId,
    });

    try {
      const quiz = await quizService.generateQuiz({
        noteId,
        questionCount,
        includeReflection: true,
      });

      const sessionApi = await quizService.createSession({
        quizId: quiz.quizId,
        userId: user.id,
        appId: APP_ID,
        metadata: {
          noteId,
          provider: quiz.provider,
        },
      });

      const session = mapSession(sessionApi);

      set({
        ...createDefaultState(),
        session,
        status: 'ACTIVE',
        isLoading: false,
        activeNoteId: noteId,
      });
    } catch (error: unknown) {
      let message = 'Failed to generate quiz. Please try again.';
      if (axios.isAxiosError(error)) {
        message = error.response?.data?.detail || error.response?.data?.message || message;
      } else if (error instanceof Error && error.message) {
        message = error.message;
      }

      showError(message);
      set({
        ...createDefaultState(),
        status: 'IDLE',
        error: message,
      });
      throw error;
    }
  },

  setAnswer(questionId, type, value) {
    const state = get();
    if (!state.session) {
      return;
    }

    const draft: QuizDraftAnswer = { questionId, type, value };
    const updatedAnswers = {
      ...state.answers,
      [questionId]: draft,
    };

    const updatedQuestions = state.session.questions.map((question) =>
      question.questionId === questionId ? { ...question, userAnswer: value } : question
    );

    set({
      answers: updatedAnswers,
      session: { ...state.session, questions: updatedQuestions },
      error: null,
    });
  },

  nextQuestion() {
    const { session, currentQuestionIndex } = get();
    if (!session) {
      return;
    }
    const lastIndex = session.questions.length - 1;
    if (currentQuestionIndex >= lastIndex) {
      return;
    }
    set({ currentQuestionIndex: currentQuestionIndex + 1 });
  },

  previousQuestion() {
    const { currentQuestionIndex } = get();
    if (currentQuestionIndex <= 0) {
      return;
    }
    set({ currentQuestionIndex: currentQuestionIndex - 1 });
  },

  goToQuestion(index) {
    const { session } = get();
    if (!session) {
      return;
    }
    if (index < 0 || index >= session.questions.length) {
      return;
    }
    set({ currentQuestionIndex: index });
  },

  async submitQuiz() {
    const state = get();
    if (!state.session) {
      const message = 'No active quiz session to submit.';
      showError(message);
      throw new Error(message);
    }

    const user = useAuthStore.getState().user;
    if (!user) {
      const message = 'You need to be signed in to submit a quiz.';
      showError(message);
      throw new Error(message);
    }

    const unanswered = state.session.questions.filter((question) => !hasAnswer(state.answers[question.questionId]));
    if (unanswered.length > 0) {
      const message = 'Please answer every question before grading your quiz.';
      set({ error: message });
      showError(message);
      return;
    }

    const answers: QuizSubmissionAnswer[] = Object.values(state.answers).map((draft) => {
      switch (draft.type) {
        case 'MULTIPLE_CHOICE':
          return {
            questionId: draft.questionId,
            type: 'MULTIPLE_CHOICE',
            selectedOptionIds: Array.isArray(draft.value) ? draft.value : [],
          };
        case 'TRUE_FALSE':
          return {
            questionId: draft.questionId,
            type: 'TRUE_FALSE',
            answer: Boolean(draft.value),
          };
        case 'SHORT_ANSWER':
        case 'WRITTEN_RESPONSE':
          return {
            questionId: draft.questionId,
            type: draft.type,
            answer: typeof draft.value === 'string' ? draft.value : String(draft.value ?? ''),
          };
        default:
          return {
            questionId: draft.questionId,
            type: 'SHORT_ANSWER',
            answer: typeof draft.value === 'string' ? draft.value : '',
          };
      }
    });

    set({ status: 'LOADING', isLoading: true, error: null });

    try {
      const response = await quizService.submitSession(state.session.sessionId, {
        sessionId: state.session.sessionId,
        quizId: state.session.quizId,
        userId: user.id,
        appId: APP_ID,
        answers,
        metadata: {
          submittedAt: new Date().toISOString(),
        },
      });

      const results = response.results;
      const questionResultsById = results.questionResults.reduce<Record<string, QuizQuestionResult>>((acc, result) => {
        acc[result.questionId] = result;
        return acc;
      }, {});

      const decoratedQuestions: QuizQuestionView[] = state.session.questions.map((question) => {
        const result = questionResultsById[question.questionId];
        const draft = state.answers[question.questionId];
        return {
          ...question,
          userAnswer:
            typeof result?.submittedAnswer !== 'undefined'
              ? (result.submittedAnswer as QuizAnswerValue)
              : draft?.value ?? null,
          isCorrect: typeof result?.correct === 'boolean' ? result.correct : null,
          feedback: result?.feedback ?? null,
          pendingReview: result?.pendingReview ?? false,
          score: typeof result?.score === 'number' ? result.score : null,
          maxScore: typeof result?.maxScore === 'number' ? result.maxScore : question.points ?? null,
        };
      });

      const updatedSession: QuizSession = {
        ...state.session,
        status: results.requiresReview ? 'awaiting_review' : 'completed',
        questions: decoratedQuestions,
      };

      recordQuizSubmissionTelemetry('success', {
        sessionId: state.session.sessionId,
        quizId: state.session.quizId,
        totalScore: results.totalScore,
        maxScore: results.maxScore,
        requiresReview: results.requiresReview,
        pendingWrittenCount: results.pendingWrittenCount,
      });

      set({
        results,
        questionResultsById,
        session: updatedSession,
        status: 'GRADED',
        isLoading: false,
        currentQuestionIndex: 0,
      });
    } catch (error: unknown) {
      let message = 'Failed to submit quiz. Please try again.';
      if (axios.isAxiosError(error)) {
        message = error.response?.data?.detail || error.response?.data?.message || message;
      } else if (error instanceof Error && error.message) {
        message = error.message;
      }
      recordQuizSubmissionTelemetry('error', {
        sessionId: state.session.sessionId,
        quizId: state.session.quizId,
        message,
        status: axios.isAxiosError(error) ? error.response?.status : undefined,
      });
      showError(message);
      set({ status: 'ACTIVE', isLoading: false, error: message });
      throw error;
    }
  },

  viewSummary() {
    const { results } = get();
    if (!results) {
      return;
    }
    set({ status: 'FEEDBACK' });
  },

  resetSession() {
    set({ ...createDefaultState() });
  },

  clearError() {
    set({ error: null });
  },
}));
