import { create } from 'zustand';
import axios from 'axios';
import type { User } from '@/types/auth';
import authService from '@/services/auth';

interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
  
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  loadUser: () => Promise<void>;
  clearError: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  isAuthenticated: authService.isAuthenticated(),
  isLoading: false,
  error: null,

  login: async (email: string, password: string) => {
    set({ isLoading: true, error: null });
    try {
      const response = await authService.login({ email, password });
      set({ 
        user: response.user, 
        isAuthenticated: true, 
        isLoading: false 
      });
    } catch (error: unknown) {
      if (axios.isAxiosError(error)) {
        const errorMessage = error.response?.data?.message || 'Login failed';
        set({ 
          error: errorMessage, 
          isLoading: false, 
          isAuthenticated: false 
        });
      } else {
        set({ 
          error: 'Login failed', 
          isLoading: false, 
          isAuthenticated: false 
        });
      }
      throw error;
    }
  },

  register: async (email: string, password: string) => {
    console.log('📝 Auth store: Starting registration for', email);
    set({ isLoading: true, error: null });
    try {
      const response = await authService.register({ email, password });
      console.log('✅ Auth store: Registration successful', response);
      set({ 
        user: response.user, 
        isAuthenticated: true, 
        isLoading: false 
      });
    } catch (error: unknown) {
      console.error('❌ Auth store: Registration failed', error);
      let errorMessage = 'Registration failed';
      
      if (axios.isAxiosError(error)) {
        errorMessage = error.response?.data?.message ?? error.message;
      }
      
      set({ 
        error: errorMessage, 
        isLoading: false, 
        isAuthenticated: false 
      });
      throw error;
    }
  },

  logout: async () => {
    set({ isLoading: true });
    try {
      await authService.logout();
      set({ 
        user: null, 
        isAuthenticated: false, 
        isLoading: false, 
        error: null 
      });
    } catch {
      // Still clear state even if API call fails
      set({ 
        user: null, 
        isAuthenticated: false, 
        isLoading: false 
      });
    }
  },

  loadUser: async () => {
    if (!authService.isAuthenticated()) {
      set({ isAuthenticated: false, user: null });
      return;
    }

    set({ isLoading: true });
    try {
      const user = await authService.getCurrentUser();
      set({ user, isAuthenticated: true, isLoading: false });
    } catch {
      // Token might be invalid, clear auth state
      set({ 
        user: null, 
        isAuthenticated: false, 
        isLoading: false 
      });
    }
  },

  clearError: () => set({ error: null }),
}));
