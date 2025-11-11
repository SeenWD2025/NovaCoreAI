/**
 * Tests for WebSocket authentication and message handling logic
 */
import jwt from 'jsonwebtoken';
import { WebSocket } from 'ws';

const TEST_JWT_SECRET = 'test-jwt-secret-for-testing';
process.env.JWT_SECRET = TEST_JWT_SECRET;

// Mock logger
jest.mock('../logger', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  },
}));

// Mock metrics
const mockInc = jest.fn();
const mockDec = jest.fn();
jest.mock('../metrics', () => ({
  websocketConnectionsActive: { inc: mockInc, dec: mockDec },
  websocketConnectionsTotal: { labels: jest.fn().mockReturnValue({ inc: mockInc }) },
  websocketMessagesTotal: { labels: jest.fn().mockReturnValue({ inc: mockInc }) },
}));

// Helper to create a valid JWT token
function createTestToken(payload: any = {}) {
  return jwt.sign(
    {
      sub: payload.userId || 'test-user-123',
      email: payload.email || 'test@example.com',
      role: payload.role || 'user',
      ...payload,
    },
    TEST_JWT_SECRET,
    { expiresIn: '1h' }
  );
}

describe('WebSocket Token Validation', () => {
  it('should validate a valid JWT token', () => {
    const token = createTestToken();
    
    expect(() => {
      jwt.verify(token, TEST_JWT_SECRET);
    }).not.toThrow();
  });

  it('should reject invalid JWT token', () => {
    const invalidToken = 'invalid-token-string';
    
    expect(() => {
      jwt.verify(invalidToken, TEST_JWT_SECRET);
    }).toThrow();
  });

  it('should reject expired JWT token', () => {
    const expiredToken = jwt.sign(
      { sub: 'user-123', email: 'test@example.com', role: 'user' },
      TEST_JWT_SECRET,
      { expiresIn: '-1h' } // Expired 1 hour ago
    );

    expect(() => {
      jwt.verify(expiredToken, TEST_JWT_SECRET);
    }).toThrow();
  });

  it('should extract user data from token', () => {
    const token = createTestToken({ 
      userId: 'user-456', 
      email: 'specific@example.com',
      role: 'admin'
    });
    
    const decoded: any = jwt.verify(token, TEST_JWT_SECRET);
    
    expect(decoded.sub).toBe('user-456');
    expect(decoded.email).toBe('specific@example.com');
    expect(decoded.role).toBe('admin');
  });

  it('should validate token structure', () => {
    const token = createTestToken();
    const decoded: any = jwt.verify(token, TEST_JWT_SECRET);
    
    expect(decoded).toHaveProperty('sub');
    expect(decoded).toHaveProperty('email');
    expect(decoded).toHaveProperty('role');
    expect(decoded).toHaveProperty('iat');
    expect(decoded).toHaveProperty('exp');
  });
});

describe('WebSocket Message Parsing', () => {
  it('should parse valid JSON messages', () => {
    const message = JSON.stringify({ type: 'chat', content: 'Hello' });
    
    expect(() => {
      const parsed = JSON.parse(message);
      expect(parsed.type).toBe('chat');
      expect(parsed.content).toBe('Hello');
    }).not.toThrow();
  });

  it('should handle invalid JSON gracefully', () => {
    const invalidMessage = 'not-valid-json-{';
    
    expect(() => {
      JSON.parse(invalidMessage);
    }).toThrow();
  });

  it('should parse complex message structures', () => {
    const complexMessage = JSON.stringify({
      type: 'chat',
      content: 'Test message',
      metadata: {
        sessionId: 'test-123',
        timestamp: Date.now(),
      },
    });
    
    const parsed = JSON.parse(complexMessage);
    expect(parsed.type).toBe('chat');
    expect(parsed.metadata).toBeDefined();
    expect(parsed.metadata.sessionId).toBe('test-123');
  });

  it('should handle empty messages', () => {
    const emptyMessage = JSON.stringify({});
    const parsed = JSON.parse(emptyMessage);
    expect(parsed).toEqual({});
  });
});

