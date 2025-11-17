import { useEffect } from 'react';
import { useCurriculumStore } from '@/stores/curriculumStore';
import { useAuthStore } from '@/stores/authStore';
import { Trophy, Medal, Award, TrendingUp, Zap } from 'lucide-react';

export default function Leaderboard() {
  const { user } = useAuthStore();
  const { leaderboard, progress, fetchLeaderboard, fetchProgress } = useCurriculumStore();

  useEffect(() => {
    void fetchLeaderboard(50);
    void fetchProgress();
  }, [fetchLeaderboard, fetchProgress]);

  const getMedalIcon = (rank: number) => {
    switch (rank) {
      case 1:
        return <Trophy size={32} className="text-yellow-500" />;
      case 2:
        return <Medal size={32} className="text-gray-400" />;
      case 3:
        return <Medal size={32} className="text-orange-600" />;
      default:
        return <Award size={32} className="text-gray-300" />;
    }
  };

  const getRankColor = (rank: number) => {
    switch (rank) {
      case 1:
        return 'bg-yellow-50 border-yellow-200';
      case 2:
        return 'bg-gray-50 border-gray-200';
      case 3:
        return 'bg-orange-50 border-orange-200';
      default:
        return 'bg-white border-gray-200';
    }
  };

  const isCurrentUser = (userId: string) => user?.id === userId;

  const currentUserRank = leaderboard.findIndex(entry => entry.user_id === user?.id) + 1;

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="text-center">
        <h1 className="text-4xl font-bold text-gray-900 mb-2">Leaderboard</h1>
        <p className="text-lg text-gray-600">
          Top performers in the Noble Growth School
        </p>
      </div>

      {/* User Stats Card */}
      {progress && (
        <div className="card bg-gradient-to-r from-primary-800 to-primary-600 text-white">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm text-primary-200">Your Rank</div>
              <div className="text-5xl font-bold">#{currentUserRank || '?'}</div>
            </div>
            <div className="text-right">
              <div className="text-sm text-primary-200">Total XP</div>
              <div className="text-4xl font-bold">{progress.total_xp}</div>
              <div className="text-primary-100 mt-1">Level {progress.current_level}</div>
            </div>
          </div>
        </div>
      )}

      {/* Top 3 Podium */}
      {leaderboard.length >= 3 && (
        <div className="grid grid-cols-3 gap-4 mb-8">
          {/* Second Place */}
          <div className="col-span-1 pt-12">
            <div className="card text-center border-2 border-gray-300 bg-gray-50">
              <div className="flex justify-center mb-3">
                {getMedalIcon(2)}
              </div>
              <div className="text-3xl font-bold text-gray-700">#2</div>
              <div className="text-sm text-gray-500 mt-2">
                Level {leaderboard[1].current_level}
              </div>
              <div className="text-lg font-semibold text-gray-900 mt-1">
                {leaderboard[1].total_xp} XP
              </div>
            </div>
          </div>

          {/* First Place */}
          <div className="col-span-1">
            <div className="card text-center border-2 border-yellow-400 bg-yellow-50 shadow-lg transform scale-105">
              <div className="flex justify-center mb-3">
                {getMedalIcon(1)}
              </div>
              <div className="text-4xl font-bold text-yellow-700">#1</div>
              <div className="text-sm text-gray-600 mt-2">
                Level {leaderboard[0].current_level}
              </div>
              <div className="text-xl font-semibold text-gray-900 mt-1">
                {leaderboard[0].total_xp} XP
              </div>
            </div>
          </div>

          {/* Third Place */}
          <div className="col-span-1 pt-12">
            <div className="card text-center border-2 border-orange-300 bg-orange-50">
              <div className="flex justify-center mb-3">
                {getMedalIcon(3)}
              </div>
              <div className="text-3xl font-bold text-orange-700">#3</div>
              <div className="text-sm text-gray-500 mt-2">
                Level {leaderboard[2].current_level}
              </div>
              <div className="text-lg font-semibold text-gray-900 mt-1">
                {leaderboard[2].total_xp} XP
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Full Leaderboard List */}
      <div className="card">
        <h2 className="text-2xl font-bold text-gray-900 mb-6 flex items-center gap-2">
          <TrendingUp size={24} className="text-primary-800" />
          All Rankings
        </h2>

        <div className="space-y-2">
          {leaderboard.map((entry, index) => {
            const rank = index + 1;
            const isCurrent = isCurrentUser(entry.user_id);

            return (
              <div
                key={entry.user_id}
                className={`p-4 rounded-lg border-2 transition-all ${
                  isCurrent
                    ? 'border-primary-500 bg-primary-50 shadow-md'
                    : getRankColor(rank)
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    {/* Rank */}
                    <div className="flex items-center justify-center w-12 h-12">
                      {rank <= 3 ? (
                        <div className="flex items-center justify-center">
                          {getMedalIcon(rank)}
                        </div>
                      ) : (
                        <div className="text-2xl font-bold text-gray-500">#{rank}</div>
                      )}
                    </div>

                    {/* User Info */}
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-gray-900">
                          {isCurrent ? 'You' : `User ${entry.user_id.slice(0, 8)}`}
                        </span>
                        {isCurrent && (
                          <span className="badge-primary text-xs">You</span>
                        )}
                      </div>
                      <div className="text-sm text-gray-600">
                        Level {entry.current_level}
                      </div>
                    </div>
                  </div>

                  {/* XP */}
                  <div className="text-right">
                    <div className="flex items-center gap-2 justify-end">
                      <Zap size={20} className="text-secondary-600" />
                      <span className="text-2xl font-bold text-gray-900">
                        {entry.total_xp}
                      </span>
                    </div>
                    <div className="text-sm text-gray-500">XP</div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {leaderboard.length === 0 && (
          <div className="text-center py-12 text-gray-500">
            <Trophy size={48} className="mx-auto mb-4 text-gray-300" />
            <p>No leaderboard data available yet.</p>
            <p className="text-sm mt-2">Be the first to earn XP!</p>
          </div>
        )}
      </div>

      {/* Motivational Footer */}
      <div className="card bg-gradient-to-r from-accent-500 to-accent-600 text-white text-center">
        <h3 className="text-xl font-bold mb-2">Keep Learning!</h3>
        <p className="text-accent-100">
          Complete lessons, earn XP, and climb the ranks to become a Noble Sovereign
        </p>
      </div>
    </div>
  );
}
