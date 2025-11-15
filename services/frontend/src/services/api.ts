import axios from 'axios';
import type {
  AxiosError,
  AxiosResponse,
  InternalAxiosRequestConfig,
} from 'axios';

const DEFAULT_BASE_PATH = '/api';

const resolveApiBaseUrl = () => {
  if (import.meta.env.DEV) {
    // When running the Vite dev server, stay on the same origin and let the
    // dev proxy forward calls to the gateway container.
    return DEFAULT_BASE_PATH;
  }

  const raw = import.meta.env.VITE_API_URL;

  if (!raw) {
    return `http://localhost:5000${DEFAULT_BASE_PATH}`;
  }

  try {
    const parsed = new URL(raw);

    if (!parsed.pathname || parsed.pathname === '/') {
      parsed.pathname = DEFAULT_BASE_PATH;
    }

    // Ensure we do not end with a trailing slash to avoid double slashes when
    // axios appends request paths.
    return parsed.toString().replace(/\/$/, '');
  } catch (error) {
    const sanitized = raw.replace(/\/$/, '');
    if (sanitized.startsWith('http')) {
      return sanitized.includes(DEFAULT_BASE_PATH)
        ? sanitized
        : `${sanitized}${DEFAULT_BASE_PATH}`;
    }
    return sanitized || DEFAULT_BASE_PATH;
  }
};

const API_URL = resolveApiBaseUrl();

export const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 30000,
});

// Request interceptor to add auth token
api.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    const token = localStorage.getItem('access_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error: AxiosError) => Promise.reject(error)
);

// Response interceptor for error handling and token refresh
api.interceptors.response.use(
  (response: AxiosResponse) => response,
  async (error: AxiosError) => {
    const originalRequest = error.config as InternalAxiosRequestConfig & {
      _retry?: boolean;
    };

    // If 401 and not already retrying, attempt to refresh token
    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;

      try {
        const refreshToken = localStorage.getItem('refresh_token');
        if (refreshToken) {
          const response = await axios.post(`${API_URL}/auth/refresh`, {
            refresh_token: refreshToken,
          });

          // Handle both camelCase and snake_case response formats
          const accessToken = response.data.access_token || response.data.accessToken;
          localStorage.setItem('access_token', accessToken);

          // Retry original request with new token
          originalRequest.headers.Authorization = `Bearer ${accessToken}`;
          return api(originalRequest);
        }
      } catch (refreshError) {
        // Refresh failed, clear tokens and redirect to login
        localStorage.removeItem('access_token');
        localStorage.removeItem('refresh_token');
        window.location.href = '/login';
        return Promise.reject(refreshError);
      }
    }

    return Promise.reject(error);
  }
);

export default api;
