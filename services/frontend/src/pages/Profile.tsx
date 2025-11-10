import { useState } from 'react';
import { useAuthStore } from '@/stores/authStore';
import { useCurriculumStore } from '@/stores/curriculumStore';
import { 
  User, 
  Mail, 
  Shield, 
  CreditCard, 
  Bell,
  Key,
  LogOut,
  Save,
  Crown,
  Zap,
  CheckCircle,
  XCircle
} from 'lucide-react';
import { showSuccess, showError } from '@/utils/toast';
import api from '@/services/api';

type TabType = 'profile' | 'security' | 'subscription' | 'notifications';

export default function Profile() {
  const { user, logout } = useAuthStore();
  const { progress } = useCurriculumStore();
  const [activeTab, setActiveTab] = useState<TabType>('profile');
  const [email, setEmail] = useState(user?.email || '');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  const tabs = [
    { id: 'profile' as TabType, name: 'Profile', icon: User },
    { id: 'security' as TabType, name: 'Security', icon: Shield },
    { id: 'subscription' as TabType, name: 'Subscription', icon: CreditCard },
    { id: 'notifications' as TabType, name: 'Notifications', icon: Bell },
  ];

  const handleSaveProfile = async () => {
    setIsSaving(true);
    try {
      // Mock save
      await new Promise(resolve => setTimeout(resolve, 1000));
      showSuccess('Profile updated successfully!');
    } catch {
      showError('Failed to update profile');
    } finally {
      setIsSaving(false);
    }
  };

  const handleChangePassword = async () => {
    if (newPassword !== confirmPassword) {
      showError('Passwords do not match');
      return;
    }

    if (newPassword.length < 8) {
      showError('Password must be at least 8 characters');
      return;
    }

    setIsSaving(true);
    try {
      // Mock password change
      await new Promise(resolve => setTimeout(resolve, 1000));
      showSuccess('Password changed successfully!');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch {
      showError('Failed to change password');
    } finally {
      setIsSaving(false);
    }
  };

  const handleLogout = async () => {
    if (confirm('Are you sure you want to logout?')) {
      await logout();
    }
  };

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Header with User Stats */}
      <div className="card bg-gradient-to-r from-primary-800 to-primary-600 text-white">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-20 h-20 bg-white bg-opacity-20 rounded-full flex items-center justify-center">
              <User size={40} />
            </div>
            <div>
              <h1 className="text-3xl font-bold">{user?.email?.split('@')[0] || 'User'}</h1>
              <p className="text-primary-100">{user?.email}</p>
              <div className="flex items-center gap-4 mt-2">
                <span className="badge bg-white bg-opacity-20">
                  {user?.role || 'student'}
                </span>
                <span className="badge bg-secondary-500">
                  {user?.subscription_tier || 'free_trial'}
                </span>
              </div>
            </div>
          </div>

          {progress && (
            <div className="text-right">
              <div className="text-sm text-primary-200">Level</div>
              <div className="text-5xl font-bold">{progress.current_level}</div>
              <div className="flex items-center gap-2 justify-end mt-2">
                <Zap size={16} />
                <span className="text-lg">{progress.total_xp} XP</span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200">
        <div className="flex gap-4">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-3 border-b-2 transition-colors ${
                activeTab === tab.id
                  ? 'border-primary-800 text-primary-800 font-semibold'
                  : 'border-transparent text-gray-600 hover:text-gray-900'
              }`}
            >
              <tab.icon size={20} />
              <span>{tab.name}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Tab Content */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          {/* Profile Tab */}
          {activeTab === 'profile' && (
            <div className="card space-y-6">
              <h2 className="text-2xl font-bold text-gray-900">Profile Information</h2>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Email Address
                  </label>
                  <div className="flex items-center gap-2">
                    <Mail size={20} className="text-gray-400" />
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="input flex-1"
                      disabled
                    />
                    {user?.email_verified ? (
                      <div className="flex items-center gap-1 px-3 py-1 bg-green-100 text-green-700 rounded-md text-sm font-medium">
                        <CheckCircle size={16} />
                        Verified
                      </div>
                    ) : (
                      <div className="flex items-center gap-1 px-3 py-1 bg-yellow-100 text-yellow-700 rounded-md text-sm font-medium">
                        <XCircle size={16} />
                        Unverified
                      </div>
                    )}
                  </div>
                  <p className="text-xs text-gray-500 mt-1">
                    {user?.email_verified 
                      ? 'Your email address has been verified' 
                      : 'Email verification required to access all features'}
                  </p>
                  {!user?.email_verified && (
                    <button
                      onClick={async () => {
                        try {
                          await api.post('/auth/resend-verification');
                          showSuccess('Verification email sent! Please check your inbox.');
                        } catch (err) {
                          const error = err as { response?: { data?: { message?: string } } };
                          showError(error.response?.data?.message || 'Failed to send verification email');
                        }
                      }}
                      className="mt-2 text-sm text-primary-800 hover:underline focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 rounded"
                    >
                      Resend verification email →
                    </button>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Account Type
                  </label>
                  <div className="flex items-center gap-2 px-4 py-3 bg-gray-50 rounded-lg">
                    <Shield size={20} className="text-gray-600" />
                    <span className="text-gray-900 capitalize">{user?.role || 'Student'}</span>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Member Since
                  </label>
                  <div className="px-4 py-3 bg-gray-50 rounded-lg text-gray-900">
                    {user?.created_at ? new Date(user.created_at).toLocaleDateString() : 'N/A'}
                  </div>
                </div>
              </div>

              <button
                onClick={handleSaveProfile}
                disabled={isSaving}
                className="btn-primary w-full"
              >
                <Save size={20} className="inline mr-2" />
                {isSaving ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          )}

          {/* Security Tab */}
          {activeTab === 'security' && (
            <div className="card space-y-6">
              <h2 className="text-2xl font-bold text-gray-900">Security Settings</h2>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Current Password
                  </label>
                  <input
                    type="password"
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    className="input"
                    placeholder="Enter current password"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    New Password
                  </label>
                  <input
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className="input"
                    placeholder="Enter new password"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Minimum 8 characters
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Confirm New Password
                  </label>
                  <input
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="input"
                    placeholder="Confirm new password"
                  />
                </div>
              </div>

              <button
                onClick={handleChangePassword}
                disabled={isSaving || !currentPassword || !newPassword}
                className="btn-primary w-full"
              >
                <Key size={20} className="inline mr-2" />
                {isSaving ? 'Changing Password...' : 'Change Password'}
              </button>

              <div className="pt-6 border-t">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Session Management</h3>
                <button onClick={handleLogout} className="btn-outline w-full text-red-600 border-red-600 hover:bg-red-50">
                  <LogOut size={20} className="inline mr-2" />
                  Logout from All Devices
                </button>
              </div>
            </div>
          )}

          {/* Subscription Tab */}
          {activeTab === 'subscription' && (
            <div className="card space-y-6">
              <h2 className="text-2xl font-bold text-gray-900">Subscription & Billing</h2>

              <div className="p-6 bg-gradient-to-r from-secondary-500 to-secondary-600 text-white rounded-lg">
                <div className="flex items-center gap-3 mb-4">
                  <Crown size={32} />
                  <div>
                    <h3 className="text-2xl font-bold capitalize">
                      {user?.subscription_tier?.replace('_', ' ') || 'Free Trial'}
                    </h3>
                    <p className="text-secondary-100">Current Plan</p>
                  </div>
                </div>
                {user?.trial_ends_at && (
                  <p className="text-sm text-secondary-100">
                    Trial ends: {new Date(user.trial_ends_at).toLocaleDateString()}
                  </p>
                )}
              </div>

              <div className="space-y-4">
                <h3 className="text-lg font-semibold text-gray-900">Available Plans</h3>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="p-4 border-2 border-gray-200 rounded-lg hover:border-primary-500 transition-colors">
                    <h4 className="text-lg font-bold text-gray-900 mb-2">Basic</h4>
                    <div className="text-3xl font-bold text-gray-900 mb-4">
                      $9<span className="text-sm text-gray-600">/month</span>
                    </div>
                    <ul className="space-y-2 text-sm text-gray-600 mb-4">
                      <li>✓ Full curriculum access</li>
                      <li>✓ 100 chat messages/month</li>
                      <li>✓ Basic memory storage</li>
                    </ul>
                    <button className="btn-outline w-full">Select Plan</button>
                  </div>

                  <div className="p-4 border-2 border-primary-500 rounded-lg bg-primary-50">
                    <div className="badge-primary mb-2">Popular</div>
                    <h4 className="text-lg font-bold text-gray-900 mb-2">Pro</h4>
                    <div className="text-3xl font-bold text-gray-900 mb-4">
                      $29<span className="text-sm text-gray-600">/month</span>
                    </div>
                    <ul className="space-y-2 text-sm text-gray-600 mb-4">
                      <li>✓ Everything in Basic</li>
                      <li>✓ Unlimited chat messages</li>
                      <li>✓ Advanced memory (LTM)</li>
                      <li>✓ Priority support</li>
                    </ul>
                    <button className="btn-primary w-full">Upgrade to Pro</button>
                  </div>
                </div>
              </div>

              <div className="pt-6 border-t">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Billing History</h3>
                <div className="text-center py-8 text-gray-500">
                  <CreditCard size={48} className="mx-auto mb-4 text-gray-300" />
                  <p>No billing history yet</p>
                </div>
              </div>
            </div>
          )}

          {/* Notifications Tab */}
          {activeTab === 'notifications' && (
            <div className="card space-y-6">
              <h2 className="text-2xl font-bold text-gray-900">Notification Preferences</h2>

              <div className="space-y-4">
                <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                  <div>
                    <h4 className="font-semibold text-gray-900">XP Notifications</h4>
                    <p className="text-sm text-gray-600">Get notified when you earn XP</p>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input type="checkbox" className="sr-only peer" defaultChecked />
                    <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-primary-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary-600"></div>
                  </label>
                </div>

                <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                  <div>
                    <h4 className="font-semibold text-gray-900">Level Up Alerts</h4>
                    <p className="text-sm text-gray-600">Celebrate when you level up</p>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input type="checkbox" className="sr-only peer" defaultChecked />
                    <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-primary-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary-600"></div>
                  </label>
                </div>

                <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                  <div>
                    <h4 className="font-semibold text-gray-900">Email Notifications</h4>
                    <p className="text-sm text-gray-600">Receive updates via email</p>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input type="checkbox" className="sr-only peer" />
                    <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-primary-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary-600"></div>
                  </label>
                </div>

                <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                  <div>
                    <h4 className="font-semibold text-gray-900">Weekly Summary</h4>
                    <p className="text-sm text-gray-600">Weekly progress report</p>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input type="checkbox" className="sr-only peer" defaultChecked />
                    <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-primary-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary-600"></div>
                  </label>
                </div>
              </div>

              <button className="btn-primary w-full">
                <Save size={20} className="inline mr-2" />
                Save Preferences
              </button>
            </div>
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          <div className="card">
            <h3 className="font-semibold text-gray-900 mb-4">Quick Stats</h3>
            <div className="space-y-3">
              {progress && (
                <>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-600">Current Level</span>
                    <span className="font-semibold text-gray-900">{progress.current_level}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-600">Total XP</span>
                    <span className="font-semibold text-gray-900">{progress.total_xp}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-600">Agent Creation</span>
                    <span className={`badge ${progress.agent_creation_unlocked ? 'badge-success' : 'bg-gray-100 text-gray-600'}`}>
                      {progress.agent_creation_unlocked ? 'Unlocked' : 'Locked'}
                    </span>
                  </div>
                </>
              )}
            </div>
          </div>

          <div className="card bg-accent-50 border-accent-200">
            <h3 className="font-semibold text-gray-900 mb-2">Need Help?</h3>
            <p className="text-sm text-gray-600 mb-4">
              Contact support if you have any questions about your account or subscription.
            </p>
            <button className="btn-outline w-full">Contact Support</button>
          </div>
        </div>
      </div>
    </div>
  );
}
