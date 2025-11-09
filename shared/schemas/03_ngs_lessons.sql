-- NGS Curriculum Lesson Management
-- Adds comprehensive lesson content, quizzes, challenges, and reflections

-- Lessons table: stores lesson content for each level
CREATE TABLE IF NOT EXISTS lessons (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  level_id INTEGER NOT NULL REFERENCES curriculum_levels(id),
  title VARCHAR(255) NOT NULL,
  description TEXT,
  lesson_order INTEGER NOT NULL, -- Order within the level
  lesson_type VARCHAR(50) NOT NULL, -- tutorial, exercise, quiz, challenge, reflection
  content_markdown TEXT, -- Main lesson content in markdown
  core_lesson TEXT, -- The core lesson from NGS_Curriculum.md
  human_practice TEXT, -- Human practice instructions
  reflection_prompt TEXT, -- Reflection question
  agent_unlock TEXT, -- Agent feature unlocked
  xp_reward INTEGER DEFAULT 50,
  estimated_minutes INTEGER DEFAULT 30,
  prerequisites JSONB, -- Array of lesson IDs that must be completed first
  metadata JSONB, -- Additional flexible data
  is_required BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_lessons_level_id ON lessons(level_id);
CREATE INDEX IF NOT EXISTS idx_lessons_order ON lessons(level_id, lesson_order);

-- Lesson completions: tracks user progress through lessons
CREATE TABLE IF NOT EXISTS lesson_completions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  lesson_id UUID NOT NULL REFERENCES lessons(id) ON DELETE CASCADE,
  score INTEGER CHECK (score >= 0 AND score <= 100), -- For quizzes/challenges
  time_spent_seconds INTEGER,
  reflection_text TEXT, -- User's reflection response
  completion_data JSONB, -- Quiz answers, challenge results, etc.
  completed_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(user_id, lesson_id)
);

CREATE INDEX IF NOT EXISTS idx_lesson_completions_user_id ON lesson_completions(user_id);
CREATE INDEX IF NOT EXISTS idx_lesson_completions_lesson_id ON lesson_completions(lesson_id);

-- Challenges: coding/practice challenges for hands-on learning
CREATE TABLE IF NOT EXISTS challenges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lesson_id UUID REFERENCES lessons(id) ON DELETE CASCADE,
  level_id INTEGER NOT NULL REFERENCES curriculum_levels(id),
  title VARCHAR(255) NOT NULL,
  description TEXT NOT NULL,
  challenge_type VARCHAR(50) NOT NULL, -- coding, design, reflection, collaboration
  difficulty VARCHAR(20) DEFAULT 'medium', -- easy, medium, hard, expert
  starter_code TEXT, -- For coding challenges
  test_cases JSONB, -- Array of test cases for validation
  solution_template TEXT, -- Template or hints
  xp_reward INTEGER DEFAULT 100,
  time_limit_minutes INTEGER,
  tags TEXT[],
  metadata JSONB,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_challenges_level_id ON challenges(level_id);
CREATE INDEX IF NOT EXISTS idx_challenges_type ON challenges(challenge_type);

-- Challenge submissions: tracks user challenge attempts
CREATE TABLE IF NOT EXISTS challenge_submissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  challenge_id UUID NOT NULL REFERENCES challenges(id) ON DELETE CASCADE,
  submission_code TEXT, -- User's solution
  test_results JSONB, -- Results of running test cases
  passed BOOLEAN DEFAULT false,
  score INTEGER CHECK (score >= 0 AND score <= 100),
  feedback TEXT, -- AI-generated or manual feedback
  time_taken_seconds INTEGER,
  submitted_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_challenge_submissions_user_id ON challenge_submissions(user_id);
CREATE INDEX IF NOT EXISTS idx_challenge_submissions_challenge_id ON challenge_submissions(challenge_id);

-- User reflections: separate table for reflection tracking
CREATE TABLE IF NOT EXISTS user_reflections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  lesson_id UUID REFERENCES lessons(id) ON DELETE SET NULL,
  level_number INTEGER,
  reflection_prompt TEXT NOT NULL,
  reflection_text TEXT NOT NULL,
  quality_score FLOAT CHECK (quality_score >= 0 AND quality_score <= 1), -- AI-assessed quality
  xp_awarded INTEGER DEFAULT 0,
  is_public BOOLEAN DEFAULT false, -- Can be shared with community
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_user_reflections_user_id ON user_reflections(user_id);
CREATE INDEX IF NOT EXISTS idx_user_reflections_level ON user_reflections(level_number);

-- Learning paths: for future customization (optional for Phase 9)
CREATE TABLE IF NOT EXISTS learning_paths (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  description TEXT,
  level_sequence INTEGER[], -- Array of level numbers in order
  is_default BOOLEAN DEFAULT false,
  created_at TIMESTAMP DEFAULT NOW()
);

-- User learning path assignments
CREATE TABLE IF NOT EXISTS user_learning_paths (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID UNIQUE NOT NULL,
  learning_path_id UUID REFERENCES learning_paths(id) ON DELETE SET NULL,
  current_position INTEGER DEFAULT 0, -- Current level in the path
  started_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Insert default learning path (linear 1-24 progression)
INSERT INTO learning_paths (name, description, level_sequence, is_default) VALUES
  ('Noble Growth Standard Path', 
   'The complete 24-level journey from Awakener to Noble Sovereign',
   ARRAY[1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,19,20,21,22,23,24],
   true)
ON CONFLICT DO NOTHING;
