import api from '@/services/api';
import type {
  GeneratedQuiz,
  QuizGenerationPayload,
  QuizGenerationResponse,
  QuizSessionApi,
  QuizSessionResponseEnvelope,
  QuizSubmissionAnswer,
  QuizResultsResponse,
} from '@/types/quiz';

export interface CreateQuizSessionPayload {
  quizId: string;
  userId: string;
  appId: string;
  metadata?: Record<string, unknown>;
}

export interface SubmitQuizPayload {
  sessionId?: string;
  quizId: string;
  userId: string;
  appId: string;
  answers: QuizSubmissionAnswer[];
  metadata?: Record<string, unknown>;
}

export const quizService = {
  async generateQuiz(payload: QuizGenerationPayload): Promise<GeneratedQuiz> {
    const { data } = await api.post<QuizGenerationResponse>('/study/quiz/generate', payload);
    return data.quiz;
  },

  async createSession(payload: CreateQuizSessionPayload): Promise<QuizSessionApi> {
    const { data } = await api.post<QuizSessionResponseEnvelope>('/quiz/sessions', payload);
    return data.session;
  },

  async submitSession(sessionId: string, payload: SubmitQuizPayload): Promise<QuizResultsResponse> {
    const { data } = await api.post<QuizResultsResponse>(`/quiz/sessions/${sessionId}/submit`, payload);
    return data;
  },

  async getSession(sessionId: string, appId: string, userId: string): Promise<QuizSessionApi> {
    const { data } = await api.get<QuizSessionResponseEnvelope>(`/quiz/sessions/${sessionId}`, {
      params: { appId, userId },
    });
    return data.session;
  },

  async getResults(sessionId: string, appId: string, userId: string): Promise<QuizResultsResponse> {
    const { data } = await api.get<QuizResultsResponse>(`/quiz/sessions/${sessionId}/results`, {
      params: { appId, userId },
    });
    return data;
  },
};

export default quizService;
