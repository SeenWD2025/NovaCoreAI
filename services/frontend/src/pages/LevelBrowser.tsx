import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useCurriculumStore } from '@/stores/curriculumStore';
import { Lock, Check, BookOpen, Award } from 'lucide-react';
import type { Lesson } from '@/types/curriculum';
import curriculumService from '@/services/curriculum';

const PHASES = [
  { name: 'Phase I: INITIATION', levels: [1, 2, 3, 4, 5, 6], color: 'blue' },
  { name: 'Phase II: CONSTRUCTION', levels: [7, 8, 9, 10, 11, 12], color: 'green' },
  { name: 'Phase III: INTEGRATION', levels: [13, 14, 15, 16, 17, 18], color: 'purple' },
  { name: 'Phase IV: ASCENSION', levels: [19, 20, 21, 22, 23, 24], color: 'orange' },
];

export default function LevelBrowser() {
  const { progress, levels, fetchProgress, fetchLevels } = useCurriculumStore();
  const [lessonsByLevel, setLessonsByLevel] = useState<Record<number, Lesson[]>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadData = async () => {
      await Promise.all([fetchProgress(), fetchLevels()]);
      setLoading(false);
    };
    loadData();
  }, []);

  const isLevelUnlocked = (levelNumber: number) => {
    if (!progress) return false;
    return levelNumber <= progress.current_level;
  };

  const isLevelCompleted = (levelNumber: number) => {
    if (!progress) return false;
    return levelNumber < progress.current_level;
  };

  const loadLessonsForLevel = async (levelNumber: number) => {
    if (lessonsByLevel[levelNumber]) return;
    
    try {
      const { lessons } = await curriculumService.getLessonsByLevel(levelNumber);
      setLessonsByLevel(prev => ({ ...prev, [levelNumber]: lessons }));
    } catch (error) {
      console.error('Failed to load lessons:', error);
    }
  };

  const getPhaseColor = (color: string) => {
    const colors = {
      blue: 'border-blue-200 bg-blue-50',
      green: 'border-green-200 bg-green-50',
      purple: 'border-purple-200 bg-purple-50',
      orange: 'border-orange-200 bg-orange-50',
    };
    return colors[color as keyof typeof colors] || colors.blue;
  };

  const getPhaseHeaderColor = (color: string) => {
    const colors = {
      blue: 'text-blue-800',
      green: 'text-green-800',
      purple: 'text-purple-800',
      orange: 'text-orange-800',
    };
    return colors[color as keyof typeof colors] || colors.blue;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-800"></div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-4xl font-bold text-gray-900 mb-2">Noble Growth School</h1>
        <p className="text-lg text-gray-600">
          24 levels of transformative learning - From Awakener to Noble Sovereign
        </p>
      </div>

      {/* Progress Summary */}
      {progress && (
        <div className="card bg-gradient-to-r from-primary-800 to-primary-600 text-white">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm text-primary-200">Your Progress</div>
              <div className="text-3xl font-bold">Level {progress.current_level}</div>
              <div className="text-primary-100 mt-1">{progress.current_level_info?.title}</div>
            </div>
            <div className="text-right">
              <div className="text-4xl font-bold">{progress.total_xp}</div>
              <div className="text-sm text-primary-200">Total XP</div>
            </div>
          </div>
        </div>
      )}

      {/* Agent Unlock Special */}
      {progress && progress.current_level >= 12 && progress.agent_creation_unlocked && (
        <div className="card bg-gradient-to-r from-purple-500 to-purple-600 text-white">
          <div className="flex items-center gap-4">
            <div className="p-4 bg-white bg-opacity-20 rounded-full">
              <Award size={32} />
            </div>
            <div>
              <h3 className="text-2xl font-bold mb-1">🔓 Agent Creation Unlocked!</h3>
              <p className="text-purple-100">
                Congratulations! You've reached Level 12 and can now create your own AI agents.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Phases */}
      {PHASES.map((phase) => (
        <div key={phase.name} className="space-y-4">
          <h2 className={`text-2xl font-bold ${getPhaseHeaderColor(phase.color)}`}>
            {phase.name}
          </h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {phase.levels.map((levelNum) => {
              const level = levels.find(l => l.level_number === levelNum);
              const unlocked = isLevelUnlocked(levelNum);
              const completed = isLevelCompleted(levelNum);
              const isCurrent = progress?.current_level === levelNum;

              return (
                <div
                  key={levelNum}
                  className={`card border-2 transition-all ${
                    isCurrent
                      ? 'border-primary-500 shadow-lg'
                      : unlocked
                      ? 'border-gray-200 hover:border-gray-300 hover:shadow-md'
                      : 'border-gray-100 bg-gray-50 opacity-60'
                  }`}
                >
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <div
                        className={`w-12 h-12 rounded-full flex items-center justify-center text-xl font-bold ${
                          completed
                            ? 'bg-green-500 text-white'
                            : isCurrent
                            ? 'bg-primary-500 text-white'
                            : unlocked
                            ? 'bg-gray-200 text-gray-700'
                            : 'bg-gray-100 text-gray-400'
                        }`}
                      >
                        {completed ? <Check size={24} /> : levelNum}
                      </div>
                      <div>
                        <div className="text-sm text-gray-500">Level {levelNum}</div>
                        {level && (
                          <h3 className="font-semibold text-gray-900">{level.title}</h3>
                        )}
                      </div>
                    </div>
                    {!unlocked && <Lock size={20} className="text-gray-400" />}
                    {isCurrent && (
                      <span className="badge-primary text-xs">Current</span>
                    )}
                  </div>

                  {level && (
                    <>
                      <p className="text-sm text-gray-600 mb-4 line-clamp-3">
                        {level.description}
                      </p>

                      <div className="flex items-center justify-between text-sm text-gray-500 mb-4">
                        <span>🎯 {level.xp_required} XP required</span>
                      </div>

                      {unlocked ? (
                        <button
                          onClick={() => loadLessonsForLevel(levelNum)}
                          className="btn-outline w-full text-sm"
                        >
                          <BookOpen size={16} className="inline mr-2" />
                          {lessonsByLevel[levelNum] ? 'View Lessons' : 'Load Lessons'}
                        </button>
                      ) : (
                        <div className="text-sm text-center text-gray-400 py-2">
                          <Lock size={16} className="inline mr-2" />
                          Locked
                        </div>
                      )}

                      {/* Show lessons if loaded */}
                      {lessonsByLevel[levelNum] && (
                        <div className="mt-4 space-y-2">
                          <div className="text-xs font-semibold text-gray-700 mb-2">
                            Lessons:
                          </div>
                          {lessonsByLevel[levelNum].map((lesson) => (
                            <Link
                              key={lesson.id}
                              to={`/lessons/${lesson.id}`}
                              className="block p-2 bg-gray-50 rounded hover:bg-gray-100 text-sm"
                            >
                              <div className="flex items-center justify-between">
                                <span className="text-gray-700">{lesson.title}</span>
                                {lesson.completed && (
                                  <Check size={16} className="text-green-600" />
                                )}
                              </div>
                            </Link>
                          ))}
                        </div>
                      )}

                      {/* Special Level 12 indicator */}
                      {levelNum === 12 && (
                        <div className="mt-4 p-3 bg-purple-50 border border-purple-200 rounded-lg">
                          <div className="text-sm font-medium text-purple-800 flex items-center gap-2">
                            <Award size={16} />
                            Agent Creation Unlocks Here
                          </div>
                        </div>
                      )}
                    </>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
