import api from './api';
import type {
  GenerateLessonResponse,
  LessonContent,
  EducatorChatMessage,
  EducatorChatResponse,
} from '../types/lesson';

export const lessonApi = {
  generateLesson: async (lessonId: string): Promise<GenerateLessonResponse> => {
    const response = await api.post<GenerateLessonResponse>(
      `/ngs/lessons/${lessonId}/generate`
    );
    return response.data;
  },

  getLessonContent: async (lessonId: string): Promise<LessonContent> => {
    const response = await api.get<LessonContent>(
      `/ngs/lessons/${lessonId}/content`
    );
    return response.data;
  },

  sendEducatorChatMessage: async (
    lessonId: string,
    message: EducatorChatMessage
  ): Promise<EducatorChatResponse> => {
    const response = await api.post<EducatorChatResponse>(
      `/ngs/lessons/${lessonId}/chat/message`,
      message
    );
    return response.data;
  },
};

export default lessonApi;
