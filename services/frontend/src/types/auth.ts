// TypeScript types for Authentication

export interface User {
  id: string;
  email: string;
  email_verified?: boolean;
  role: 'student' | 'subscriber' | 'admin';
  subscription_tier: 'free_trial' | 'basic' | 'pro';
  trial_ends_at?: string;
  created_at: string;
  updated_at: string;
}

export interface LoginCredentials {
  email: string;
  password: string;
}

export interface RegisterCredentials {
  email: string;
  password: string;
  confirmPassword?: string;
}

export interface AuthResponse {
  access_token: string;
  refresh_token: string;
  user: User;
}

export interface Subscription {
  id: string;
  user_id: string;
  stripe_subscription_id?: string;
  stripe_customer_id?: string;
  status: 'active' | 'canceled' | 'past_due' | 'trialing';
  tier: 'free' | 'basic' | 'pro';
  current_period_start?: string;
  current_period_end?: string;
  created_at: string;
  updated_at: string;
}
