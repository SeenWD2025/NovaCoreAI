import { create } from 'zustand';
import type {
  UserProgress,
  CurriculumLevel,
  Lesson,
  Achievement,
  LeaderboardEntry,
} from '@/types/curriculum';
import curriculumService from '@/services/curriculum';

const resolveApiError = (error: unknown, fallback: string): string => {
  if (error && typeof error === 'object' && 'response' in error) {
    const maybeResponse = (error as { response?: { data?: { message?: string } } }).response;
    return maybeResponse?.data?.message || fallback;
  }

  return fallback;
};

interface CurriculumState {
  progress: UserProgress | null;
  levels: CurriculumLevel[];
  currentLesson: Lesson | null;
  achievements: Achievement[];
  leaderboard: LeaderboardEntry[];
  isLoading: boolean;
  error: string | null;

  fetchProgress: () => Promise<void>;
  fetchLevels: () => Promise<void>;
  fetchAchievements: () => Promise<void>;
  fetchLeaderboard: (limit?: number) => Promise<void>;
  setCurrentLesson: (lesson: Lesson | null) => void;
  refreshProgress: () => Promise<void>;
  clearError: () => void;
}

export const useCurriculumStore = create<CurriculumState>((set) => ({
  progress: null,
  levels: [],
  currentLesson: null,
  achievements: [],
  leaderboard: [],
  isLoading: false,
  error: null,

  fetchProgress: async () => {
    set({ isLoading: true, error: null });
    try {
      const progress = await curriculumService.getProgress();
      set({ progress, isLoading: false });
    } catch (error) {
      const errorMessage = resolveApiError(error, 'Failed to fetch progress');
      set({ error: errorMessage, isLoading: false });
    }
  },

  fetchLevels: async () => {
    set({ isLoading: true, error: null });
    try {
      const { levels } = await curriculumService.getLevels();
      set({ levels, isLoading: false });
    } catch (error) {
      const errorMessage = resolveApiError(error, 'Failed to fetch levels');
      set({ error: errorMessage, isLoading: false });
    }
  },

  fetchAchievements: async () => {
    set({ isLoading: true, error: null });
    try {
      const { achievements } = await curriculumService.getAchievements();
      set({ achievements, isLoading: false });
    } catch (error) {
      const errorMessage = resolveApiError(error, 'Failed to fetch achievements');
      set({ error: errorMessage, isLoading: false });
    }
  },

  fetchLeaderboard: async (limit: number = 10) => {
    set({ isLoading: true, error: null });
    try {
      const { leaderboard } = await curriculumService.getLeaderboard(limit);
      set({ leaderboard, isLoading: false });
    } catch (error) {
      const errorMessage = resolveApiError(error, 'Failed to fetch leaderboard');
      set({ error: errorMessage, isLoading: false });
    }
  },

  setCurrentLesson: (lesson: Lesson | null) => {
    set({ currentLesson: lesson });
  },

  refreshProgress: async () => {
    // Silently refresh progress without loading state
    try {
      const progress = await curriculumService.getProgress();
      set({ progress });
    } catch (error) {
      console.error('Failed to refresh progress:', error);
    }
  },

  clearError: () => set({ error: null }),
}));
