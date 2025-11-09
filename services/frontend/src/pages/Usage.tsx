import React, { useEffect, useState } from 'react';
import { api } from '../services/api';

interface UsageBreakdown {
  resourceType: string;
  amount: number;
  humanReadable?: string;
  percentage?: number;
}

interface UsageStats {
  userId: string;
  period: string;
  breakdown: UsageBreakdown[];
  limits: {
    llmTokensDay: number;
    memoryStorageBytes: number;
    agentMinutesMonth: number;
  };
  warnings: string[];
  timestamp: string;
}

interface TokenUsage {
  used: number;
  limit: number;
  percentage: number;
}

interface StorageUsage {
  used: number;
  limit: number;
  percentage: number;
  humanReadable: string;
}

const Usage: React.FC = () => {
  const [usageStats, setUsageStats] = useState<UsageStats | null>(null);
  const [tokenUsage, setTokenUsage] = useState<TokenUsage | null>(null);
  const [storageUsage, setStorageUsage] = useState<StorageUsage | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [timeRange, setTimeRange] = useState(30);

  useEffect(() => {
    fetchUsageData();
  }, [timeRange]);

  const fetchUsageData = async () => {
    try {
      setLoading(true);
      setError(null);

      // Fetch comprehensive usage stats
      const statsResponse = await api.get(`/api/usage/stats?days=${timeRange}`);
      setUsageStats(statsResponse.data);

      // Fetch token usage
      const tokenResponse = await api.get('/api/usage/tokens');
      setTokenUsage(tokenResponse.data);

      // Fetch storage usage
      const storageResponse = await api.get('/api/usage/storage');
      setStorageUsage(storageResponse.data);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to fetch usage data');
      console.error('Error fetching usage:', err);
    } finally {
      setLoading(false);
    }
  };

  const getProgressBarColor = (percentage: number): string => {
    if (percentage >= 100) return 'bg-red-500';
    if (percentage >= 80) return 'bg-yellow-500';
    return 'bg-green-500';
  };

  const formatNumber = (num: number): string => {
    return num.toLocaleString();
  };

  const formatLimit = (limit: number): string => {
    if (limit === -1) return 'Unlimited';
    return formatNumber(limit);
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6">
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">
          <p>{error}</p>
          <button
            onClick={fetchUsageData}
            className="mt-2 text-sm underline"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-6 max-w-6xl">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Usage Dashboard</h1>
        <p className="text-gray-600">Monitor your resource usage and quotas</p>
      </div>

      {/* Time Range Selector */}
      <div className="mb-6 flex gap-2">
        {[7, 30, 90].map((days) => (
          <button
            key={days}
            onClick={() => setTimeRange(days)}
            className={`px-4 py-2 rounded-lg ${
              timeRange === days
                ? 'bg-blue-600 text-white'
                : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
            }`}
          >
            Last {days} days
          </button>
        ))}
      </div>

      {/* Warnings */}
      {usageStats?.warnings && usageStats.warnings.length > 0 && (
        <div className="mb-6 bg-yellow-50 border-l-4 border-yellow-400 p-4">
          <div className="flex">
            <div className="flex-shrink-0">
              <svg className="h-5 w-5 text-yellow-400" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
              </svg>
            </div>
            <div className="ml-3">
              <h3 className="text-sm font-medium text-yellow-800">Usage Warnings</h3>
              <div className="mt-2 text-sm text-yellow-700">
                <ul className="list-disc pl-5 space-y-1">
                  {usageStats.warnings.map((warning, idx) => (
                    <li key={idx}>{warning}</li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Current Usage Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
        {/* Token Usage Card */}
        {tokenUsage && (
          <div className="bg-white rounded-lg shadow-md p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              Daily Token Usage
            </h3>
            <div className="space-y-4">
              <div>
                <div className="flex justify-between text-sm mb-2">
                  <span className="text-gray-600">Used Today</span>
                  <span className="font-medium">
                    {formatNumber(tokenUsage.used)} / {formatLimit(tokenUsage.limit)}
                  </span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-3">
                  <div
                    className={`h-3 rounded-full transition-all ${getProgressBarColor(tokenUsage.percentage)}`}
                    style={{ width: `${Math.min(tokenUsage.percentage, 100)}%` }}
                  />
                </div>
                <p className="text-xs text-gray-500 mt-1">
                  {tokenUsage.percentage.toFixed(1)}% used
                </p>
              </div>
              {tokenUsage.percentage >= 80 && (
                <div className="bg-yellow-50 border border-yellow-200 rounded p-3 text-sm">
                  <p className="text-yellow-800">
                    You're approaching your daily token limit. Consider upgrading for more capacity.
                  </p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Storage Usage Card */}
        {storageUsage && (
          <div className="bg-white rounded-lg shadow-md p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              Memory Storage
            </h3>
            <div className="space-y-4">
              <div>
                <div className="flex justify-between text-sm mb-2">
                  <span className="text-gray-600">Total Storage</span>
                  <span className="font-medium">
                    {storageUsage.humanReadable}
                  </span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-3">
                  <div
                    className={`h-3 rounded-full transition-all ${getProgressBarColor(storageUsage.percentage)}`}
                    style={{ width: `${Math.min(storageUsage.percentage, 100)}%` }}
                  />
                </div>
                <p className="text-xs text-gray-500 mt-1">
                  {storageUsage.percentage.toFixed(1)}% of {formatLimit(storageUsage.limit)} bytes
                </p>
              </div>
              {storageUsage.percentage >= 80 && (
                <div className="bg-yellow-50 border border-yellow-200 rounded p-3 text-sm">
                  <p className="text-yellow-800">
                    Your storage is running low. Free up space or upgrade your plan.
                  </p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Detailed Usage Breakdown */}
      {usageStats && (
        <div className="bg-white rounded-lg shadow-md p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">
            Usage Breakdown ({usageStats.period})
          </h3>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Resource Type
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Usage
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Quota
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {usageStats.breakdown.map((item, idx) => (
                  <tr key={idx} className={idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      {item.resourceType.replace('_', ' ').toUpperCase()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {item.humanReadable || formatNumber(item.amount)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {item.percentage !== undefined && (
                        <div className="flex items-center">
                          <div className="w-20 bg-gray-200 rounded-full h-2 mr-2">
                            <div
                              className={`h-2 rounded-full ${getProgressBarColor(item.percentage)}`}
                              style={{ width: `${Math.min(item.percentage, 100)}%` }}
                            />
                          </div>
                          <span className="text-xs text-gray-600">
                            {item.percentage.toFixed(1)}%
                          </span>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Upgrade CTA */}
      {(tokenUsage?.percentage ?? 0) >= 80 || (storageUsage?.percentage ?? 0) >= 80 ? (
        <div className="mt-6 bg-gradient-to-r from-blue-600 to-purple-600 rounded-lg shadow-lg p-6 text-white">
          <h3 className="text-xl font-bold mb-2">Need More Resources?</h3>
          <p className="mb-4">
            Upgrade to a higher tier to get more tokens, storage, and features.
          </p>
          <button
            onClick={() => window.location.href = '/billing'}
            className="bg-white text-blue-600 px-6 py-2 rounded-lg font-semibold hover:bg-gray-100 transition"
          >
            View Plans
          </button>
        </div>
      ) : null}
    </div>
  );
};

export default Usage;
