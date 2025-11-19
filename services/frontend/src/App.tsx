import { Suspense, lazy, useEffect } from 'react';
import type { ReactNode } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { useAuthStore } from './stores/authStore';
import ErrorBoundary from './components/ErrorBoundary';

// Layouts (lazy-loaded)
const MainLayout = lazy(() => import('./layouts/MainLayout'));
const AuthLayout = lazy(() => import('./layouts/AuthLayout'));

// Pages (lazy-loaded)
const Login = lazy(() => import('./pages/Login'));
const Register = lazy(() => import('./pages/Register'));
const ForgotPassword = lazy(() => import('./pages/ForgotPassword'));
const ResetPassword = lazy(() => import('./pages/ResetPassword'));
const VerifyEmail = lazy(() => import('./pages/VerifyEmail'));
const Dashboard = lazy(() => import('./pages/Dashboard'));
const LevelBrowser = lazy(() => import('./pages/LevelBrowser'));
const LessonViewer = lazy(() => import('./pages/LessonViewer'));
const ChallengePlayground = lazy(() => import('./pages/ChallengePlayground'));
const ProgressTracker = lazy(() => import('./pages/ProgressTracker'));
const Leaderboard = lazy(() => import('./pages/Leaderboard'));
const Chat = lazy(() => import('./pages/Chat'));
const Profile = lazy(() => import('./pages/Profile'));
const MemoryViz = lazy(() => import('./pages/MemoryViz'));
const Usage = lazy(() => import('./pages/Usage'));
const QuizTaker = lazy(() => import('./pages/QuizTaker'));
const Study = lazy(() => import('./pages/Study'));
const NoteBuilder = lazy(() => import('./pages/NoteBuilder'));
const Billing = lazy(() => import('./pages/Billing'));
const SubscriptionManagement = lazy(() => import('./pages/SubscriptionManagement'));
const GlobalSearch = lazy(() => import('./pages/GlobalSearch'));
const AdminDashboard = lazy(() => import('./pages/AdminDashboard'));
const HelpSupport = lazy(() => import('./pages/HelpSupport'));

const RouteFallback = () => (
  <div className="flex h-screen items-center justify-center bg-gray-50">
    <div className="text-sm font-medium text-gray-600">Loading experience…</div>
  </div>
);

// Protected Route wrapper
function ProtectedRoute({ children }: { children: ReactNode }) {
  const { isAuthenticated } = useAuthStore();
  
  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }
  
  return (
    <ErrorBoundary>
      {children}
    </ErrorBoundary>
  );
}

function App() {
  const { loadUser, isAuthenticated } = useAuthStore();

  useEffect(() => {
    // Load user on app mount if token exists
    if (isAuthenticated) {
      void loadUser();
    }
  }, [isAuthenticated, loadUser]);

  return (
    <ErrorBoundary>
      <BrowserRouter>
        <Toaster 
          position="top-right"
          toastOptions={{
            duration: 4000,
            style: {
              background: '#363636',
              color: '#fff',
            },
            success: {
              duration: 3000,
            },
            error: {
              duration: 5000,
            },
          }}
        />
        <Suspense fallback={<RouteFallback />}>
          <Routes>
            {/* Public routes */}
            <Route element={<AuthLayout />}>
              <Route path="/login" element={<Login />} />
              <Route path="/register" element={<Register />} />
              <Route path="/forgot-password" element={<ForgotPassword />} />
              <Route path="/reset-password" element={<ResetPassword />} />
            </Route>

            {/* Email verification route (public, no layout) */}
            <Route path="/verify-email" element={<VerifyEmail />} />

            {/* Protected routes */}
            <Route element={<ProtectedRoute><MainLayout /></ProtectedRoute>}>
              <Route path="/" element={<Navigate to="/dashboard" replace />} />
              <Route path="/dashboard" element={<Dashboard />} />
              <Route path="/levels" element={<LevelBrowser />} />
              <Route path="/study" element={<Study />} />
              <Route path="/notes/new" element={<NoteBuilder />} />
              <Route path="/notes/:noteId/edit" element={<NoteBuilder />} />
              <Route path="/lessons/:id" element={<LessonViewer />} />
              <Route path="/challenges/:id" element={<ChallengePlayground />} />
              <Route path="/progress" element={<ProgressTracker />} />
              <Route path="/leaderboard" element={<Leaderboard />} />
              <Route path="/chat" element={<Chat />} />
              <Route path="/memory" element={<MemoryViz />} />
              <Route path="/usage" element={<Usage />} />
              <Route path="/profile" element={<Profile />} />
              <Route path="/quiz/:noteId" element={<QuizTaker />} />
              <Route path="/billing" element={<Billing />} />
              <Route path="/subscription" element={<SubscriptionManagement />} />
              <Route path="/search" element={<GlobalSearch />} />
              <Route path="/admin" element={<AdminDashboard />} />
              <Route path="/help" element={<HelpSupport />} />
              <Route path="/analytics" element={<AnalyticsDashboard />} />
              <Route path="/notifications" element={<NotificationSettings />} />
            </Route>

            {/* 404 */}
            <Route path="*" element={<Navigate to="/dashboard" replace />} />
          </Routes>
        </Suspense>
      </BrowserRouter>
    </ErrorBoundary>
  );
}

export default App;
