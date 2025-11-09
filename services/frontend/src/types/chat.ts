// TypeScript types for Chat Interface

export interface Message {
  id: string;
  session_id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: string;
  tokens_used?: number;
  memories_used?: string[];
}

export interface ChatSession {
  id: string;
  user_id: string;
  status: 'active' | 'completed' | 'abandoned';
  model_name?: string;
  created_at: string;
  ended_at?: string;
}

export interface Memory {
  id: string;
  user_id: string;
  session_id?: string;
  type: 'lesson' | 'task' | 'conversation' | 'error' | 'reflection';
  input_context: string;
  output_response: string;
  outcome: 'success' | 'failure' | 'neutral';
  emotional_weight?: number;
  confidence_score?: number;
  constitution_valid: boolean;
  tags?: string[];
  tier: 'stm' | 'itm' | 'ltm';
  access_count: number;
  last_accessed_at?: string;
  created_at: string;
  expires_at?: string;
}

export interface MemorySearchResult {
  memories: Memory[];
  count: number;
  query: string;
}
