import { useState } from 'react';
import { Outlet, NavLink } from 'react-router-dom';
import { useAuthStore } from '@/stores/authStore';
import { useCurriculumStore } from '@/stores/curriculumStore';
import {
  Home,
  BookOpen,
  Trophy,
  MessageSquare,
  Brain,
  User,
  LogOut,
  Menu,
  X,
  Zap,
  Notebook,
} from 'lucide-react';

export default function MainLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const { user, logout } = useAuthStore();
  const { progress } = useCurriculumStore();

  const navItems = [
    { to: '/dashboard', icon: Home, label: 'Dashboard' },
    { to: '/levels', icon: BookOpen, label: 'Levels' },
    { to: '/study', icon: Notebook, label: 'Study' },
    { to: '/progress', icon: Trophy, label: 'Progress' },
    { to: '/chat', icon: MessageSquare, label: 'Chat' },
    { to: '/memory', icon: Brain, label: 'Memory' },
    { to: '/leaderboard', icon: Zap, label: 'Leaderboard' },
  ];

  const handleLogout = async () => {
    await logout();
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Top Navigation Bar */}
      <nav className="bg-white border-b border-gray-200 fixed w-full z-30 top-0">
        <div className="px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center">
              <button
                onClick={() => setSidebarOpen(!sidebarOpen)}
                className="p-2 rounded-lg text-gray-600 hover:bg-gray-100 lg:hidden"
              >
                {sidebarOpen ? <X size={24} /> : <Menu size={24} />}
              </button>
              <h1 className="text-xl font-bold text-primary-800 ml-2">Noble NovaCoreAI</h1>
            </div>

            {/* User info and XP */}
            <div className="flex items-center gap-4">
              {progress && (
                <div className="hidden sm:flex items-center gap-2 bg-secondary-50 px-4 py-2 rounded-lg">
                  <Zap size={18} className="text-secondary-600" />
                  <span className="font-semibold text-secondary-700">{progress.total_xp} XP</span>
                  <span className="text-gray-500">|</span>
                  <span className="text-sm text-gray-600">Level {progress.current_level}</span>
                </div>
              )}
              
              <NavLink
                to="/profile"
                className="flex items-center gap-2 hover:bg-gray-100 rounded-lg px-3 py-2 transition-colors"
              >
                <User size={20} className="text-gray-600" />
                <span className="hidden md:inline text-sm font-medium text-gray-700">
                  {user?.email}
                </span>
              </NavLink>
            </div>
          </div>
        </div>
      </nav>

      {/* Sidebar */}
      <aside
        className={`fixed left-0 top-14 z-20 h-[calc(100vh-3.5rem)] w-64 bg-white border-r border-gray-200 transition-transform duration-300 ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        }`}
      >
        <nav className="p-4 space-y-2">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                `flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
                  isActive
                    ? 'bg-primary-50 text-primary-800 font-medium'
                    : 'text-gray-700 hover:bg-gray-50'
                }`
              }
            >
              <item.icon size={20} />
              <span>{item.label}</span>
            </NavLink>
          ))}

          <button
            onClick={handleLogout}
            className="flex items-center gap-3 px-4 py-3 rounded-lg transition-colors text-red-600 hover:bg-red-50 w-full mt-8"
          >
            <LogOut size={20} />
            <span>Logout</span>
          </button>
        </nav>
      </aside>

      {/* Main Content */}
      <main
        className={`pt-14 transition-all duration-300 ${
          sidebarOpen ? 'lg:ml-64' : ''
        }`}
      >
        <div className="p-6">
          <Outlet />
        </div>
      </main>

      {/* Mobile sidebar overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 z-10 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}
    </div>
  );
}