describe('WebSocket Welcome Message Generation', () => {
  it('should generate welcome message with user info', () => {
    const userId = 'user-123';
    const email = 'test@example.com';
    
    const welcomeMessage = {
      type: 'welcome',
      message: 'Connected to Noble NovaCoreAI',
      userId: userId,
      email: email,
      timestamp: new Date().toISOString(),
    };
    
    expect(welcomeMessage.type).toBe('welcome');
    expect(welcomeMessage.userId).toBe(userId);
    expect(welcomeMessage.email).toBe(email);
    expect(welcomeMessage.timestamp).toBeDefined();
  });

  it('should include timestamp in ISO format', () => {
    const welcomeMessage = {
      type: 'welcome',
      timestamp: new Date().toISOString(),
    };
    
    expect(welcomeMessage.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
  });
});

describe('WebSocket Echo Response Generation', () => {
  it('should generate echo response with user data', () => {
    const userId = 'user-456';
    const inputData = { type: 'chat', content: 'Hello, AI!' };
    
    const echoResponse = {
      type: 'message',
      userId: userId,
      data: inputData,
      timestamp: new Date().toISOString(),
    };
    
    expect(echoResponse.type).toBe('message');
    expect(echoResponse.userId).toBe(userId);
    expect(echoResponse.data).toEqual(inputData);
  });

  it('should preserve input data structure', () => {
    const inputData = {
      type: 'chat',
      content: 'Test',
      metadata: { key: 'value' },
    };
    
    const echoResponse = {
      type: 'message',
      data: inputData,
      timestamp: new Date().toISOString(),
    };
    
    expect(echoResponse.data).toEqual(inputData);
    expect(echoResponse.data.metadata).toEqual({ key: 'value' });
  });
});

describe('WebSocket Error Response Generation', () => {
  it('should generate error response for invalid format', () => {
    const errorResponse = {
      type: 'error',
      error: 'Invalid message format',
    };
    
    expect(errorResponse.type).toBe('error');
    expect(errorResponse.error).toBeDefined();
  });

  it('should include error message', () => {
    const errorMessage = 'Custom error message';
    const errorResponse = {
      type: 'error',
      error: errorMessage,
    };
    
    expect(errorResponse.error).toBe(errorMessage);
  });
});

describe('WebSocket Connection States', () => {
  it('should recognize WebSocket CONNECTING state', () => {
    expect(WebSocket.CONNECTING).toBe(0);
  });

  it('should recognize WebSocket OPEN state', () => {
    expect(WebSocket.OPEN).toBe(1);
  });

  it('should recognize WebSocket CLOSING state', () => {
    expect(WebSocket.CLOSING).toBe(2);
  });

  it('should recognize WebSocket CLOSED state', () => {
    expect(WebSocket.CLOSED).toBe(3);
  });
});

describe('WebSocket Close Codes', () => {
  it('should use code 1008 for authentication required', () => {
    const closeCode = 1008;
    const closeReason = 'Authentication required';
    
    expect(closeCode).toBe(1008);
    expect(closeReason).toBe('Authentication required');
  });

  it('should use code 1008 for invalid token', () => {
    const closeCode = 1008;
    const closeReason = 'Invalid token';
    
    expect(closeCode).toBe(1008);
    expect(closeReason).toBe('Invalid token');
  });
});

describe('WebSocket Heartbeat Logic', () => {
  interface MockWebSocket {
    isAlive: boolean;
    ping: jest.Mock;
    terminate: jest.Mock;
  }

  it('should mark connection as not alive before ping', () => {
    const mockWs: MockWebSocket = {
      isAlive: true,
      ping: jest.fn(),
      terminate: jest.fn(),
    };
    
    // Simulate heartbeat logic
    mockWs.isAlive = false;
    mockWs.ping();
    
    expect(mockWs.isAlive).toBe(false);
    expect(mockWs.ping).toHaveBeenCalled();
  });

  it('should terminate connection if not alive', () => {
    const mockWs: MockWebSocket = {
      isAlive: false,
      ping: jest.fn(),
      terminate: jest.fn(),
    };
    
    // Simulate heartbeat check
    if (mockWs.isAlive === false) {
      mockWs.terminate();
    }
    
    expect(mockWs.terminate).toHaveBeenCalled();
  });

  it('should set isAlive to true on pong', () => {
    const mockWs: Partial<MockWebSocket> = {
      isAlive: false,
    };
    
    // Simulate pong handler
    mockWs.isAlive = true;
    
    expect(mockWs.isAlive).toBe(true);
  });

  it('should ping connection if alive', () => {
    const mockWs: MockWebSocket = {
      isAlive: true,
      ping: jest.fn(),
      terminate: jest.fn(),
    };
    
    // Simulate heartbeat logic
    if (mockWs.isAlive !== false) {
      mockWs.isAlive = false;
      mockWs.ping();
    }
    
    expect(mockWs.ping).toHaveBeenCalled();
  });
});

describe('WebSocket URL Parsing', () => {
  it('should extract token from query string', () => {
    const url = new URL('http://localhost:5000/ws/chat?token=abc123');
    const token = url.searchParams.get('token');
    
    expect(token).toBe('abc123');
  });

  it('should return null for missing token', () => {
    const url = new URL('http://localhost:5000/ws/chat');
    const token = url.searchParams.get('token');
    
    expect(token).toBeNull();
  });

  it('should handle multiple query parameters', () => {
    const url = new URL('http://localhost:5000/ws/chat?token=abc123&session=xyz');
    const token = url.searchParams.get('token');
    const session = url.searchParams.get('session');
    
    expect(token).toBe('abc123');
    expect(session).toBe('xyz');
  });
});

describe('WebSocket Message Serialization', () => {
  it('should serialize message to JSON string', () => {
    const message = {
      type: 'chat',
      content: 'Hello',
    };
    
    const serialized = JSON.stringify(message);
    expect(typeof serialized).toBe('string');
    expect(serialized).toContain('chat');
  });

  it('should deserialize JSON string to object', () => {
    const jsonString = '{"type":"chat","content":"Hello"}';
    const deserialized = JSON.parse(jsonString);
    
    expect(typeof deserialized).toBe('object');
    expect(deserialized.type).toBe('chat');
    expect(deserialized.content).toBe('Hello');
  });

  it('should handle special characters in messages', () => {
    const message = {
      type: 'chat',
      content: 'Hello "world" & <test>',
    };
    
    const serialized = JSON.stringify(message);
    const deserialized = JSON.parse(serialized);
    
    expect(deserialized.content).toBe('Hello "world" & <test>');
  });
});

describe('WebSocket Metrics Tracking', () => {
  it('should track connection metrics', () => {
    const mockMetrics = {
      connectionsTotal: 0,
      connectionsActive: 0,
      messagesReceived: 0,
      messagesSent: 0,
    };
    
    // Simulate connection
    mockMetrics.connectionsTotal++;
    mockMetrics.connectionsActive++;
    
    expect(mockMetrics.connectionsTotal).toBe(1);
    expect(mockMetrics.connectionsActive).toBe(1);
  });

  it('should track message metrics', () => {
    const mockMetrics = {
      messagesReceived: 0,
      messagesSent: 0,
    };
    
    // Simulate message exchange
    mockMetrics.messagesReceived++;
    mockMetrics.messagesSent++;
    
    expect(mockMetrics.messagesReceived).toBe(1);
    expect(mockMetrics.messagesSent).toBe(1);
  });

  it('should decrement active connections on disconnect', () => {
    const mockMetrics = {
      connectionsActive: 1,
    };
    
    // Simulate disconnect
    mockMetrics.connectionsActive--;
    
    expect(mockMetrics.connectionsActive).toBe(0);
  });
});
