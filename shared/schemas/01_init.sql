-- Enable pgvector extension
CREATE EXTENSION IF NOT EXISTS vector;

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Central shared tables
-- User Management (owned by Auth & Billing service)
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  role VARCHAR(50) DEFAULT 'student',
  subscription_tier VARCHAR(50) DEFAULT 'free_trial',
  trial_ends_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Subscription Management
CREATE TABLE IF NOT EXISTS subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  stripe_subscription_id VARCHAR(255) UNIQUE,
  stripe_customer_id VARCHAR(255) UNIQUE,
  status VARCHAR(50),
  tier VARCHAR(50),
  current_period_start TIMESTAMP,
  current_period_end TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Usage Tracking
CREATE TABLE IF NOT EXISTS usage_ledger (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  resource_type VARCHAR(100),
  amount INTEGER NOT NULL,
  metadata JSONB,
  timestamp TIMESTAMP DEFAULT NOW()
);

-- NGS Curriculum Reference Data
CREATE TABLE IF NOT EXISTS curriculum_levels (
  id INTEGER PRIMARY KEY,
  level_number INTEGER NOT NULL,
  title VARCHAR(255) NOT NULL,
  description TEXT,
  unlock_requirements JSONB,
  xp_required INTEGER NOT NULL
);

-- Memory Service Tables
CREATE TABLE IF NOT EXISTS memories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  session_id UUID,
  type VARCHAR(50),
  input_context TEXT,
  output_response TEXT,
  outcome VARCHAR(50),
  emotional_weight FLOAT CHECK (emotional_weight BETWEEN -1 AND 1),
  confidence_score FLOAT CHECK (confidence_score BETWEEN 0 AND 1),
  constitution_valid BOOLEAN DEFAULT true,
  tags TEXT[],
  vector_embedding VECTOR(384),
  tier VARCHAR(20),
  access_count INTEGER DEFAULT 0,
  last_accessed_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  expires_at TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_memories_user_id ON memories(user_id);
CREATE INDEX IF NOT EXISTS idx_memories_session_id ON memories(session_id);
CREATE INDEX IF NOT EXISTS idx_memories_tier ON memories(tier);

-- Reflections (hidden from users)
CREATE TABLE IF NOT EXISTS reflections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  memory_id UUID REFERENCES memories(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  self_assessment TEXT NOT NULL,
  alignment_score FLOAT CHECK (alignment_score BETWEEN 0 AND 1),
  improvement_notes TEXT,
  metadata JSONB,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Distilled Knowledge
CREATE TABLE IF NOT EXISTS distilled_knowledge (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  source_reflections UUID[],
  topic VARCHAR(255),
  principle TEXT NOT NULL,
  embedding VECTOR(384),
  confidence FLOAT CHECK (confidence BETWEEN 0 AND 1),
  created_at TIMESTAMP DEFAULT NOW()
);

-- Intelligence Core Tables
CREATE TABLE IF NOT EXISTS sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  status VARCHAR(50) DEFAULT 'active',
  model_name VARCHAR(100),
  created_at TIMESTAMP DEFAULT NOW(),
  ended_at TIMESTAMP
);

CREATE TABLE IF NOT EXISTS prompts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID REFERENCES sessions(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  input_text TEXT NOT NULL,
  output_text TEXT,
  tokens_used INTEGER,
  latency_ms INTEGER,
  created_at TIMESTAMP DEFAULT NOW()
);

-- NGS Curriculum Service Tables
CREATE TABLE IF NOT EXISTS user_progress (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID UNIQUE NOT NULL,
  current_level INTEGER DEFAULT 1,
  total_xp INTEGER DEFAULT 0,
  agent_creation_unlocked BOOLEAN DEFAULT false,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS xp_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  source VARCHAR(100),
  xp_awarded INTEGER NOT NULL,
  metadata JSONB,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS achievements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  achievement_type VARCHAR(100),
  achievement_data JSONB,
  unlocked_at TIMESTAMP DEFAULT NOW()
);

-- Noble-Spirit Policy Service Tables
CREATE TABLE IF NOT EXISTS policies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  version INTEGER NOT NULL,
  policy_name VARCHAR(255) NOT NULL,
  policy_content JSONB NOT NULL,
  is_active BOOLEAN DEFAULT true,
  signature VARCHAR(255),
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS policy_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  policy_id UUID REFERENCES policies(id),
  user_id UUID,
  action VARCHAR(100),
  context JSONB,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_user_progress_user_id ON user_progress(user_id);
CREATE INDEX IF NOT EXISTS idx_xp_events_user_id ON xp_events(user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_prompts_session_id ON prompts(session_id);

-- Insert initial curriculum levels (Foundation)
INSERT INTO curriculum_levels (id, level_number, title, description, xp_required) VALUES
  (1, 1, 'Self-Awareness Foundations', 'Understanding identity and purpose', 0),
  (2, 2, 'Basic Logic', 'Introduction to reasoning', 100),
  (3, 3, 'Ethical Principles', 'Core values and decision-making', 250),
  (4, 4, 'Communication Skills', 'Clear expression and listening', 450),
  (5, 5, 'Problem Decomposition', 'Breaking down complex problems', 700),
  (6, 6, 'Creative Thinking', 'Imaginative solutions', 1000)
ON CONFLICT (id) DO NOTHING;
