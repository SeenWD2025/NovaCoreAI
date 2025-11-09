import { useState, useEffect, useRef } from 'react';
import { Send, Bot, User, Loader, Brain, MessageSquare, Sparkles } from 'lucide-react';
import type { Message } from '@/types/chat';
import chatService from '@/services/chat';

export default function Chat() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Create a new session on mount
    createSession();
  }, []);

  useEffect(() => {
    // Scroll to bottom when messages change
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const createSession = async () => {
    try {
      const session = await chatService.createSession();
      setSessionId(session.id);
    } catch (error) {
      console.error('Failed to create session:', error);
    }
  };

  const handleSend = async () => {
    if (!input.trim() || isLoading) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      session_id: sessionId || '',
      role: 'user',
      content: input,
      timestamp: new Date().toISOString(),
    };

    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

    try {
      const response = await chatService.sendMessage(input, sessionId || undefined);
      setMessages(prev => [...prev, response]);
    } catch (error: any) {
      console.error('Failed to send message:', error);
      const errorMessage: Message = {
        id: Date.now().toString(),
        session_id: sessionId || '',
        role: 'assistant',
        content: 'Sorry, I encountered an error. Please try again.',
        timestamp: new Date().toISOString(),
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="max-w-5xl mx-auto h-[calc(100vh-8rem)] flex flex-col">
      {/* Header */}
      <div className="card mb-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
              <MessageSquare size={28} className="text-primary-800" />
              AI Assistant
            </h1>
            <p className="text-sm text-gray-600 mt-1">
              Chat with memory-enabled AI for personalized assistance
            </p>
          </div>
          <div className="flex items-center gap-2">
            <div className="p-2 bg-accent-100 rounded-lg">
              <Brain size={24} className="text-accent-700" />
            </div>
            <div className="text-sm">
              <div className="font-medium text-gray-900">Memory Active</div>
              <div className="text-gray-500">Context-aware responses</div>
            </div>
          </div>
        </div>
      </div>

      {/* Chat Messages */}
      <div className="card flex-1 overflow-hidden flex flex-col">
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {messages.length === 0 && (
            <div className="text-center py-12">
              <div className="inline-flex p-4 bg-primary-100 rounded-full mb-4">
                <Sparkles size={48} className="text-primary-800" />
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-2">Start a Conversation</h3>
              <p className="text-gray-600 max-w-md mx-auto">
                Ask me anything! I have access to your learning progress and memories to provide personalized assistance.
              </p>
              <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-3 max-w-2xl mx-auto text-sm">
                <button
                  onClick={() => setInput("What should I learn next?")}
                  className="p-3 bg-gray-50 hover:bg-gray-100 rounded-lg text-left transition-colors"
                >
                  💡 What should I learn next?
                </button>
                <button
                  onClick={() => setInput("Explain my current level progress")}
                  className="p-3 bg-gray-50 hover:bg-gray-100 rounded-lg text-left transition-colors"
                >
                  📊 Explain my current level progress
                </button>
                <button
                  onClick={() => setInput("Help me with a reflection")}
                  className="p-3 bg-gray-50 hover:bg-gray-100 rounded-lg text-left transition-colors"
                >
                  ✍️ Help me with a reflection
                </button>
                <button
                  onClick={() => setInput("What are agent creation capabilities?")}
                  className="p-3 bg-gray-50 hover:bg-gray-100 rounded-lg text-left transition-colors"
                >
                  🤖 What are agent creation capabilities?
                </button>
              </div>
            </div>
          )}

          {messages.map((message) => (
            <div
              key={message.id}
              className={`flex items-start gap-3 ${
                message.role === 'user' ? 'flex-row-reverse' : ''
              }`}
            >
              {/* Avatar */}
              <div
                className={`flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center ${
                  message.role === 'user'
                    ? 'bg-primary-100'
                    : 'bg-accent-100'
                }`}
              >
                {message.role === 'user' ? (
                  <User size={20} className="text-primary-800" />
                ) : (
                  <Bot size={20} className="text-accent-700" />
                )}
              </div>

              {/* Message */}
              <div
                className={`flex-1 max-w-2xl ${
                  message.role === 'user' ? 'text-right' : ''
                }`}
              >
                <div
                  className={`inline-block p-4 rounded-lg ${
                    message.role === 'user'
                      ? 'bg-primary-800 text-white'
                      : 'bg-gray-100 text-gray-900'
                  }`}
                >
                  <p className="whitespace-pre-wrap">{message.content}</p>
                </div>
                <div className="text-xs text-gray-500 mt-1 px-1">
                  {new Date(message.timestamp).toLocaleTimeString()}
                </div>
              </div>
            </div>
          ))}

          {isLoading && (
            <div className="flex items-start gap-3">
              <div className="flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center bg-accent-100">
                <Bot size={20} className="text-accent-700" />
              </div>
              <div className="flex-1">
                <div className="inline-block p-4 rounded-lg bg-gray-100">
                  <div className="flex items-center gap-2">
                    <Loader size={16} className="animate-spin text-gray-600" />
                    <span className="text-gray-600">Thinking...</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Input Area */}
        <div className="border-t border-gray-200 p-4">
          <div className="flex items-end gap-3">
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="Type your message... (Shift+Enter for new line)"
              className="flex-1 resize-none px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 max-h-32"
              rows={2}
              disabled={isLoading}
            />
            <button
              onClick={handleSend}
              disabled={isLoading || !input.trim()}
              className="btn-primary px-6 py-3 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              <Send size={20} />
              <span>Send</span>
            </button>
          </div>
          <div className="text-xs text-gray-500 mt-2">
            💡 Tip: I can access your learning history and provide personalized guidance
          </div>
        </div>
      </div>
    </div>
  );
}
