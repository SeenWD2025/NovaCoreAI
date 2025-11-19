import { useState, useEffect } from 'react';
import { 
  Users, 
  UserPlus, 
  Search, 
  Filter, 
  MoreVertical,
  Shield,
  Mail,
  Calendar,
  Download,
  Trash2,
  Edit
} from 'lucide-react';
import { useAuthStore } from '@/stores/authStore';
import { PageLoading } from '@/components/LoadingSpinner';
import { NoDataEmptyState } from '@/components/EmptyState';
import ErrorBoundary from '@/components/ErrorBoundary';
import Modal, { ConfirmModal } from '@/components/Modal';
import Alert from '@/components/Alert';

interface User {
  id: string;
  email: string;
  role: 'user' | 'admin' | 'moderator';
  subscription_tier: string;
  email_verified: boolean;
  created_at: string;
  last_active?: string;
  progress?: {
    level: number;
    xp: number;
    lessons_completed: number;
  };
}

interface UserFilters {
  search: string;
  role: string;
  tier: string;
  verified: string;
}

export default function AdminDashboard() {
  const { user: currentUser } = useAuthStore();
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFilters] = useState<UserFilters>({
    search: '',
    role: 'all',
    tier: 'all',
    verified: 'all'
  });
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<User | null>(null);
  const [actionLoading, setActionLoading] = useState(false);

  useEffect(() => {
    if (currentUser?.role !== 'admin') {
      setError('Access denied. Admin privileges required.');
      setLoading(false);
      return;
    }
    
    loadUsers();
  }, [currentUser]);

  const loadUsers = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/admin/users', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('access_token')}`
        }
      });

      if (!response.ok) throw new Error('Failed to load users');

      const data = await response.json();
      setUsers(data.users || []);
    } catch (error) {
      console.error('Failed to load users:', error);
      setError('Failed to load user data');
    } finally {
      setLoading(false);
    }
  };

  const handleRoleChange = async (userId: string, newRole: string) => {
    try {
      setActionLoading(true);
      const response = await fetch(`/api/admin/users/${userId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('access_token')}`
        },
        body: JSON.stringify({ role: newRole })
      });

      if (!response.ok) throw new Error('Failed to update user role');

      await loadUsers();
      setSelectedUser(null);
    } catch (error) {
      console.error('Failed to update user:', error);
      setError('Failed to update user role');
    } finally {
      setActionLoading(false);
    }
  };

  const handleDeleteUser = async (userId: string) => {
    try {
      setActionLoading(true);
      const response = await fetch(`/api/admin/users/${userId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('access_token')}`
        }
      });

      if (!response.ok) throw new Error('Failed to delete user');

      await loadUsers();
      setShowDeleteConfirm(null);
    } catch (error) {
      console.error('Failed to delete user:', error);
      setError('Failed to delete user');
    } finally {
      setActionLoading(false);
    }
  };

  const exportUsers = async () => {
    try {
      const response = await fetch('/api/admin/users/export', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('access_token')}`
        }
      });

      if (!response.ok) throw new Error('Failed to export users');

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `users-export-${new Date().toISOString().split('T')[0]}.csv`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (error) {
      console.error('Failed to export users:', error);
      setError('Failed to export user data');
    }
  };

  const filteredUsers = users.filter(user => {
    const matchesSearch = user.email.toLowerCase().includes(filters.search.toLowerCase());
    const matchesRole = filters.role === 'all' || user.role === filters.role;
    const matchesTier = filters.tier === 'all' || user.subscription_tier === filters.tier;
    const matchesVerified = filters.verified === 'all' || 
      (filters.verified === 'verified' && user.email_verified) ||
      (filters.verified === 'unverified' && !user.email_verified);

    return matchesSearch && matchesRole && matchesTier && matchesVerified;
  });

  if (loading) {
    return <PageLoading text="Loading admin dashboard..." />;
  }

  if (currentUser?.role !== 'admin') {
    return (
      <div className="flex items-center justify-center h-64">
        <Alert type="error" title="Access Denied">
          You need administrator privileges to access this page.
        </Alert>
      </div>
    );
  }

  return (
    <ErrorBoundary>
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
              <Shield size={32} className="text-red-600" />
              Admin Dashboard
            </h1>
            <p className="text-gray-600 mt-1">
              Manage users and system settings
            </p>
          </div>
          
          <div className="flex gap-3">
            <button
              onClick={exportUsers}
              className="btn-outline flex items-center gap-2"
            >
              <Download size={16} />
              Export Users
            </button>
          </div>
        </div>

        {error && (
          <Alert type="error" onDismiss={() => setError(null)}>
            {error}
          </Alert>
        )}

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <div className="card">
            <div className="flex items-center gap-3">
              <Users size={24} className="text-blue-600" />
              <div>
                <p className="text-sm text-gray-600">Total Users</p>
                <p className="text-2xl font-bold text-gray-900">{users.length}</p>
              </div>
            </div>
          </div>
          
          <div className="card">
            <div className="flex items-center gap-3">
              <Mail size={24} className="text-green-600" />
              <div>
                <p className="text-sm text-gray-600">Verified Users</p>
                <p className="text-2xl font-bold text-gray-900">
                  {users.filter(u => u.email_verified).length}
                </p>
              </div>
            </div>
          </div>
          
          <div className="card">
            <div className="flex items-center gap-3">
              <Shield size={24} className="text-purple-600" />
              <div>
                <p className="text-sm text-gray-600">Admin Users</p>
                <p className="text-2xl font-bold text-gray-900">
                  {users.filter(u => u.role === 'admin').length}
                </p>
              </div>
            </div>
          </div>
          
          <div className="card">
            <div className="flex items-center gap-3">
              <Calendar size={24} className="text-orange-600" />
              <div>
                <p className="text-sm text-gray-600">Active Today</p>
                <p className="text-2xl font-bold text-gray-900">
                  {users.filter(u => u.last_active && 
                    new Date(u.last_active).toDateString() === new Date().toDateString()
                  ).length}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Filters */}
        <div className="card">
          <div className="flex flex-wrap gap-4">
            <div className="flex-1 min-w-64">
              <div className="relative">
                <Search size={20} className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  value={filters.search}
                  onChange={(e) => setFilters(prev => ({ ...prev, search: e.target.value }))}
                  placeholder="Search users by email..."
                  className="input pl-12"
                />
              </div>
            </div>
            
            <div className="flex gap-2">
              <select
                value={filters.role}
                onChange={(e) => setFilters(prev => ({ ...prev, role: e.target.value }))}
                className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
              >
                <option value="all">All Roles</option>
                <option value="user">Users</option>
                <option value="admin">Admins</option>
                <option value="moderator">Moderators</option>
              </select>
              
              <select
                value={filters.tier}
                onChange={(e) => setFilters(prev => ({ ...prev, tier: e.target.value }))}
                className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
              >
                <option value="all">All Tiers</option>
                <option value="free_trial">Free Trial</option>
                <option value="basic">Basic</option>
                <option value="pro">Professional</option>
              </select>
              
              <select
                value={filters.verified}
                onChange={(e) => setFilters(prev => ({ ...prev, verified: e.target.value }))}
                className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
              >
                <option value="all">All Status</option>
                <option value="verified">Verified</option>
                <option value="unverified">Unverified</option>
              </select>
            </div>
          </div>
        </div>

        {/* Users Table */}
        {filteredUsers.length === 0 ? (
          <NoDataEmptyState
            title="No users found"
            description="No users match your current filters."
          />
        ) : (
          <div className="card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      User
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Role
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Subscription
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Progress
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Joined
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {filteredUsers.map((user) => (
                    <tr key={user.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          <div className="h-10 w-10 rounded-full bg-gray-300 flex items-center justify-center">
                            <span className="text-sm font-medium text-gray-700">
                              {user.email.charAt(0).toUpperCase()}
                            </span>
                          </div>
                          <div className="ml-4">
                            <div className="text-sm font-medium text-gray-900">{user.email}</div>
                            <div className="text-sm text-gray-500">ID: {user.id.slice(0, 8)}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`badge ${
                          user.role === 'admin' ? 'badge-error' :
                          user.role === 'moderator' ? 'badge-warning' : 'badge-primary'
                        }`}>
                          {user.role}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {user.subscription_tier?.replace('_', ' ') || 'Free'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`badge ${
                          user.email_verified ? 'badge-success' : 'badge-warning'
                        }`}>
                          {user.email_verified ? 'Verified' : 'Unverified'}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {user.progress ? (
                          <div>
                            <div>Level {user.progress.level}</div>
                            <div className="text-xs text-gray-500">
                              {user.progress.lessons_completed} lessons
                            </div>
                          </div>
                        ) : (
                          <span className="text-gray-400">No progress</span>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {new Date(user.created_at).toLocaleDateString()}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        <button
                          onClick={() => setSelectedUser(user)}
                          className="text-primary-600 hover:text-primary-900 mr-3"
                        >
                          <Edit size={16} />
                        </button>
                        {user.id !== currentUser?.id && (
                          <button
                            onClick={() => setShowDeleteConfirm(user)}
                            className="text-red-600 hover:text-red-900"
                          >
                            <Trash2 size={16} />
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Edit User Modal */}
        {selectedUser && (
          <Modal
            isOpen={!!selectedUser}
            onClose={() => setSelectedUser(null)}
            title="Edit User"
          >
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Email
                </label>
                <input
                  type="email"
                  value={selectedUser.email}
                  disabled
                  className="input"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Role
                </label>
                <select
                  value={selectedUser.role}
                  onChange={(e) => setSelectedUser(prev => prev ? { ...prev, role: e.target.value as any } : null)}
                  className="input"
                  disabled={actionLoading}
                >
                  <option value="user">User</option>
                  <option value="moderator">Moderator</option>
                  <option value="admin">Admin</option>
                </select>
              </div>
              
              <div className="flex justify-end gap-3">
                <button
                  onClick={() => setSelectedUser(null)}
                  className="btn-outline"
                  disabled={actionLoading}
                >
                  Cancel
                </button>
                <button
                  onClick={() => handleRoleChange(selectedUser.id, selectedUser.role)}
                  className="btn-primary"
                  disabled={actionLoading}
                >
                  {actionLoading ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </div>
          </Modal>
        )}

        {/* Delete Confirmation Modal */}
        {showDeleteConfirm && (
          <ConfirmModal
            isOpen={!!showDeleteConfirm}
            onClose={() => setShowDeleteConfirm(null)}
            onConfirm={() => handleDeleteUser(showDeleteConfirm.id)}
            title="Delete User"
            message={`Are you sure you want to delete user "${showDeleteConfirm.email}"? This action cannot be undone.`}
            confirmText="Delete"
            variant="danger"
          />
        )}
      </div>
    </ErrorBoundary>
  );
}