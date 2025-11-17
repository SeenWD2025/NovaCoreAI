
CREATE TABLE IF NOT EXISTS study_quiz_artifacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  note_id UUID REFERENCES structured_notes(id) ON DELETE CASCADE,
  artifact_type VARCHAR(50) NOT NULL, -- 'flashcard', 'quiz', 'summary', 'concept_map'
  content JSONB NOT NULL,
  difficulty VARCHAR(20), -- 'easy', 'medium', 'hard'
  metadata JSONB,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS quiz_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  artifact_id UUID REFERENCES study_quiz_artifacts(id) ON DELETE CASCADE,
  status VARCHAR(50) DEFAULT 'in_progress', -- 'in_progress', 'completed', 'abandoned'
  score INTEGER,
  total_questions INTEGER,
  results JSONB,
  started_at TIMESTAMP DEFAULT NOW(),
  completed_at TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_artifacts_user_id ON study_quiz_artifacts(user_id);
CREATE INDEX IF NOT EXISTS idx_artifacts_note_id ON study_quiz_artifacts(note_id);
CREATE INDEX IF NOT EXISTS idx_artifacts_type ON study_quiz_artifacts(artifact_type);
CREATE INDEX IF NOT EXISTS idx_quiz_sessions_user_id ON quiz_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_quiz_sessions_status ON quiz_sessions(status);
CREATE INDEX IF NOT EXISTS idx_quiz_sessions_artifact_id ON quiz_sessions(artifact_id);
