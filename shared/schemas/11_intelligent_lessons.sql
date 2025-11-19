
ALTER TABLE lessons 
ADD COLUMN IF NOT EXISTS content_version INTEGER DEFAULT 0;

CREATE TABLE IF NOT EXISTS lesson_artifacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lesson_id UUID NOT NULL REFERENCES lessons(id) ON DELETE CASCADE,
  artifact_type VARCHAR(50) NOT NULL, -- quiz_items, notes_outline, code_snippets, glossary
  artifact_data JSONB NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_lesson_artifacts_lesson_id ON lesson_artifacts(lesson_id);
CREATE INDEX IF NOT EXISTS idx_lesson_artifacts_type ON lesson_artifacts(artifact_type);

CREATE TABLE IF NOT EXISTS lesson_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  lesson_id UUID NOT NULL REFERENCES lessons(id) ON DELETE CASCADE,
  session_id UUID, -- Optional: link to chat session if applicable
  attempts_count INTEGER DEFAULT 1,
  time_spent_seconds INTEGER DEFAULT 0,
  messages_with_tutor INTEGER DEFAULT 0,
  hints_requested INTEGER DEFAULT 0,
  reflections_count INTEGER DEFAULT 0,
  memories_generated INTEGER DEFAULT 0,
  quiz_score_best INTEGER,
  quiz_score_avg FLOAT,
  tips_for_improvement TEXT,
  metrics_data JSONB, -- Additional flexible metrics
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_lesson_metrics_user_id ON lesson_metrics(user_id);
CREATE INDEX IF NOT EXISTS idx_lesson_metrics_lesson_id ON lesson_metrics(lesson_id);
CREATE INDEX IF NOT EXISTS idx_lesson_metrics_session_id ON lesson_metrics(session_id);

CREATE TABLE IF NOT EXISTS educator_chat_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  lesson_id UUID NOT NULL REFERENCES lessons(id) ON DELETE CASCADE,
  session_id UUID NOT NULL, -- Links to Intelligence service sessions table
  status VARCHAR(20) DEFAULT 'active', -- active, completed, archived
  message_count INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW(),
  ended_at TIMESTAMP,
  UNIQUE(user_id, lesson_id, session_id)
);

CREATE INDEX IF NOT EXISTS idx_educator_chat_sessions_user_id ON educator_chat_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_educator_chat_sessions_lesson_id ON educator_chat_sessions(lesson_id);
CREATE INDEX IF NOT EXISTS idx_educator_chat_sessions_session_id ON educator_chat_sessions(session_id);

COMMENT ON COLUMN lessons.content_version IS 'Version number for AI-generated content, incremented on regeneration';
COMMENT ON TABLE lesson_artifacts IS 'Stores structured artifacts generated during lesson creation (quiz items, notes outlines, etc.)';
COMMENT ON TABLE lesson_metrics IS 'Tracks detailed metrics for each lesson attempt including tutor interactions';
COMMENT ON TABLE educator_chat_sessions IS 'Tracks per-lesson tutor chat sessions for context and history';
