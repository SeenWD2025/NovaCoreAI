import { useState, useEffect } from 'react';
import { 
  Bell, 
  BellOff, 
  Settings, 
  Shield, 
  Smartphone,
  Globe,
  Mail,
  MessageCircle,
  Volume2,
  VolumeX,
  Check,
  X
} from 'lucide-react';
import { useNotificationSettings } from '@/utils/usePushNotifications';
import { useAuthStore } from '@/stores/authStore';
import ErrorBoundary from '@/components/ErrorBoundary';
import Alert from '@/components/Alert';
import { ButtonLoading } from '@/components/LoadingSpinner';

interface NotificationPreferences {
  pushNotifications: boolean;
  emailNotifications: boolean;
  chatMessages: boolean;
  courseUpdates: boolean;
  achievementAlerts: boolean;
  weeklyDigest: boolean;
  maintenanceAlerts: boolean;
  soundEnabled: boolean;
  quietHours: {
    enabled: boolean;
    start: string;
    end: string;
  };
}

export default function NotificationSettings() {
  const { user } = useAuthStore();
  const { 
    toggleSubscription, 
    isSubscribed, 
    getPermissionStatus 
  } = useNotificationSettings();

  const [preferences, setPreferences] = useState<NotificationPreferences>({
    pushNotifications: false,
    emailNotifications: true,
    chatMessages: true,
    courseUpdates: true,
    achievementAlerts: true,
    weeklyDigest: false,
    maintenanceAlerts: true,
    soundEnabled: true,
    quietHours: {
      enabled: false,
      start: '22:00',
      end: '08:00'
    }
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [pushSubscribed, setPushSubscribed] = useState(false);
  const [permissionStatus, setPermissionStatus] = useState<NotificationPermission>('default');

  useEffect(() => {
    loadPreferences();
    checkPushStatus();
  }, []);

  const loadPreferences = async () => {
    try {
      const response = await fetch('/api/notifications/preferences', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('access_token')}`
        }
      });

      if (response.ok) {
        const data = await response.json();
        setPreferences(data.preferences || preferences);
      }
    } catch (error) {
      console.error('Failed to load notification preferences:', error);
    }
  };

  const checkPushStatus = async () => {
    try {
      const subscribed = await isSubscribed();
      const permission = getPermissionStatus();
      
      setPushSubscribed(subscribed);
      setPermissionStatus(permission);
      
      setPreferences(prev => ({
        ...prev,
        pushNotifications: subscribed
      }));
    } catch (error) {
      console.error('Failed to check push notification status:', error);
    }
  };

  const savePreferences = async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/notifications/preferences', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('access_token')}`
        },
        body: JSON.stringify({ preferences })
      });

      if (!response.ok) {
        throw new Error('Failed to save preferences');
      }

      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch (error) {
      console.error('Failed to save preferences:', error);
      setError('Failed to save notification preferences');
    } finally {
      setLoading(false);
    }
  };

  const handlePushToggle = async () => {
    setLoading(true);
    setError(null);

    try {
      if (permissionStatus === 'denied') {
        throw new Error('Push notifications are blocked. Please enable them in your browser settings and reload the page.');
      }

      const newSubscriptionStatus = await toggleSubscription();
      
      setPushSubscribed(newSubscriptionStatus);
      setPreferences(prev => ({
        ...prev,
        pushNotifications: newSubscriptionStatus
      }));

      await savePreferences();
    } catch (error) {
      console.error('Failed to toggle push notifications:', error);
      setError(error instanceof Error ? error.message : 'Failed to toggle push notifications');
    } finally {
      setLoading(false);
    }
  };

  const testNotification = async () => {
    setLoading(true);
    setError(null);

    try {
      await fetch('/api/notifications/test', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('access_token')}`
        }
      });

      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch (error) {
      console.error('Failed to send test notification:', error);
      setError('Failed to send test notification');
    } finally {
      setLoading(false);
    }
  };

  const getPermissionStatusColor = () => {
    switch (permissionStatus) {
      case 'granted':
        return 'text-green-600';
      case 'denied':
        return 'text-red-600';
      default:
        return 'text-yellow-600';
    }
  };

  const getPermissionStatusText = () => {
    switch (permissionStatus) {
      case 'granted':
        return 'Granted';
      case 'denied':
        return 'Blocked';
      default:
        return 'Not Requested';
    }
  };

  return (
    <ErrorBoundary>
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
            <Bell size={32} className="text-blue-600" />
            Notification Settings
          </h1>
          <p className="text-gray-600 mt-1">
            Manage how and when you receive notifications from NovaCore AI
          </p>
        </div>

        {error && (
          <Alert type="error" onDismiss={() => setError(null)}>
            {error}
          </Alert>
        )}

        {success && (
          <Alert type="success" onDismiss={() => setSuccess(false)}>
            Your notification preferences have been saved successfully!
          </Alert>
        )}

        {/* Push Notifications Status */}
        <div className="card">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-100 rounded-lg">
                <Smartphone size={20} className="text-blue-600" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-gray-900">Browser Push Notifications</h3>
                <p className="text-sm text-gray-600">
                  Permission Status: <span className={`font-medium ${getPermissionStatusColor()}`}>
                    {getPermissionStatusText()}
                  </span>
                </p>
              </div>
            </div>
            
            <div className="flex items-center gap-3">
              {pushSubscribed && (
                <button
                  onClick={testNotification}
                  className="btn-outline text-sm"
                  disabled={loading}
                >
                  Test
                </button>
              )}
              
              <button
                onClick={handlePushToggle}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${
                  pushSubscribed 
                    ? 'bg-green-100 text-green-700 hover:bg-green-200' 
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
                disabled={loading}
              >
                {loading ? (
                  <ButtonLoading />
                ) : pushSubscribed ? (
                  <Bell size={16} />
                ) : (
                  <BellOff size={16} />
                )}
                {pushSubscribed ? 'Enabled' : 'Enable'}
              </button>
            </div>
          </div>
        </div>

        {/* Notification Types */}
        <div className="card">
          <h3 className="text-lg font-semibold text-gray-900 mb-6">Notification Types</h3>
          
          <div className="space-y-6">
            {/* Email Notifications */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Mail size={20} className="text-blue-600" />
                <div>
                  <h4 className="font-medium text-gray-900">Email Notifications</h4>
                  <p className="text-sm text-gray-600">Receive notifications via email</p>
                </div>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={preferences.emailNotifications}
                  onChange={(e) => setPreferences(prev => ({
                    ...prev,
                    emailNotifications: e.target.checked
                  }))}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
              </label>
            </div>

            {/* Chat Messages */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <MessageCircle size={20} className="text-green-600" />
                <div>
                  <h4 className="font-medium text-gray-900">Chat Messages</h4>
                  <p className="text-sm text-gray-600">AI responses and chat activity</p>
                </div>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={preferences.chatMessages}
                  onChange={(e) => setPreferences(prev => ({
                    ...prev,
                    chatMessages: e.target.checked
                  }))}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-green-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-green-600"></div>
              </label>
            </div>

            {/* Course Updates */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Globe size={20} className="text-purple-600" />
                <div>
                  <h4 className="font-medium text-gray-900">Course Updates</h4>
                  <p className="text-sm text-gray-600">New lessons and content releases</p>
                </div>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={preferences.courseUpdates}
                  onChange={(e) => setPreferences(prev => ({
                    ...prev,
                    courseUpdates: e.target.checked
                  }))}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-purple-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-purple-600"></div>
              </label>
            </div>

            {/* Achievement Alerts */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Shield size={20} className="text-yellow-600" />
                <div>
                  <h4 className="font-medium text-gray-900">Achievement Alerts</h4>
                  <p className="text-sm text-gray-600">Level ups, badges, and milestones</p>
                </div>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={preferences.achievementAlerts}
                  onChange={(e) => setPreferences(prev => ({
                    ...prev,
                    achievementAlerts: e.target.checked
                  }))}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-yellow-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-yellow-600"></div>
              </label>
            </div>

            {/* Weekly Digest */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Settings size={20} className="text-gray-600" />
                <div>
                  <h4 className="font-medium text-gray-900">Weekly Digest</h4>
                  <p className="text-sm text-gray-600">Weekly progress summary email</p>
                </div>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={preferences.weeklyDigest}
                  onChange={(e) => setPreferences(prev => ({
                    ...prev,
                    weeklyDigest: e.target.checked
                  }))}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-gray-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-gray-600"></div>
              </label>
            </div>

            {/* Maintenance Alerts */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Settings size={20} className="text-red-600" />
                <div>
                  <h4 className="font-medium text-gray-900">Maintenance Alerts</h4>
                  <p className="text-sm text-gray-600">System updates and downtime notices</p>
                </div>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={preferences.maintenanceAlerts}
                  onChange={(e) => setPreferences(prev => ({
                    ...prev,
                    maintenanceAlerts: e.target.checked
                  }))}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-red-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-red-600"></div>
              </label>
            </div>
          </div>
        </div>

        {/* Sound & Quiet Hours */}
        <div className="card">
          <h3 className="text-lg font-semibold text-gray-900 mb-6">Sound & Timing</h3>
          
          <div className="space-y-6">
            {/* Sound Enabled */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                {preferences.soundEnabled ? (
                  <Volume2 size={20} className="text-blue-600" />
                ) : (
                  <VolumeX size={20} className="text-gray-400" />
                )}
                <div>
                  <h4 className="font-medium text-gray-900">Notification Sounds</h4>
                  <p className="text-sm text-gray-600">Play sound for notifications</p>
                </div>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={preferences.soundEnabled}
                  onChange={(e) => setPreferences(prev => ({
                    ...prev,
                    soundEnabled: e.target.checked
                  }))}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
              </label>
            </div>

            {/* Quiet Hours */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="font-medium text-gray-900">Quiet Hours</h4>
                  <p className="text-sm text-gray-600">Mute notifications during specific hours</p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={preferences.quietHours.enabled}
                    onChange={(e) => setPreferences(prev => ({
                      ...prev,
                      quietHours: {
                        ...prev.quietHours,
                        enabled: e.target.checked
                      }
                    }))}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-purple-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-purple-600"></div>
                </label>
              </div>

              {preferences.quietHours.enabled && (
                <div className="grid grid-cols-2 gap-4 pl-8">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Start Time
                    </label>
                    <input
                      type="time"
                      value={preferences.quietHours.start}
                      onChange={(e) => setPreferences(prev => ({
                        ...prev,
                        quietHours: {
                          ...prev.quietHours,
                          start: e.target.value
                        }
                      }))}
                      className="input"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      End Time
                    </label>
                    <input
                      type="time"
                      value={preferences.quietHours.end}
                      onChange={(e) => setPreferences(prev => ({
                        ...prev,
                        quietHours: {
                          ...prev.quietHours,
                          end: e.target.value
                        }
                      }))}
                      className="input"
                    />
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Save Button */}
        <div className="flex justify-end">
          <button
            onClick={savePreferences}
            className="btn-primary flex items-center gap-2"
            disabled={loading}
          >
            {loading ? (
              <>
                <ButtonLoading />
                Saving...
              </>
            ) : (
              <>
                <Check size={16} />
                Save Preferences
              </>
            )}
          </button>
        </div>
      </div>
    </ErrorBoundary>
  );
}