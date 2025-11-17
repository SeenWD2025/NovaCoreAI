
CREATE TABLE IF NOT EXISTS structured_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title VARCHAR(500) NOT NULL,
  content TEXT NOT NULL,
  tags TEXT[],
  metadata JSONB,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS note_retention_policies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  retention_days INTEGER NOT NULL,
  auto_archive BOOLEAN DEFAULT false,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS note_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  note_id UUID REFERENCES structured_notes(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  action VARCHAR(50) NOT NULL,
  changes JSONB,
  timestamp TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_notes_user_id ON structured_notes(user_id);
CREATE INDEX IF NOT EXISTS idx_notes_created_at ON structured_notes(created_at);
CREATE INDEX IF NOT EXISTS idx_notes_tags ON structured_notes USING GIN(tags);
CREATE INDEX IF NOT EXISTS idx_note_audit_note_id ON note_audit_log(note_id);
CREATE INDEX IF NOT EXISTS idx_note_audit_user_id ON note_audit_log(user_id);
CREATE INDEX IF NOT EXISTS idx_note_retention_user_id ON note_retention_policies(user_id);
