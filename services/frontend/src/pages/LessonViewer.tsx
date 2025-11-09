import { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useCurriculumStore } from '@/stores/curriculumStore';
import ReactMarkdown from 'react-markdown';
import { 
  Clock, 
  Award, 
  ChevronLeft, 
  ChevronRight, 
  Check,
  BookOpen,
  Sparkles,
  MessageSquare,
  Bot
} from 'lucide-react';
import type { Lesson } from '@/types/curriculum';
import curriculumService from '@/services/curriculum';

export default function LessonViewer() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { refreshProgress } = useCurriculumStore();
  const [lesson, setLesson] = useState<Lesson | null>(null);
  const [loading, setLoading] = useState(true);
  const [completing, setCompleting] = useState(false);
  const [reflectionText, setReflectionText] = useState('');
  const [showReflection, setShowReflection] = useState(false);
  const [timeSpent, setTimeSpent] = useState(0);

  useEffect(() => {
    if (id) {
      loadLesson(id);
    }
  }, [id]);

  useEffect(() => {
    // Track time spent
    const timer = setInterval(() => {
      setTimeSpent(prev => prev + 1);
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  const loadLesson = async (lessonId: string) => {
    setLoading(true);
    try {
      const lessonData = await curriculumService.getLesson(lessonId);
      setLesson(lessonData);
    } catch (error) {
      console.error('Failed to load lesson:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleComplete = async () => {
    if (!lesson || !reflectionText.trim()) {
      alert('Please write a reflection before completing the lesson.');
      return;
    }

    setCompleting(true);
    try {
      const result = await curriculumService.completeLesson(lesson.id, {
        time_spent_seconds: timeSpent,
        reflection_text: reflectionText,
        score: 100,
      });

      // Refresh progress
      await refreshProgress();

      // Show success message
      alert(`Lesson completed! You earned ${result.xp_awarded} XP!`);

      // Navigate back to levels
      navigate('/levels');
    } catch (error: any) {
      console.error('Failed to complete lesson:', error);
      alert(error.response?.data?.message || 'Failed to complete lesson');
    } finally {
      setCompleting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-800"></div>
      </div>
    );
  }

  if (!lesson) {
    return (
      <div className="max-w-4xl mx-auto">
        <div className="card text-center">
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Lesson Not Found</h2>
          <p className="text-gray-600 mb-4">The lesson you're looking for doesn't exist.</p>
          <Link to="/levels" className="btn-primary">
            Back to Levels
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <Link to="/levels" className="flex items-center gap-2 text-gray-600 hover:text-gray-900">
          <ChevronLeft size={20} />
          <span>Back to Levels</span>
        </Link>

        {lesson.completed && (
          <span className="badge-success">
            <Check size={16} className="inline mr-1" />
            Completed
          </span>
        )}
      </div>

      {/* Lesson Card */}
      <div className="card">
        {/* Title and Meta */}
        <div className="border-b border-gray-200 pb-4 mb-6">
          <div className="flex items-center gap-2 text-sm text-gray-500 mb-2">
            <BookOpen size={16} />
            <span>Level {lesson.level_id}</span>
            <span>•</span>
            <span className="capitalize">{lesson.lesson_type}</span>
          </div>
          
          <h1 className="text-3xl font-bold text-gray-900 mb-4">{lesson.title}</h1>
          
          <div className="flex items-center gap-6 text-sm text-gray-600">
            <div className="flex items-center gap-2">
              <Clock size={16} />
              <span>{lesson.estimated_minutes} minutes</span>
            </div>
            <div className="flex items-center gap-2">
              <Award size={16} />
              <span>{lesson.xp_reward} XP</span>
            </div>
          </div>
        </div>

        {/* Core Lesson */}
        <div className="mb-8">
          <div className="flex items-center gap-2 text-primary-800 font-semibold mb-3">
            <BookOpen size={20} />
            <h2 className="text-xl">Core Lesson</h2>
          </div>
          <div className="prose prose-sm max-w-none text-gray-700">
            <ReactMarkdown>{lesson.core_lesson}</ReactMarkdown>
          </div>
        </div>

        {/* Human Practice */}
        <div className="mb-8 p-4 bg-accent-50 border border-accent-200 rounded-lg">
          <div className="flex items-center gap-2 text-accent-800 font-semibold mb-3">
            <Sparkles size={20} />
            <h2 className="text-xl">Human Practice</h2>
          </div>
          <div className="prose prose-sm max-w-none text-gray-700">
            <ReactMarkdown>{lesson.human_practice}</ReactMarkdown>
          </div>
        </div>

        {/* Reflection Prompt */}
        <div className="mb-8 p-4 bg-purple-50 border border-purple-200 rounded-lg">
          <div className="flex items-center gap-2 text-purple-800 font-semibold mb-3">
            <MessageSquare size={20} />
            <h2 className="text-xl">Reflection Prompt</h2>
          </div>
          <div className="prose prose-sm max-w-none text-gray-700">
            <ReactMarkdown>{lesson.reflection_prompt}</ReactMarkdown>
          </div>
        </div>

        {/* Agent Unlock */}
        {lesson.agent_unlock && (
          <div className="mb-8 p-4 bg-secondary-50 border border-secondary-200 rounded-lg">
            <div className="flex items-center gap-2 text-secondary-800 font-semibold mb-3">
              <Bot size={20} />
              <h2 className="text-xl">Agent Unlock</h2>
            </div>
            <div className="prose prose-sm max-w-none text-gray-700">
              <ReactMarkdown>{lesson.agent_unlock}</ReactMarkdown>
            </div>
          </div>
        )}

        {/* Reflection Input */}
        {!lesson.completed && (
          <div className="border-t border-gray-200 pt-6">
            <button
              onClick={() => setShowReflection(!showReflection)}
              className="btn-primary w-full mb-4"
            >
              {showReflection ? 'Hide Reflection' : 'Write Reflection & Complete Lesson'}
            </button>

            {showReflection && (
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Your Reflection
                  </label>
                  <textarea
                    value={reflectionText}
                    onChange={(e) => setReflectionText(e.target.value)}
                    className="w-full h-40 px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 resize-none"
                    placeholder="Write your reflection here... (minimum 50 characters for quality reflection)"
                  />
                  <div className="text-sm text-gray-500 mt-2">
                    {reflectionText.length} characters
                    {reflectionText.length < 50 && ' (minimum 50 for quality reflection)'}
                  </div>
                </div>

                <button
                  onClick={handleComplete}
                  disabled={completing || reflectionText.length < 10}
                  className="btn-secondary w-full py-3 text-lg disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {completing ? 'Completing...' : `Complete Lesson & Earn ${lesson.xp_reward} XP`}
                </button>
              </div>
            )}
          </div>
        )}

        {/* Already completed message */}
        {lesson.completed && (
          <div className="border-t border-gray-200 pt-6">
            <div className="bg-green-50 border border-green-200 rounded-lg p-4 text-center">
              <Check size={32} className="mx-auto text-green-600 mb-2" />
              <p className="text-green-800 font-medium">
                You've already completed this lesson!
              </p>
              <p className="text-sm text-green-600 mt-1">
                Completed on {new Date(lesson.completed_at || '').toLocaleDateString()}
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Navigation */}
      <div className="flex items-center justify-between">
        <button className="btn-outline flex items-center gap-2" disabled>
          <ChevronLeft size={20} />
          <span>Previous Lesson</span>
        </button>

        <button className="btn-outline flex items-center gap-2" disabled>
          <span>Next Lesson</span>
          <ChevronRight size={20} />
        </button>
      </div>
    </div>
  );
}
