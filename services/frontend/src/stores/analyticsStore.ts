import { create } from 'zustand';

export interface AnalyticsEvent {
  id: string;
  event: string;
  properties: Record<string, any>;
  timestamp: string;
  sessionId: string;
  userId?: string;
  page?: string;
}

export interface UserSession {
  id: string;
  userId?: string;
  startTime: string;
  endTime?: string;
  pageViews: number;
  events: number;
  duration?: number;
}

export interface AnalyticsData {
  totalUsers: number;
  activeUsers: number;
  totalSessions: number;
  avgSessionDuration: number;
  pageViews: number;
  topPages: Array<{ page: string; views: number; percentage: number }>;
  userEngagement: {
    bounceRate: number;
    avgTimeOnSite: number;
    pagesPerSession: number;
  };
  conversionMetrics: {
    registrationRate: number;
    subscriptionRate: number;
    lessonCompletionRate: number;
  };
  realtimeUsers: number;
  performanceMetrics: {
    avgLoadTime: number;
    errorRate: number;
    apiResponseTime: number;
  };
}

interface AnalyticsStore {
  events: AnalyticsEvent[];
  currentSession: UserSession | null;
  analyticsData: AnalyticsData | null;
  isLoading: boolean;
  error: string | null;

  // Actions
  trackEvent: (event: string, properties?: Record<string, any>) => void;
  trackPageView: (page: string, properties?: Record<string, any>) => void;
  startSession: (userId?: string) => void;
  endSession: () => void;
  loadAnalytics: (dateRange?: { start: string; end: string }) => Promise<void>;
  sendEvents: () => Promise<void>;
}

export const useAnalyticsStore = create<AnalyticsStore>((set, get) => ({
  events: [],
  currentSession: null,
  analyticsData: null,
  isLoading: false,
  error: null,

  trackEvent: (event: string, properties: Record<string, any> = {}) => {
    const { currentSession } = get();
    
    const analyticsEvent: AnalyticsEvent = {
      id: `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      event,
      properties: {
        ...properties,
        userAgent: navigator.userAgent,
        url: window.location.href,
        referrer: document.referrer,
        timestamp: new Date().toISOString(),
      },
      timestamp: new Date().toISOString(),
      sessionId: currentSession?.id || 'anonymous',
      userId: currentSession?.userId,
      page: window.location.pathname,
    };

    set(state => ({
      events: [...state.events, analyticsEvent],
      currentSession: currentSession ? {
        ...currentSession,
        events: currentSession.events + 1
      } : null
    }));

    // Send event immediately if online, otherwise queue for later
    if (navigator.onLine) {
      get().sendEvents();
    } else {
      // Store in localStorage for offline sync
      const offlineEvents = JSON.parse(localStorage.getItem('offline_analytics') || '[]');
      offlineEvents.push(analyticsEvent);
      localStorage.setItem('offline_analytics', JSON.stringify(offlineEvents));
    }
  },

  trackPageView: (page: string, properties: Record<string, any> = {}) => {
    const { trackEvent, currentSession } = get();
    
    trackEvent('page_view', {
      page,
      title: document.title,
      ...properties
    });

    // Update session page views
    if (currentSession) {
      set(state => ({
        currentSession: state.currentSession ? {
          ...state.currentSession,
          pageViews: state.currentSession.pageViews + 1
        } : null
      }));
    }
  },

  startSession: (userId?: string) => {
    const sessionId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    const session: UserSession = {
      id: sessionId,
      userId,
      startTime: new Date().toISOString(),
      pageViews: 0,
      events: 0
    };

    set({ currentSession: session });

    // Track session start
    get().trackEvent('session_start', {
      sessionId,
      userId
    });
  },

  endSession: () => {
    const { currentSession, trackEvent } = get();
    
    if (currentSession) {
      const endTime = new Date().toISOString();
      const duration = new Date(endTime).getTime() - new Date(currentSession.startTime).getTime();
      
      const updatedSession = {
        ...currentSession,
        endTime,
        duration
      };

      // Track session end
      trackEvent('session_end', {
        sessionId: currentSession.id,
        duration,
        pageViews: currentSession.pageViews,
        events: currentSession.events
      });

      set({ currentSession: null });
    }
  },

  loadAnalytics: async (dateRange?: { start: string; end: string }) => {
    set({ isLoading: true, error: null });

    try {
      const params = new URLSearchParams();
      if (dateRange) {
        params.append('start', dateRange.start);
        params.append('end', dateRange.end);
      }

      const response = await fetch(`/api/analytics/dashboard?${params}`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('access_token')}`
        }
      });

      if (!response.ok) throw new Error('Failed to load analytics');

      const data = await response.json();
      set({ analyticsData: data, isLoading: false });
    } catch (error) {
      console.error('Failed to load analytics:', error);
      set({ error: 'Failed to load analytics data', isLoading: false });
    }
  },

  sendEvents: async () => {
    const { events } = get();
    
    if (events.length === 0) return;

    try {
      const response = await fetch('/api/analytics/events', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('access_token')}`
        },
        body: JSON.stringify({ events })
      });

      if (response.ok) {
        // Clear sent events
        set({ events: [] });
        
        // Also clear offline events if any
        const offlineEvents = JSON.parse(localStorage.getItem('offline_analytics') || '[]');
        if (offlineEvents.length > 0) {
          localStorage.removeItem('offline_analytics');
        }
      }
    } catch (error) {
      console.error('Failed to send analytics events:', error);
    }
  },
}));

// Auto-track common events
export const initializeAnalytics = () => {
  const { startSession, trackPageView, endSession } = useAnalyticsStore.getState();
  
  // Start session
  const userId = localStorage.getItem('user_id');
  startSession(userId || undefined);

  // Track initial page view
  trackPageView(window.location.pathname);

  // Track page changes (for SPA navigation)
  let lastPathname = window.location.pathname;
  const observer = new MutationObserver(() => {
    if (window.location.pathname !== lastPathname) {
      lastPathname = window.location.pathname;
      trackPageView(window.location.pathname);
    }
  });
  
  observer.observe(document, { subtree: true, childList: true });

  // Track performance metrics
  window.addEventListener('load', () => {
    setTimeout(() => {
      const navigation = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;
      useAnalyticsStore.getState().trackEvent('performance', {
        loadTime: navigation.loadEventEnd - navigation.fetchStart,
        domContentLoaded: navigation.domContentLoadedEventEnd - navigation.fetchStart,
        firstPaint: performance.getEntriesByName('first-paint')[0]?.startTime || 0,
        firstContentfulPaint: performance.getEntriesByName('first-contentful-paint')[0]?.startTime || 0,
      });
    }, 1000);
  });

  // Track errors
  window.addEventListener('error', (event) => {
    useAnalyticsStore.getState().trackEvent('javascript_error', {
      message: event.message,
      filename: event.filename,
      lineno: event.lineno,
      colno: event.colno,
      stack: event.error?.stack
    });
  });

  // Track unhandled promise rejections
  window.addEventListener('unhandledrejection', (event) => {
    useAnalyticsStore.getState().trackEvent('unhandled_rejection', {
      reason: event.reason?.toString(),
      stack: event.reason?.stack
    });
  });

  // End session on page unload
  window.addEventListener('beforeunload', () => {
    endSession();
  });

  // Send events periodically
  setInterval(() => {
    useAnalyticsStore.getState().sendEvents();
  }, 30000); // Every 30 seconds
};