import { useEffect, useCallback } from 'react';
import { useAuthStore } from '@/stores/authStore';
import { useNotificationStore } from '@/stores/notificationStore';

interface PushNotificationOptions {
  onPermissionGranted?: () => void;
  onPermissionDenied?: () => void;
  onNotificationReceived?: (notification: NotificationEvent) => void;
  vapidKey?: string;
}

export const usePushNotifications = (options: PushNotificationOptions = {}) => {
  const { 
    onPermissionGranted, 
    onPermissionDenied, 
    onNotificationReceived,
    vapidKey = process.env.VITE_VAPID_PUBLIC_KEY 
  } = options;
  
  const { isAuthenticated, user } = useAuthStore();
  const { addNotification } = useNotificationStore();

  // Check if push notifications are supported
  const isSupported = 'serviceWorker' in navigator && 'PushManager' in window;

  // Get current permission status
  const getPermissionStatus = useCallback((): NotificationPermission => {
    return Notification.permission;
  }, []);

  // Request notification permission
  const requestPermission = useCallback(async (): Promise<NotificationPermission> => {
    if (!isSupported) {
      throw new Error('Push notifications are not supported');
    }

    try {
      const permission = await Notification.requestPermission();
      
      if (permission === 'granted') {
        onPermissionGranted?.();
      } else if (permission === 'denied') {
        onPermissionDenied?.();
      }
      
      return permission;
    } catch (error) {
      console.error('Failed to request notification permission:', error);
      throw error;
    }
  }, [isSupported, onPermissionGranted, onPermissionDenied]);

  // Subscribe to push notifications
  const subscribe = useCallback(async (): Promise<PushSubscription | null> => {
    if (!isSupported || !isAuthenticated) {
      return null;
    }

    try {
      // Ensure we have permission
      const permission = await requestPermission();
      if (permission !== 'granted') {
        throw new Error('Notification permission not granted');
      }

      // Get service worker registration
      const registration = await navigator.serviceWorker.getRegistration();
      if (!registration) {
        throw new Error('Service worker not registered');
      }

      // Subscribe to push notifications
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: vapidKey
      });

      // Send subscription to server
      if (subscription) {
        await sendSubscriptionToServer(subscription);
      }

      return subscription;
    } catch (error) {
      console.error('Failed to subscribe to push notifications:', error);
      throw error;
    }
  }, [isSupported, isAuthenticated, vapidKey, requestPermission]);

  // Unsubscribe from push notifications
  const unsubscribe = useCallback(async (): Promise<boolean> => {
    if (!isSupported) {
      return false;
    }

    try {
      const registration = await navigator.serviceWorker.getRegistration();
      if (!registration) {
        return false;
      }

      const subscription = await registration.pushManager.getSubscription();
      if (!subscription) {
        return true; // Already unsubscribed
      }

      // Unsubscribe from push manager
      const unsubscribed = await subscription.unsubscribe();

      // Remove subscription from server
      if (unsubscribed) {
        await removeSubscriptionFromServer(subscription);
      }

      return unsubscribed;
    } catch (error) {
      console.error('Failed to unsubscribe from push notifications:', error);
      throw error;
    }
  }, [isSupported]);

  // Check if currently subscribed
  const isSubscribed = useCallback(async (): Promise<boolean> => {
    if (!isSupported) {
      return false;
    }

    try {
      const registration = await navigator.serviceWorker.getRegistration();
      if (!registration) {
        return false;
      }

      const subscription = await registration.pushManager.getSubscription();
      return !!subscription;
    } catch (error) {
      console.error('Failed to check subscription status:', error);
      return false;
    }
  }, [isSupported]);

  // Send subscription to server
  const sendSubscriptionToServer = async (subscription: PushSubscription) => {
    try {
      await fetch('/api/notifications/subscribe', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('access_token')}`
        },
        body: JSON.stringify({
          subscription: subscription.toJSON(),
          userId: user?.id
        })
      });
    } catch (error) {
      console.error('Failed to send subscription to server:', error);
      throw error;
    }
  };

  // Remove subscription from server
  const removeSubscriptionFromServer = async (subscription: PushSubscription) => {
    try {
      await fetch('/api/notifications/unsubscribe', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('access_token')}`
        },
        body: JSON.stringify({
          subscription: subscription.toJSON()
        })
      });
    } catch (error) {
      console.error('Failed to remove subscription from server:', error);
      throw error;
    }
  };

  // Send a test notification
  const sendTestNotification = useCallback(async () => {
    if (!isSupported || getPermissionStatus() !== 'granted') {
      throw new Error('Notifications not available or permission not granted');
    }

    try {
      await fetch('/api/notifications/test', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('access_token')}`
        },
        body: JSON.stringify({
          userId: user?.id
        })
      });
    } catch (error) {
      console.error('Failed to send test notification:', error);
      throw error;
    }
  }, [isSupported, user?.id, getPermissionStatus]);

  // Initialize push notifications when component mounts
  useEffect(() => {
    if (!isSupported || !isAuthenticated) {
      return;
    }

    // Listen for push events from service worker
    const handleMessage = (event: MessageEvent) => {
      if (event.data && event.data.type === 'PUSH_RECEIVED') {
        addNotification({
          type: 'info',
          title: event.data.title || 'New Notification',
          message: event.data.body
        });
        
        onNotificationReceived?.(event.data);
      }
    };

    navigator.serviceWorker?.addEventListener('message', handleMessage);

    return () => {
      navigator.serviceWorker?.removeEventListener('message', handleMessage);
    };
  }, [isSupported, isAuthenticated, addNotification, onNotificationReceived]);

  return {
    isSupported,
    getPermissionStatus,
    requestPermission,
    subscribe,
    unsubscribe,
    isSubscribed,
    sendTestNotification
  };
};

// Hook for managing notification settings
export const useNotificationSettings = () => {
  const { subscribe, unsubscribe, isSubscribed, getPermissionStatus } = usePushNotifications();

  // Toggle notification subscription
  const toggleSubscription = useCallback(async (): Promise<boolean> => {
    const subscribed = await isSubscribed();
    
    if (subscribed) {
      await unsubscribe();
      return false;
    } else {
      const permission = getPermissionStatus();
      if (permission === 'default') {
        // Will request permission automatically
      } else if (permission === 'denied') {
        throw new Error('Notifications are blocked. Please enable them in your browser settings.');
      }
      
      await subscribe();
      return true;
    }
  }, [subscribe, unsubscribe, isSubscribed, getPermissionStatus]);

  return {
    toggleSubscription,
    isSubscribed,
    getPermissionStatus
  };
};