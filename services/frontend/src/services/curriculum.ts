import api from './api';
import type { 
  UserProgress, 
  CurriculumLevel, 
  Lesson, 
  LessonCompletion,
  Reflection,
  Challenge,
  ChallengeSubmission,
  Achievement,
  LeaderboardEntry
} from '@/types/curriculum';

export const curriculumService = {
  // Progress
  getProgress: async (): Promise<UserProgress> => {
    const response = await api.get<UserProgress>('/ngs/progress');
    return response.data;
  },

  awardXP: async (source: string, amount?: number, metadata?: any): Promise<{ new_level?: number; xp_awarded: number }> => {
    const response = await api.post('/ngs/award-xp', { source, amount, metadata });
    return response.data;
  },
  
  // Levels
  getLevels: async (): Promise<{ levels: CurriculumLevel[]; count: number }> => {
    const response = await api.get('/ngs/levels');
    return response.data;
  },

  getLevel: async (level: number): Promise<CurriculumLevel> => {
    const response = await api.get<CurriculumLevel>(`/ngs/levels/${level}`);
    return response.data;
  },
  
  // Lessons
  getLessonsByLevel: async (level: number): Promise<{ lessons: Lesson[]; count: number }> => {
    const response = await api.get(`/ngs/levels/${level}/lessons`);
    return response.data;
  },

  getLesson: async (lessonId: string): Promise<Lesson> => {
    const response = await api.get<Lesson>(`/ngs/lessons/${lessonId}`);
    return response.data;
  },

  completeLesson: async (
    lessonId: string, 
    data: {
      score?: number;
      time_spent_seconds?: number;
      reflection_text?: string;
      metadata?: any;
    }
  ): Promise<{ completion: LessonCompletion; new_level?: number; xp_awarded: number }> => {
    const response = await api.post(`/ngs/lessons/${lessonId}/complete`, data);
    return response.data;
  },
  
  // Reflections
  getReflections: async (limit: number = 20): Promise<{ reflections: Reflection[]; count: number }> => {
    const response = await api.get(`/ngs/reflections?limit=${limit}`);
    return response.data;
  },

  submitReflection: async (data: {
    lesson_id?: string;
    level_number?: number;
    reflection_prompt: string;
    reflection_text: string;
    is_public?: boolean;
  }): Promise<{ reflection: Reflection; xp_awarded: number }> => {
    const response = await api.post('/ngs/reflections', data);
    return response.data;
  },
  
  // Challenges
  getChallengesByLevel: async (level: number): Promise<{ challenges: Challenge[]; count: number }> => {
    const response = await api.get(`/ngs/levels/${level}/challenges`);
    return response.data;
  },

  getChallenge: async (challengeId: string): Promise<Challenge> => {
    const response = await api.get<Challenge>(`/ngs/challenges/${challengeId}`);
    return response.data;
  },

  submitChallenge: async (
    challengeId: string, 
    code: string
  ): Promise<{ submission: ChallengeSubmission; xp_awarded: number }> => {
    const response = await api.post(`/ngs/challenges/${challengeId}/submit`, { 
      submission_code: code 
    });
    return response.data;
  },

  getUserSubmissions: async (): Promise<{ submissions: ChallengeSubmission[]; count: number }> => {
    const response = await api.get('/ngs/challenges/submissions');
    return response.data;
  },
  
  // Achievements
  getAchievements: async (): Promise<{ achievements: Achievement[]; count: number }> => {
    const response = await api.get('/ngs/achievements');
    return response.data;
  },

  // Leaderboard
  getLeaderboard: async (limit: number = 10): Promise<{ leaderboard: LeaderboardEntry[]; count: number }> => {
    const response = await api.get(`/ngs/leaderboard?limit=${limit}`);
    return response.data;
  },
};

export default curriculumService;
