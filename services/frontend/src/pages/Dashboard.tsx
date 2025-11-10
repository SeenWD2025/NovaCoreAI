import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useCurriculumStore } from '@/stores/curriculumStore';
import { useAuthStore } from '@/stores/authStore';
import { 
  Zap, 
  Trophy, 
  BookOpen, 
  ChevronRight,
  Target,
  Award,
  TrendingUp
} from 'lucide-react';
import type { Lesson } from '@/types/curriculum';
import curriculumService from '@/services/curriculum';
import QuotaCard from '@/components/QuotaCard';
import EmailVerificationBanner from '@/components/EmailVerificationBanner';

export default function Dashboard() {
  const { user } = useAuthStore();
  const { progress, achievements, fetchProgress, fetchAchievements } = useCurriculumStore();
  const [currentLevelLessons, setCurrentLevelLessons] = useState<Lesson[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadData = async () => {
      await Promise.all([fetchProgress(), fetchAchievements()]);
      setLoading(false);
    };
    loadData();
  }, []);

  useEffect(() => {
    if (progress?.current_level) {
      curriculumService.getLessonsByLevel(progress.current_level)
        .then(({ lessons }) => {
          setCurrentLevelLessons(lessons.slice(0, 3)); // Show first 3 lessons
        })
        .catch(console.error);
    }
  }, [progress]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-800"></div>
      </div>
    );
  }

  const progressPercent = progress?.progress_percent || 0;
  const currentLevel = progress?.current_level_info;
  const nextLevel = progress?.next_level_info;
  const recentAchievements = achievements.slice(0, 3);

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {/* Email Verification Banner */}
      <EmailVerificationBanner isVerified={user?.email_verified} />

      {/* Welcome Header */}
      <div className="card bg-gradient-to-r from-primary-800 to-primary-600 text-white">
        <h1 className="text-3xl font-bold mb-2">
          Welcome back, {user?.email?.split('@')[0] || 'Student'}!
        </h1>
        <p className="text-primary-100">
          Continue your journey through the Noble Growth School
        </p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Current Level */}
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-primary-100 rounded-lg">
                <BookOpen size={24} className="text-primary-800" />
              </div>
              <div>
                <p className="text-sm text-gray-500">Current Level</p>
                <p className="text-2xl font-bold text-gray-900">{progress?.current_level}</p>
              </div>
            </div>
          </div>
          {currentLevel && (
            <p className="text-sm text-gray-600">{currentLevel.title}</p>
          )}
        </div>

        {/* Total XP */}
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-secondary-100 rounded-lg">
                <Zap size={24} className="text-secondary-700" />
              </div>
              <div>
                <p className="text-sm text-gray-500">Total XP</p>
                <p className="text-2xl font-bold text-gray-900">{progress?.total_xp || 0}</p>
              </div>
            </div>
          </div>
          <p className="text-sm text-gray-600">
            {progress?.xp_to_next_level || 0} XP to next level
          </p>
        </div>

        {/* Achievements */}
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-accent-100 rounded-lg">
                <Trophy size={24} className="text-accent-700" />
              </div>
              <div>
                <p className="text-sm text-gray-500">Achievements</p>
                <p className="text-2xl font-bold text-gray-900">{achievements.length}</p>
              </div>
            </div>
          </div>
          <Link to="/progress" className="text-sm text-primary-800 hover:underline">
            View all →
          </Link>
        </div>
      </div>

      {/* Progress Bar */}
      {nextLevel && (
        <div className="card">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h3 className="font-semibold text-gray-900">Progress to Level {nextLevel.level_number}</h3>
              <p className="text-sm text-gray-600">{nextLevel.title}</p>
            </div>
            <span className="text-sm font-medium text-gray-700">{progressPercent.toFixed(0)}%</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-3">
            <div
              className="bg-gradient-to-r from-primary-800 to-primary-600 h-3 rounded-full transition-all duration-500"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        </div>
      )}

      {/* Quota Display */}
      <QuotaCard />

      {/* Two Column Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Current Level Lessons */}
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold text-gray-900">Continue Learning</h2>
            <Link to="/levels" className="text-sm text-primary-800 hover:underline">
              View all
            </Link>
          </div>
          
          {currentLevelLessons.length === 0 ? (
            <p className="text-gray-500 text-center py-8">No lessons available</p>
          ) : (
            <div className="space-y-3">
              {currentLevelLessons.map((lesson) => (
                <Link
                  key={lesson.id}
                  to={`/lessons/${lesson.id}`}
                  className="block p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <h3 className="font-medium text-gray-900">{lesson.title}</h3>
                      <div className="flex items-center gap-3 mt-1 text-sm text-gray-600">
                        <span>⏱ {lesson.estimated_minutes} min</span>
                        <span>🎯 {lesson.xp_reward} XP</span>
                      </div>
                    </div>
                    {lesson.completed ? (
                      <span className="badge-success">Completed</span>
                    ) : (
                      <ChevronRight size={20} className="text-gray-400" />
                    )}
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>

        {/* Recent Achievements */}
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold text-gray-900">Recent Achievements</h2>
            <Link to="/progress" className="text-sm text-primary-800 hover:underline">
              View all
            </Link>
          </div>

          {recentAchievements.length === 0 ? (
            <div className="text-center py-8">
              <Award size={48} className="mx-auto text-gray-300 mb-2" />
              <p className="text-gray-500">Complete lessons to earn achievements!</p>
            </div>
          ) : (
            <div className="space-y-3">
              {recentAchievements.map((achievement) => (
                <div
                  key={achievement.id}
                  className="p-4 bg-secondary-50 rounded-lg border border-secondary-200"
                >
                  <div className="flex items-start gap-3">
                    <div className="p-2 bg-secondary-500 rounded-lg">
                      <Trophy size={20} className="text-white" />
                    </div>
                    <div className="flex-1">
                      <h3 className="font-medium text-gray-900">{achievement.achievement_type}</h3>
                      <p className="text-sm text-gray-600 mt-1">
                        {new Date(achievement.unlocked_at).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Link to="/chat" className="card hover:shadow-md transition-shadow">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-accent-100 rounded-lg">
              <Target size={24} className="text-accent-700" />
            </div>
            <div>
              <h3 className="font-semibold text-gray-900">Start Chatting</h3>
              <p className="text-sm text-gray-600">Get AI assistance</p>
            </div>
          </div>
        </Link>

        <Link to="/levels" className="card hover:shadow-md transition-shadow">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-primary-100 rounded-lg">
              <BookOpen size={24} className="text-primary-800" />
            </div>
            <div>
              <h3 className="font-semibold text-gray-900">Browse Levels</h3>
              <p className="text-sm text-gray-600">Explore curriculum</p>
            </div>
          </div>
        </Link>

        <Link to="/leaderboard" className="card hover:shadow-md transition-shadow">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-secondary-100 rounded-lg">
              <TrendingUp size={24} className="text-secondary-700" />
            </div>
            <div>
              <h3 className="font-semibold text-gray-900">Leaderboard</h3>
              <p className="text-sm text-gray-600">See rankings</p>
            </div>
          </div>
        </Link>
      </div>

      {/* Agent Unlock Teaser (if not unlocked) */}
      {progress && !progress.agent_creation_unlocked && progress.current_level < 12 && (
        <div className="card bg-gradient-to-r from-purple-500 to-purple-600 text-white">
          <div className="flex items-center gap-4">
            <div className="p-4 bg-white bg-opacity-20 rounded-lg">
              <Award size={32} />
            </div>
            <div className="flex-1">
              <h3 className="text-xl font-bold mb-1">Agent Creation Unlocks at Level 12</h3>
              <p className="text-purple-100">
                Keep learning to unlock the ability to create your own AI agents!
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
