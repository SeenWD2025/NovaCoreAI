import { useCallback, useEffect, useState } from 'react';
import { AlertCircle, Zap, MessageSquare, Database } from 'lucide-react';
import usageService from '@/services/usage';

interface QuotaData {
  tokens: {
    used: number;
    limit: number;
    percentage: number;
  };
  messages: {
    used: number;
    limit: number;
    percentage: number;
  };
  tier: string;
}

export default function QuotaCard() {
  const [quotaData, setQuotaData] = useState<QuotaData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadQuota = useCallback(async () => {
    try {
      setLoading(true);
      const response = await usageService.getTokenUsage();
      
      // If the API returns data in a different format, adjust accordingly
      // For now, assuming it returns token usage and we need to fetch message count separately
      const tokenData = response;
      
      setQuotaData({
        tokens: {
          used: tokenData.used,
          limit: tokenData.limit,
          percentage: tokenData.percentage,
        },
        messages: {
          used: 0, // Will be populated from actual API
          limit: 1000, // Default, will be from tier config
          percentage: 0,
        },
        tier: 'free_trial', // Will be populated from getUserTier
      });
      setError(null);
    } catch (err) {
      console.error('Failed to load quota:', err);
      setError('Failed to load quota information');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadQuota();
  }, [loadQuota]);

  if (loading) {
    return (
      <div className="card">
        <div className="animate-pulse">
          <div className="h-6 bg-gray-200 rounded w-1/3 mb-4"></div>
          <div className="space-y-3">
            <div className="h-4 bg-gray-200 rounded"></div>
            <div className="h-4 bg-gray-200 rounded"></div>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="card bg-red-50 border border-red-200">
        <div className="flex items-center gap-2 text-red-700">
          <AlertCircle size={20} />
          <span className="text-sm">{error}</span>
        </div>
      </div>
    );
  }

  if (!quotaData) return null;

  const getProgressColor = (percentage: number) => {
    if (percentage >= 90) return 'bg-red-500';
    if (percentage >= 80) return 'bg-yellow-500';
    return 'bg-green-500';
  };

  const getTextColor = (percentage: number) => {
    if (percentage >= 90) return 'text-red-700';
    if (percentage >= 80) return 'text-yellow-700';
    return 'text-gray-700';
  };

  return (
    <div className="card">
      <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
        <Database size={20} className="text-primary-800" />
        Usage & Quota
      </h3>

      {/* Token Usage */}
      <div className="mb-4">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <Zap size={16} className="text-secondary-700" />
            <span className="text-sm font-medium text-gray-700">Tokens Today</span>
          </div>
          <span className={`text-sm font-semibold ${getTextColor(quotaData.tokens.percentage)}`}>
            {quotaData.tokens.used.toLocaleString()} / {quotaData.tokens.limit.toLocaleString()}
          </span>
        </div>
        <div className="w-full bg-gray-200 rounded-full h-2">
          <div
            className={`h-2 rounded-full transition-all duration-500 ${getProgressColor(quotaData.tokens.percentage)}`}
            style={{ width: `${Math.min(quotaData.tokens.percentage, 100)}%` }}
          />
        </div>
        {quotaData.tokens.percentage >= 80 && (
          <p className="text-xs text-yellow-700 mt-1 flex items-center gap-1">
            <AlertCircle size={12} />
            You've used {quotaData.tokens.percentage.toFixed(0)}% of your daily token quota
          </p>
        )}
      </div>

      {/* Message Usage */}
      <div className="mb-4">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <MessageSquare size={16} className="text-accent-700" />
            <span className="text-sm font-medium text-gray-700">Messages Today</span>
          </div>
          <span className={`text-sm font-semibold ${getTextColor(quotaData.messages.percentage)}`}>
            {quotaData.messages.used} / {quotaData.messages.limit}
          </span>
        </div>
        <div className="w-full bg-gray-200 rounded-full h-2">
          <div
            className={`h-2 rounded-full transition-all duration-500 ${getProgressColor(quotaData.messages.percentage)}`}
            style={{ width: `${Math.min(quotaData.messages.percentage, 100)}%` }}
          />
        </div>
      </div>

      {/* Tier Info & Upgrade CTA */}
      <div className="mt-4 pt-4 border-t border-gray-200">
        <div className="flex items-center justify-between">
          <span className="text-sm text-gray-600">
            Current Tier: <span className="font-semibold capitalize">{quotaData.tier.replace('_', ' ')}</span>
          </span>
          {quotaData.tier === 'free_trial' && (
            <button
              onClick={() => window.location.href = '/billing'}
              className="text-sm text-primary-800 hover:text-primary-900 font-medium"
            >
              Upgrade →
            </button>
          )}
        </div>
      </div>

      {/* Warning when approaching limit */}
      {(quotaData.tokens.percentage >= 90 || quotaData.messages.percentage >= 90) && (
        <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg">
          <p className="text-sm text-red-700 font-medium mb-1">
            ⚠️ Quota Almost Exceeded
          </p>
          <p className="text-xs text-red-600">
            You're approaching your daily limits. Consider upgrading to a higher tier for more capacity.
          </p>
        </div>
      )}
    </div>
  );
}
