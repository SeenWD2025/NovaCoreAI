// TypeScript types for NGS Curriculum

export interface UserProgress {
  id: string;
  user_id: string;
  current_level: number;
  total_xp: number;
  agent_creation_unlocked: boolean;
  current_level_info?: CurriculumLevel;
  next_level_info?: CurriculumLevel;
  xp_to_next_level: number;
  progress_percent: number;
  created_at: string;
  updated_at: string;
}

export interface CurriculumLevel {
  id: number;
  level_number: number;
  title: string;
  description: string;
  unlock_requirements?: Record<string, unknown>;
  xp_required: number;
}

export interface Lesson {
  id: string;
  level_id: number;
  title: string;
  description: string;
  lesson_order: number;
  lesson_type: 'tutorial' | 'exercise' | 'quiz' | 'challenge' | 'reflection';
  content_markdown?: string;
  core_lesson: string;
  human_practice: string;
  reflection_prompt: string;
  agent_unlock: string;
  xp_reward: number;
  estimated_minutes: number;
  prerequisites?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
  is_required: boolean;
  completed?: boolean;
  completed_at?: string;
  user_score?: number;
  created_at: string;
  updated_at: string;
}

export interface LessonCompletion {
  id: string;
  user_id: string;
  lesson_id: string;
  score?: number;
  time_spent_seconds?: number;
  reflection_text?: string;
  completion_data?: Record<string, unknown>;
  completed_at: string;
}

export interface Reflection {
  id: string;
  user_id: string;
  lesson_id?: string;
  level_number?: number;
  reflection_prompt: string;
  reflection_text: string;
  quality_score?: number;
  xp_awarded: number;
  is_public: boolean;
  created_at: string;
}

export interface Challenge {
  id: string;
  lesson_id?: string;
  level_id: number;
  title: string;
  description: string;
  challenge_type: 'coding' | 'design' | 'reflection' | 'collaboration';
  difficulty: 'easy' | 'medium' | 'hard' | 'expert';
  starter_code?: string;
  test_cases?: ChallengeTestCase[];
  solution_template?: string;
  xp_reward: number;
  time_limit_minutes?: number;
  tags?: string[];
  metadata?: Record<string, unknown>;
  is_active: boolean;
  created_at: string;
}

export interface ChallengeSubmission {
  id: string;
  user_id: string;
  challenge_id: string;
  submission_code: string;
  test_results?: ChallengeTestResult[];
  score?: number;
  passed: boolean;
  feedback?: string;
  submitted_at: string;
}

export interface Achievement {
  id: string;
  user_id: string;
  achievement_type: string;
  achievement_data: Record<string, unknown>;
  unlocked_at: string;
}

export interface LeaderboardEntry {
  user_id: string;
  total_xp: number;
  current_level: number;
  rank: number;
}

export interface ChallengeTestCase {
  input: unknown;
  expected: unknown;
  description?: string;
}

export interface ChallengeTestResult {
  test: string;
  passed: boolean;
  expected: unknown;
  actual: unknown;
  message?: string;
}
