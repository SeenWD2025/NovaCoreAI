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
  unlock_requirements?: any;
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
  prerequisites?: any;
  metadata?: any;
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
  completion_data?: any;
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
  test_cases?: any;
  solution_template?: string;
  xp_reward: number;
  time_limit_minutes?: number;
  tags?: string[];
  metadata?: any;
  is_active: boolean;
  created_at: string;
}

export interface ChallengeSubmission {
  id: string;
  user_id: string;
  challenge_id: string;
  submission_code: string;
  test_results?: any;
  score?: number;
  passed: boolean;
  feedback?: string;
  submitted_at: string;
}

export interface Achievement {
  id: string;
  user_id: string;
  achievement_type: string;
  achievement_data: any;
  unlocked_at: string;
}

export interface LeaderboardEntry {
  user_id: string;
  total_xp: number;
  current_level: number;
  rank: number;
}
