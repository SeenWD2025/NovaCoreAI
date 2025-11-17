export type QuizQuestionType =
  | 'MULTIPLE_CHOICE'
  | 'TRUE_FALSE'
  | 'SHORT_ANSWER'
  | 'WRITTEN_RESPONSE';

export interface QuizQuestionOption {
  optionId: string;
  text: string;
}

export interface QuizQuestionView {
  questionId: string;
  prompt: string;
  type: QuizQuestionType;
  options?: QuizQuestionOption[] | null;
  difficulty?: string | null;
  tags: string[];
  sourceComponentId?: string | null;
  points?: number | null;
  userAnswer?: string | string[] | boolean | null;
  isCorrect?: boolean | null;
  feedback?: string | null;
  pendingReview?: boolean;
  score?: number | null;
  maxScore?: number | null;
}

export interface QuizReflection {
  prompt: string;
  guidance?: string | null;
}

export type QuizSessionStatus = 'in_progress' | 'awaiting_review' | 'completed' | 'cancelled';

export interface QuizSession {
  sessionId: string;
  quizId: string;
  appId: string;
  userId: string;
  noteId?: string | null;
  status: QuizSessionStatus;
  createdAt: string;
  updatedAt: string;
  questions: QuizQuestionView[];
  reflection?: QuizReflection | null;
  metadata?: Record<string, unknown>;
}

export interface QuizSessionApiQuestion {
  questionId: string;
  prompt: string;
  type: QuizQuestionType;
  options?: QuizQuestionOption[] | null;
  difficulty?: string | null;
  tags: string[];
  sourceComponentId?: string | null;
  points?: number | null;
}

export interface QuizSessionApi {
  sessionId: string;
  quizId: string;
  appId: string;
  userId: string;
  noteId?: string | null;
  status: QuizSessionStatus;
  createdAt: string;
  updatedAt: string;
  questions: QuizSessionApiQuestion[];
  reflection?: QuizReflection | null;
  metadata?: Record<string, unknown>;
}

export interface QuizSessionResponseEnvelope {
  session: QuizSessionApi;
}

export interface QuizGenerationPayload {
  noteId?: string;
  questionCount?: number;
  includeReflection?: boolean;
}

export interface GeneratedQuizQuestion {
  id: string;
  prompt: string;
  type: string;
  options?: Array<{
    label: string;
    text: string;
  }> | null;
  answerExplanation?: string | null;
  metadata?: Record<string, unknown>;
}

export interface GeneratedQuiz {
  quizId: string;
  provider: string;
  questions: GeneratedQuizQuestion[];
  reflection?: {
    prompt: string;
    guidance?: string | null;
  } | null;
}

export interface QuizGenerationResponse {
  quiz: GeneratedQuiz;
}

export interface QuizQuestionResult {
  questionId: string;
  score: number;
  maxScore: number;
  correct: boolean;
  pendingReview: boolean;
  feedback?: string | null;
  submittedAnswer?: unknown;
  sourceComponentId?: string | null;
  metadata?: Record<string, unknown>;
}

export interface QuizRecommendation {
  recommendationId: string;
  sessionId: string;
  quizId: string;
  userId: string;
  appId: string;
  noteId?: string | null;
  questionId?: string | null;
  sourceComponentId?: string | null;
  text: string;
  createdAt: string;
  isDeleted: boolean;
  deletedAt?: string | null;
}

export interface QuizResults {
  sessionId: string;
  quizId: string;
  userId: string;
  appId: string;
  noteId?: string | null;
  totalScore: number;
  maxScore: number;
  questionResults: QuizQuestionResult[];
  recommendations: QuizRecommendation[];
  noteImprovementSuggestions: QuizRecommendation[];
  completedAt: string;
  submittedAt: string;
  requiresReview: boolean;
  pendingWrittenCount: number;
  metadata?: Record<string, unknown>;
}

export interface QuizResultsResponse {
  results: QuizResults;
}

export type QuizStatus = 'IDLE' | 'LOADING' | 'ACTIVE' | 'GRADED' | 'FEEDBACK';

export type QuizAnswerValue = string | string[] | boolean;

export interface QuizDraftAnswer {
  questionId: string;
  type: QuizQuestionType;
  value: QuizAnswerValue;
}

export interface MultipleChoiceSubmissionAnswer {
  questionId: string;
  type: 'MULTIPLE_CHOICE';
  selectedOptionIds: string[];
}

export interface TrueFalseSubmissionAnswer {
  questionId: string;
  type: 'TRUE_FALSE';
  answer: boolean;
}

export interface ShortAnswerSubmissionAnswer {
  questionId: string;
  type: 'SHORT_ANSWER';
  answer: string;
}

export interface WrittenResponseSubmissionAnswer {
  questionId: string;
  type: 'WRITTEN_RESPONSE';
  answer: string;
}

export type QuizSubmissionAnswer =
  | MultipleChoiceSubmissionAnswer
  | TrueFalseSubmissionAnswer
  | ShortAnswerSubmissionAnswer
  | WrittenResponseSubmissionAnswer;
