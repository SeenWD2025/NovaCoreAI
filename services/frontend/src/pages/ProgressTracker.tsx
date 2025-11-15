import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useCurriculumStore } from '@/stores/curriculumStore';
import {
  Trophy,
  Zap,
  BookOpen,
  CheckCircle,
  Target,
  Award,
  TrendingUp,
  Calendar,
  AlertTriangle
} from 'lucide-react';

export default function ProgressTracker() {
  const {
    progress,
    achievements,
    fetchProgress,
    fetchAchievements,
    fetchLevels,
    error,
    isLoading,
  } = useCurriculumStore();

  useEffect(() => {
    fetchProgress();
    fetchAchievements();
    fetchLevels();
  }, [fetchProgress, fetchAchievements, fetchLevels]);

  const handleRetry = () => {
    fetchProgress();
    fetchAchievements();
    fetchLevels();
  };

  if (!progress) {
    if (error) {
      return (
        <div className="max-w-3xl mx-auto">
          <div className="card bg-red-50 border-red-200">
            <div className="flex items-start gap-4">
              <div className="p-3 rounded-full bg-red-100 text-red-700">
                <AlertTriangle size={24} />
              </div>
              <div className="flex-1">
                <h2 className="text-xl font-semibold text-red-700 mb-1">Unable to load your progress</h2>
                <p className="text-red-600 mb-4">{error}</p>
                <button className="btn-primary" onClick={handleRetry}>
                  Retry loading
                </button>
              </div>
            </div>
          </div>
        </div>
      );
    }

    if (isLoading) {
      return (
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-800"></div>
        </div>
      );
    }
  }

  if (!progress) {
    return null;
  }

  const completedLevels = progress.current_level - 1;
  const totalLevels = 24;
  const progressPercentage = (completedLevels / totalLevels) * 100;

  // Calculate milestones
  const milestones = [
    { level: 6, name: 'Initiation Complete', reached: progress.current_level > 6 },
    { level: 12, name: 'Agent Creation Unlocked', reached: progress.agent_creation_unlocked },
    { level: 18, name: 'Integration Master', reached: progress.current_level > 18 },
    { level: 24, name: 'Noble Sovereign', reached: progress.current_level >= 24 },
  ];

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div className="text-center">
        <h1 className="text-4xl font-bold text-gray-900 mb-2">Your Learning Journey</h1>
        <p className="text-lg text-gray-600">
          Track your progress through the Noble Growth School
        </p>
      </div>

      {/* Main Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        {/* Current Level */}
        <div className="card bg-gradient-to-br from-primary-800 to-primary-600 text-white">
          <div className="flex items-center gap-3 mb-2">
            <BookOpen size={24} />
            <span className="text-sm opacity-90">Current Level</span>
          </div>
          <div className="text-4xl font-bold">{progress.current_level}</div>
          <div className="text-sm opacity-90 mt-1">{progress.current_level_info?.title}</div>
        </div>

        {/* Total XP */}
        <div className="card bg-gradient-to-br from-secondary-500 to-secondary-600 text-white">
          <div className="flex items-center gap-3 mb-2">
            <Zap size={24} />
            <span className="text-sm opacity-90">Total XP</span>
          </div>
          <div className="text-4xl font-bold">{progress.total_xp}</div>
          <div className="text-sm opacity-90 mt-1">Experience Points</div>
        </div>

        {/* Achievements */}
        <div className="card bg-gradient-to-br from-accent-500 to-accent-600 text-white">
          <div className="flex items-center gap-3 mb-2">
            <Trophy size={24} />
            <span className="text-sm opacity-90">Achievements</span>
          </div>
          <div className="text-4xl font-bold">{achievements.length}</div>
          <div className="text-sm opacity-90 mt-1">Unlocked</div>
        </div>

        {/* Completion */}
        <div className="card bg-gradient-to-br from-purple-500 to-purple-600 text-white">
          <div className="flex items-center gap-3 mb-2">
            <CheckCircle size={24} />
            <span className="text-sm opacity-90">Completion</span>
          </div>
          <div className="text-4xl font-bold">{progressPercentage.toFixed(0)}%</div>
          <div className="text-sm opacity-90 mt-1">{completedLevels} of {totalLevels} levels</div>
        </div>
      </div>

      {/* Overall Progress Bar */}
      <div className="card">
        <h2 className="text-2xl font-bold text-gray-900 mb-4 flex items-center gap-2">
          <TrendingUp size={24} className="text-primary-800" />
          Overall Progress
        </h2>
        
        <div className="space-y-4">
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-gray-700">Journey to Noble Sovereign</span>
              <span className="text-sm font-semibold text-gray-900">
                {completedLevels} / {totalLevels} Levels
              </span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-6 overflow-hidden">
              <div
                className="bg-gradient-to-r from-primary-800 to-primary-600 h-6 rounded-full transition-all duration-500 flex items-center justify-center text-white text-sm font-medium"
                style={{ width: `${progressPercentage}%` }}
              >
                {progressPercentage > 10 && `${progressPercentage.toFixed(0)}%`}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-4 gap-2 text-center text-xs text-gray-600">
            <div>
              <div className="font-semibold text-blue-600">Phase I</div>
              <div>Initiation</div>
            </div>
            <div>
              <div className="font-semibold text-green-600">Phase II</div>
              <div>Construction</div>
            </div>
            <div>
              <div className="font-semibold text-purple-600">Phase III</div>
              <div>Integration</div>
            </div>
            <div>
              <div className="font-semibold text-orange-600">Phase IV</div>
              <div>Ascension</div>
            </div>
          </div>
        </div>
      </div>

      {/* Level Progress to Next */}
      {progress.next_level_info && (
        <div className="card">
          <h2 className="text-2xl font-bold text-gray-900 mb-4 flex items-center gap-2">
            <Target size={24} className="text-primary-800" />
            Next Level: {progress.next_level_info.title}
          </h2>
          
          <div className="space-y-2">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-gray-700">XP Progress</span>
              <span className="text-sm font-semibold text-gray-900">
                {progress.xp_to_next_level} XP needed
              </span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-4">
              <div
                className="bg-gradient-to-r from-secondary-500 to-secondary-600 h-4 rounded-full transition-all duration-500"
                style={{ width: `${progress.progress_percent}%` }}
              />
            </div>
            <div className="text-sm text-gray-600 text-center">
              {progress.progress_percent.toFixed(1)}% to Level {progress.next_level_info.level_number}
            </div>
          </div>
        </div>
      )}

      {/* Milestones */}
      <div className="card">
        <h2 className="text-2xl font-bold text-gray-900 mb-6 flex items-center gap-2">
          <Award size={24} className="text-primary-800" />
          Milestones
        </h2>
        
        <div className="space-y-4">
          {milestones.map((milestone, index) => (
            <div
              key={index}
              className={`p-4 rounded-lg border-2 ${
                milestone.reached
                  ? 'bg-green-50 border-green-200'
                  : 'bg-gray-50 border-gray-200'
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div
                    className={`w-12 h-12 rounded-full flex items-center justify-center ${
                      milestone.reached
                        ? 'bg-green-500 text-white'
                        : 'bg-gray-300 text-gray-600'
                    }`}
                  >
                    {milestone.reached ? <CheckCircle size={24} /> : <Target size={24} />}
                  </div>
                  <div>
                    <div className="font-semibold text-gray-900">{milestone.name}</div>
                    <div className="text-sm text-gray-600">Level {milestone.level}</div>
                  </div>
                </div>
                {milestone.reached && (
                  <span className="badge-success">Completed</span>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Achievements */}
      <div className="card">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Trophy size={24} className="text-primary-800" />
            Recent Achievements
          </h2>
          <span className="text-sm text-gray-600">{achievements.length} total</span>
        </div>

        {achievements.length === 0 ? (
          <div className="text-center py-12">
            <Trophy size={48} className="mx-auto text-gray-300 mb-4" />
            <p className="text-gray-500">Complete lessons to earn achievements!</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {achievements.slice(0, 6).map((achievement) => (
              <div
                key={achievement.id}
                className="p-4 bg-secondary-50 border-2 border-secondary-200 rounded-lg"
              >
                <div className="flex items-start gap-3">
                  <div className="p-3 bg-secondary-500 rounded-lg">
                    <Award size={24} className="text-white" />
                  </div>
                  <div className="flex-1">
                    <h3 className="font-semibold text-gray-900 mb-1">
                      {achievement.achievement_type}
                    </h3>
                    <div className="flex items-center gap-2 text-sm text-gray-600">
                      <Calendar size={14} />
                      <span>{new Date(achievement.unlocked_at).toLocaleDateString()}</span>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Call to Action */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Link to="/levels" className="card hover:shadow-lg transition-shadow bg-primary-50 border-primary-200">
          <div className="text-center">
            <BookOpen size={48} className="mx-auto text-primary-800 mb-3" />
            <h3 className="text-xl font-bold text-gray-900 mb-2">Continue Learning</h3>
            <p className="text-gray-600 mb-4">Explore the next level and lessons</p>
            <button className="btn-primary">Go to Levels</button>
          </div>
        </Link>

        <Link to="/leaderboard" className="card hover:shadow-lg transition-shadow bg-secondary-50 border-secondary-200">
          <div className="text-center">
            <TrendingUp size={48} className="mx-auto text-secondary-700 mb-3" />
            <h3 className="text-xl font-bold text-gray-900 mb-2">Check Rankings</h3>
            <p className="text-gray-600 mb-4">See how you compare to others</p>
            <button className="btn-secondary">View Leaderboard</button>
          </div>
        </Link>
      </div>
    </div>
  );
}
