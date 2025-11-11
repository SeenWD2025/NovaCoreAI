import api from './api';
import type { AuthResponse, LoginCredentials, RegisterCredentials, User } from '@/types/auth';

interface BackendAuthResponse {
  user: User;
  accessToken: string;
  refreshToken: string;
}

export const authService = {
  // Register a new user
  register: async (credentials: RegisterCredentials): Promise<AuthResponse> => {
    console.log('🚀 Registration attempt with:', { email: credentials.email });
    
    try {
      const response = await api.post<BackendAuthResponse>('/auth/register', {
        email: credentials.email,
        password: credentials.password,
      });
      
      console.log('✅ Registration response received:', response.status, response.data);
      
      // Handle both camelCase and snake_case token formats
      const accessToken = response.data.accessToken;
      const refreshToken = response.data.refreshToken;
      
      console.log('🔑 Storing tokens...');
      
      // Store tokens
      localStorage.setItem('access_token', accessToken);
      localStorage.setItem('refresh_token', refreshToken);
      
      return {
        access_token: accessToken,
        refresh_token: refreshToken,
        user: response.data.user
      };
    } catch (error) {
      console.error('❌ Registration failed:', error);
      throw error;
    }
  },

  // Login user
  login: async (credentials: LoginCredentials): Promise<AuthResponse> => {
    const response = await api.post<BackendAuthResponse>('/auth/login', credentials);
    
    // Store tokens
    localStorage.setItem('access_token', response.data.accessToken);
    localStorage.setItem('refresh_token', response.data.refreshToken);
    
    return {
      access_token: response.data.accessToken,
      refresh_token: response.data.refreshToken,
      user: response.data.user
    };
  },

  // Logout user
  logout: async (): Promise<void> => {
    try {
      await api.post('/auth/logout');
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      // Clear tokens regardless of API response
      localStorage.removeItem('access_token');
      localStorage.removeItem('refresh_token');
    }
  },

  // Get current user
  getCurrentUser: async (): Promise<User> => {
    const response = await api.get<User>('/auth/me');
    return response.data;
  },

  // Check if user is authenticated
  isAuthenticated: (): boolean => {
    return !!localStorage.getItem('access_token');
  },

  // Get access token
  getAccessToken: (): string | null => {
    return localStorage.getItem('access_token');
  },
};

export default authService;
