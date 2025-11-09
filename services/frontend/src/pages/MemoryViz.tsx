import { useState, useEffect } from 'react';
import { Brain, Search, Clock, Zap, Database, Filter, Eye } from 'lucide-react';
import type { Memory } from '@/types/chat';
import { memoryService } from '@/services/chat';

type MemoryTier = 'stm' | 'itm' | 'ltm' | 'all';

export default function MemoryViz() {
  const [memories, setMemories] = useState<Memory[]>([]);
  const [filteredMemories, setFilteredMemories] = useState<Memory[]>([]);
  const [selectedTier, setSelectedTier] = useState<MemoryTier>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<any>(null);
  const [selectedMemory, setSelectedMemory] = useState<Memory | null>(null);

  useEffect(() => {
    loadMemories();
    loadStats();
  }, [selectedTier]);

  useEffect(() => {
    filterMemories();
  }, [memories, searchQuery, selectedTier]);

  const loadMemories = async () => {
    setLoading(true);
    try {
      const params = selectedTier !== 'all' ? { tier: selectedTier, limit: 50 } : { limit: 50 };
      const { memories: data } = await memoryService.getMemories(params);
      setMemories(data);
    } catch (error) {
      console.error('Failed to load memories:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadStats = async () => {
    try {
      const data = await memoryService.getStats();
      setStats(data);
    } catch (error) {
      console.error('Failed to load stats:', error);
    }
  };

  const filterMemories = () => {
    let filtered = memories;

    // Filter by tier
    if (selectedTier !== 'all') {
      filtered = filtered.filter(m => m.tier === selectedTier);
    }

    // Filter by search query
    if (searchQuery) {
      filtered = filtered.filter(m =>
        m.input_context.toLowerCase().includes(searchQuery.toLowerCase()) ||
        m.output_response.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }

    setFilteredMemories(filtered);
  };

  const handleSearch = async () => {
    if (!searchQuery.trim()) return;

    setLoading(true);
    try {
      const { memories: results } = await memoryService.searchMemories(searchQuery, 20);
      setMemories(results);
    } catch (error) {
      console.error('Search failed:', error);
    } finally {
      setLoading(false);
    }
  };

  const getTierColor = (tier: string) => {
    switch (tier) {
      case 'stm':
        return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'itm':
        return 'bg-purple-100 text-purple-800 border-purple-200';
      case 'ltm':
        return 'bg-green-100 text-green-800 border-green-200';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const getTierName = (tier: string) => {
    switch (tier) {
      case 'stm':
        return 'Short-Term Memory';
      case 'itm':
        return 'Intermediate-Term Memory';
      case 'ltm':
        return 'Long-Term Memory';
      default:
        return 'Unknown';
    }
  };

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="text-center">
        <h1 className="text-4xl font-bold text-gray-900 mb-2 flex items-center justify-center gap-3">
          <Brain size={40} className="text-accent-600" />
          Memory Visualization
        </h1>
        <p className="text-lg text-gray-600">
          Explore your cognitive memory system - STM, ITM, and LTM
        </p>
      </div>

      {/* Stats Cards */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <div className="card bg-gradient-to-br from-blue-500 to-blue-600 text-white">
            <div className="flex items-center gap-3 mb-2">
              <Clock size={24} />
              <span className="text-sm opacity-90">STM</span>
            </div>
            <div className="text-3xl font-bold">{stats.stm_count}</div>
            <div className="text-sm opacity-90 mt-1">Short-term</div>
          </div>

          <div className="card bg-gradient-to-br from-purple-500 to-purple-600 text-white">
            <div className="flex items-center gap-3 mb-2">
              <Zap size={24} />
              <span className="text-sm opacity-90">ITM</span>
            </div>
            <div className="text-3xl font-bold">{stats.itm_count}</div>
            <div className="text-sm opacity-90 mt-1">Intermediate</div>
          </div>

          <div className="card bg-gradient-to-br from-green-500 to-green-600 text-white">
            <div className="flex items-center gap-3 mb-2">
              <Database size={24} />
              <span className="text-sm opacity-90">LTM</span>
            </div>
            <div className="text-3xl font-bold">{stats.ltm_count}</div>
            <div className="text-sm opacity-90 mt-1">Long-term</div>
          </div>

          <div className="card bg-gradient-to-br from-gray-700 to-gray-800 text-white">
            <div className="flex items-center gap-3 mb-2">
              <Brain size={24} />
              <span className="text-sm opacity-90">Total</span>
            </div>
            <div className="text-3xl font-bold">{stats.total_memories}</div>
            <div className="text-sm opacity-90 mt-1">All memories</div>
          </div>
        </div>
      )}

      {/* Search and Filter */}
      <div className="card">
        <div className="flex flex-col md:flex-row gap-4">
          <div className="flex-1">
            <div className="flex gap-2">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
                placeholder="Search memories by content..."
                className="input"
              />
              <button onClick={handleSearch} className="btn-primary">
                <Search size={20} />
              </button>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Filter size={20} className="text-gray-600" />
            <select
              value={selectedTier}
              onChange={(e) => setSelectedTier(e.target.value as MemoryTier)}
              className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
            >
              <option value="all">All Tiers</option>
              <option value="stm">Short-Term (STM)</option>
              <option value="itm">Intermediate (ITM)</option>
              <option value="ltm">Long-Term (LTM)</option>
            </select>
          </div>
        </div>
      </div>

      {/* Memory List */}
      <div className="space-y-4">
        {loading ? (
          <div className="flex items-center justify-center h-64">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-800"></div>
          </div>
        ) : filteredMemories.length === 0 ? (
          <div className="card text-center py-12">
            <Brain size={48} className="mx-auto text-gray-300 mb-4" />
            <h3 className="text-xl font-bold text-gray-900 mb-2">No Memories Found</h3>
            <p className="text-gray-600">
              {searchQuery ? 'Try a different search query' : 'Start chatting or completing lessons to create memories'}
            </p>
          </div>
        ) : (
          <>
            <div className="text-sm text-gray-600 mb-4">
              Showing {filteredMemories.length} {selectedTier !== 'all' ? getTierName(selectedTier) : 'memories'}
            </div>

            {filteredMemories.map((memory) => (
              <div
                key={memory.id}
                className="card hover:shadow-lg transition-shadow cursor-pointer"
                onClick={() => setSelectedMemory(memory)}
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <span className={`badge border-2 ${getTierColor(memory.tier)}`}>
                      {memory.tier.toUpperCase()}
                    </span>
                    <span className="badge bg-gray-100 text-gray-700 capitalize">
                      {memory.type}
                    </span>
                  </div>
                  <div className="text-sm text-gray-500">
                    {new Date(memory.created_at).toLocaleDateString()}
                  </div>
                </div>

                <div className="space-y-2">
                  <div>
                    <div className="text-xs font-semibold text-gray-500 mb-1">Context:</div>
                    <p className="text-sm text-gray-700 line-clamp-2">{memory.input_context}</p>
                  </div>
                  <div>
                    <div className="text-xs font-semibold text-gray-500 mb-1">Response:</div>
                    <p className="text-sm text-gray-700 line-clamp-2">{memory.output_response}</p>
                  </div>
                </div>

                <div className="flex items-center gap-4 mt-3 text-xs text-gray-500">
                  <span>Accessed: {memory.access_count}x</span>
                  {memory.confidence_score && (
                    <span>Confidence: {(memory.confidence_score * 100).toFixed(0)}%</span>
                  )}
                  {memory.emotional_weight && (
                    <span>Emotional: {memory.emotional_weight.toFixed(1)}</span>
                  )}
                </div>
              </div>
            ))}
          </>
        )}
      </div>

      {/* Memory Detail Modal */}
      {selectedMemory && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4"
          onClick={() => setSelectedMemory(null)}
        >
          <div
            className="bg-white rounded-2xl shadow-2xl max-w-3xl w-full max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
                  <Eye size={28} className="text-accent-600" />
                  Memory Details
                </h2>
                <button
                  onClick={() => setSelectedMemory(null)}
                  className="text-gray-500 hover:text-gray-700"
                >
                  ✕
                </button>
              </div>

              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <span className={`badge border-2 ${getTierColor(selectedMemory.tier)}`}>
                    {getTierName(selectedMemory.tier)}
                  </span>
                  <span className="badge bg-gray-100 text-gray-700 capitalize">
                    {selectedMemory.type}
                  </span>
                  <span className={`badge ${
                    selectedMemory.outcome === 'success' ? 'badge-success' :
                    selectedMemory.outcome === 'failure' ? 'bg-red-100 text-red-800' :
                    'bg-gray-100 text-gray-700'
                  }`}>
                    {selectedMemory.outcome}
                  </span>
                </div>

                <div>
                  <h3 className="font-semibold text-gray-900 mb-2">Input Context</h3>
                  <div className="p-4 bg-gray-50 rounded-lg text-gray-700">
                    {selectedMemory.input_context}
                  </div>
                </div>

                <div>
                  <h3 className="font-semibold text-gray-900 mb-2">Output Response</h3>
                  <div className="p-4 bg-gray-50 rounded-lg text-gray-700">
                    {selectedMemory.output_response}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="p-3 bg-blue-50 rounded-lg">
                    <div className="text-sm text-blue-600 font-semibold">Access Count</div>
                    <div className="text-2xl font-bold text-blue-900">{selectedMemory.access_count}</div>
                  </div>
                  {selectedMemory.confidence_score && (
                    <div className="p-3 bg-purple-50 rounded-lg">
                      <div className="text-sm text-purple-600 font-semibold">Confidence</div>
                      <div className="text-2xl font-bold text-purple-900">
                        {(selectedMemory.confidence_score * 100).toFixed(0)}%
                      </div>
                    </div>
                  )}
                </div>

                {selectedMemory.tags && selectedMemory.tags.length > 0 && (
                  <div>
                    <h3 className="font-semibold text-gray-900 mb-2">Tags</h3>
                    <div className="flex flex-wrap gap-2">
                      {selectedMemory.tags.map((tag, idx) => (
                        <span key={idx} className="badge bg-accent-100 text-accent-800">
                          {tag}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                <div className="text-sm text-gray-500 pt-4 border-t">
                  <div>Created: {new Date(selectedMemory.created_at).toLocaleString()}</div>
                  {selectedMemory.last_accessed_at && (
                    <div>Last Accessed: {new Date(selectedMemory.last_accessed_at).toLocaleString()}</div>
                  )}
                  {selectedMemory.expires_at && (
                    <div>Expires: {new Date(selectedMemory.expires_at).toLocaleString()}</div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
