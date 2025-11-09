import api from './api';
import type { Message, ChatSession, Memory, MemorySearchResult } from '@/types/chat';

export const chatService = {
  // Sessions
  getSessions: async (): Promise<{ sessions: ChatSession[]; count: number }> => {
    const response = await api.get('/chat/sessions');
    return response.data;
  },

  createSession: async (): Promise<ChatSession> => {
    const response = await api.post<ChatSession>('/chat/sessions');
    return response.data;
  },

  getSessionHistory: async (sessionId: string): Promise<{ messages: Message[]; count: number }> => {
    const response = await api.get(`/chat/history/${sessionId}`);
    return response.data;
  },

  // Messages (REST API for non-streaming)
  sendMessage: async (message: string, sessionId?: string): Promise<Message> => {
    const response = await api.post<Message>('/chat/message', {
      message,
      session_id: sessionId,
    });
    return response.data;
  },

  // WebSocket URL for streaming chat
  getWebSocketUrl: (): string => {
    const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:5000';
    const wsUrl = apiUrl.replace('http://', '').replace('https://', '');
    return `${wsProtocol}//${wsUrl}/ws/chat`;
  },
};

export const memoryService = {
  // Retrieve memories for context
  getMemories: async (params?: {
    tier?: 'stm' | 'itm' | 'ltm';
    limit?: number;
    session_id?: string;
  }): Promise<{ memories: Memory[]; count: number }> => {
    const response = await api.get('/memory/retrieve', { params });
    return response.data;
  },

  // Semantic search
  searchMemories: async (query: string, limit: number = 10): Promise<MemorySearchResult> => {
    const response = await api.post<MemorySearchResult>('/memory/search', {
      query,
      limit,
    });
    return response.data;
  },

  // Memory statistics
  getStats: async (): Promise<{
    total_memories: number;
    stm_count: number;
    itm_count: number;
    ltm_count: number;
    storage_used_mb: number;
    storage_limit_mb: number;
  }> => {
    const response = await api.get('/memory/stats');
    return response.data;
  },
};

export default chatService;
