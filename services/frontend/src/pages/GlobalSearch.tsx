import { useState, useEffect } from 'react';
import { Search, Filter, FileText, Video, Users, BookOpen, X } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useAuthStore } from '@/stores/authStore';
import { PageLoading } from '@/components/LoadingSpinner';
import { SearchEmptyState } from '@/components/EmptyState';
import ErrorBoundary from '@/components/ErrorBoundary';
import Modal from '@/components/Modal';

const searchSchema = z.object({
  query: z.string().min(1, 'Search query is required'),
  type: z.enum(['all', 'lessons', 'notes', 'users', 'challenges']).default('all'),
  level: z.string().optional(),
});

type SearchFormData = z.infer<typeof searchSchema>;

interface SearchResult {
  id: string;
  type: 'lesson' | 'note' | 'user' | 'challenge';
  title: string;
  description?: string;
  url: string;
  metadata?: {
    author?: string;
    level?: number;
    tags?: string[];
    created?: string;
  };
}

export default function GlobalSearch() {
  const { user } = useAuthStore();
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [selectedResult, setSelectedResult] = useState<SearchResult | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors },
    watch,
    reset
  } = useForm<SearchFormData>({
    resolver: zodResolver(searchSchema),
    defaultValues: {
      type: 'all'
    }
  });

  const searchType = watch('type');

  const onSubmit = async (data: SearchFormData) => {
    setLoading(true);
    setHasSearched(true);

    try {
      const searchParams = new URLSearchParams({
        q: data.query,
        type: data.type,
        ...(data.level && { level: data.level })
      });

      const response = await fetch(`/api/search/global?${searchParams}`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('access_token')}`
        }
      });

      const searchResults = await response.json();
      setResults(searchResults.results || []);
    } catch (error) {
      console.error('Search failed:', error);
      setResults([]);
    } finally {
      setLoading(false);
    }
  };

  const getIcon = (type: string) => {
    switch (type) {
      case 'lesson':
        return <BookOpen size={20} className="text-blue-600" />;
      case 'note':
        return <FileText size={20} className="text-green-600" />;
      case 'user':
        return <Users size={20} className="text-purple-600" />;
      case 'challenge':
        return <Video size={20} className="text-orange-600" />;
      default:
        return <Search size={20} className="text-gray-600" />;
    }
  };

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'lesson':
        return 'bg-blue-100 text-blue-800';
      case 'note':
        return 'bg-green-100 text-green-800';
      case 'user':
        return 'bg-purple-100 text-purple-800';
      case 'challenge':
        return 'bg-orange-100 text-orange-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const handleResultClick = (result: SearchResult) => {
    if (result.url.startsWith('http')) {
      window.open(result.url, '_blank');
    } else {
      window.location.href = result.url;
    }
  };

  return (
    <ErrorBoundary>
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header */}
        <div className="text-center">
          <h1 className="text-3xl font-bold text-gray-900 mb-2 flex items-center justify-center gap-3">
            <Search size={32} className="text-primary-800" />
            Global Search
          </h1>
          <p className="text-gray-600">
            Search across lessons, notes, users, and challenges
          </p>
        </div>

        {/* Search Form */}
        <div className="card">
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div className="relative">
              <Search size={20} className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
              <input
                {...register('query')}
                type="text"
                className={`input pl-12 text-lg ${errors.query ? 'border-red-500 focus:ring-red-500' : ''}`}
                placeholder="Search for anything..."
                disabled={loading}
              />
              {errors.query && (
                <p className="mt-1 text-sm text-red-600">{errors.query.message}</p>
              )}
            </div>

            <div className="flex flex-wrap gap-4">
              {/* Search Type Filter */}
              <div className="flex items-center gap-2">
                <Filter size={16} className="text-gray-600" />
                <select
                  {...register('type')}
                  className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                  disabled={loading}
                >
                  <option value="all">All Content</option>
                  <option value="lessons">Lessons</option>
                  <option value="notes">Notes</option>
                  <option value="challenges">Challenges</option>
                  {user?.role === 'admin' && (
                    <option value="users">Users</option>
                  )}
                </select>
              </div>

              {/* Level Filter (for lessons/challenges) */}
              {(searchType === 'lessons' || searchType === 'challenges' || searchType === 'all') && (
                <div className="flex items-center gap-2">
                  <span className="text-sm text-gray-600">Level:</span>
                  <select
                    {...register('level')}
                    className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                    disabled={loading}
                  >
                    <option value="">Any Level</option>
                    {[...Array(20)].map((_, i) => (
                      <option key={i + 1} value={i + 1}>Level {i + 1}</option>
                    ))}
                  </select>
                </div>
              )}

              <button
                type="button"
                onClick={() => {
                  reset({ query: '', type: 'all', level: '' });
                  setResults([]);
                  setHasSearched(false);
                }}
                className="px-3 py-2 text-gray-600 hover:text-gray-800 transition-colors"
                disabled={loading}
              >
                Clear
              </button>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="btn-primary flex items-center gap-2"
            >
              {loading ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" />
                  Searching...
                </>
              ) : (
                <>
                  <Search size={16} />
                  Search
                </>
              )}
            </button>
          </form>
        </div>

        {/* Results */}
        {loading ? (
          <PageLoading text="Searching..." />
        ) : hasSearched ? (
          results.length === 0 ? (
            <SearchEmptyState
              query={watch('query')}
              action={
                <button
                  onClick={() => {
                    reset({ query: '', type: 'all', level: '' });
                    setResults([]);
                    setHasSearched(false);
                  }}
                  className="btn-outline"
                >
                  Clear Search
                </button>
              }
            />
          ) : (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-gray-900">
                  {results.length} {results.length === 1 ? 'result' : 'results'} found
                </h3>
                <span className="text-sm text-gray-500">
                  for "{watch('query')}"
                </span>
              </div>

              <div className="space-y-3">
                {results.map((result) => (
                  <div
                    key={result.id}
                    className="card hover:shadow-lg transition-shadow cursor-pointer"
                    onClick={() => handleResultClick(result)}
                  >
                    <div className="flex items-start gap-4">
                      <div className="flex-shrink-0">
                        {getIcon(result.type)}
                      </div>
                      
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-2">
                          <h4 className="text-lg font-medium text-gray-900 truncate">
                            {result.title}
                          </h4>
                          <span className={`badge text-xs ${getTypeColor(result.type)}`}>
                            {result.type}
                          </span>
                        </div>
                        
                        {result.description && (
                          <p className="text-gray-600 text-sm mb-2 line-clamp-2">
                            {result.description}
                          </p>
                        )}
                        
                        {result.metadata && (
                          <div className="flex flex-wrap gap-3 text-xs text-gray-500">
                            {result.metadata.author && (
                              <span>By {result.metadata.author}</span>
                            )}
                            {result.metadata.level && (
                              <span>Level {result.metadata.level}</span>
                            )}
                            {result.metadata.created && (
                              <span>{new Date(result.metadata.created).toLocaleDateString()}</span>
                            )}
                          </div>
                        )}
                        
                        {result.metadata?.tags && (
                          <div className="flex flex-wrap gap-1 mt-2">
                            {result.metadata.tags.slice(0, 3).map((tag, index) => (
                              <span key={index} className="badge badge-secondary text-xs">
                                {tag}
                              </span>
                            ))}
                            {result.metadata.tags.length > 3 && (
                              <span className="text-xs text-gray-500">
                                +{result.metadata.tags.length - 3} more
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )
        ) : null}

        {/* Quick Search Tips */}
        {!hasSearched && (
          <div className="card bg-gray-50">
            <h3 className="text-lg font-semibold text-gray-900 mb-3">Search Tips</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm text-gray-600">
              <div>
                <h4 className="font-medium text-gray-800 mb-1">Content Types</h4>
                <ul className="space-y-1">
                  <li>• <strong>Lessons</strong> - Learning content and tutorials</li>
                  <li>• <strong>Notes</strong> - Your personal study notes</li>
                  <li>• <strong>Challenges</strong> - Coding challenges and exercises</li>
                </ul>
              </div>
              <div>
                <h4 className="font-medium text-gray-800 mb-1">Search Examples</h4>
                <ul className="space-y-1">
                  <li>• "React components"</li>
                  <li>• "JavaScript functions level 3"</li>
                  <li>• "Machine learning basics"</li>
                </ul>
              </div>
            </div>
          </div>
        )}
      </div>
    </ErrorBoundary>
  );
}