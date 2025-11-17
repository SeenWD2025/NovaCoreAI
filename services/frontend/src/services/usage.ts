import { api } from './api';

export interface UsageBreakdown {
  resourceType: string;
  amount: number;
  humanReadable?: string;
  percentage?: number;
}

export interface TierLimits {
  llmTokensDay: number;
  memoryStorageBytes: number;
  agentMinutesMonth: number;
}

export interface UsageStats {
  userId: string;
  period: string;
  breakdown: UsageBreakdown[];
  limits: TierLimits;
  warnings: string[];
  timestamp: string;
}

export interface TokenUsage {
  used: number;
  limit: number;
  percentage: number;
}

export interface StorageUsage {
  used: number;
  limit: number;
  percentage: number;
  humanReadable: string;
}

export interface QuotaCheck {
  hasQuota: boolean;
  message: string;
}

export interface TimeSeriesData {
  date: string;
  amount: number;
}

export interface TierInfo {
  userId: string;
  tier: string;
}

export type MemoryUsageResponse = Record<string, unknown>;

export interface MemoryQuotaResponse {
  hasQuota: boolean;
  message?: string;
  limitBytes?: number;
  [key: string]: unknown;
}

class UsageService {
  /**
   * Get comprehensive usage statistics
   */
  async getUsageStats(days: number = 30): Promise<UsageStats> {
    const response = await api.get(`/usage/stats?days=${days}`);
    return response.data;
  }

  /**
   * Get daily token usage
   */
  async getTokenUsage(): Promise<TokenUsage> {
    const response = await api.get('/usage/tokens');
    return response.data;
  }

  /**
   * Get storage usage
   */
  async getStorageUsage(): Promise<StorageUsage> {
    const response = await api.get('/usage/storage');
    return response.data;
  }

  /**
   * Check quota availability
   */
  async checkQuota(resourceType: string, amount: number): Promise<QuotaCheck> {
    const response = await api.post('/usage/check-quota', {
      resourceType,
      amount,
    });
    return response.data;
  }

  /**
   * Get time series data for a resource type
   */
  async getTimeSeries(
    resourceType: string,
    days: number = 30
  ): Promise<TimeSeriesData[]> {
    const response = await api.get(`/usage/timeseries/${resourceType}?days=${days}`);
    return response.data;
  }

  /**
   * Get user's subscription tier
   */
  async getUserTier(): Promise<TierInfo> {
    const response = await api.get('/usage/tier');
    return response.data;
  }

  /**
   * Get memory-specific usage stats
   */
  async getMemoryUsage(): Promise<MemoryUsageResponse> {
    const response = await api.get('/memory/usage');
    return response.data;
  }

  /**
   * Check memory storage quota
   */
  async checkMemoryQuota(): Promise<MemoryQuotaResponse> {
    const response = await api.get('/memory/usage/quota-check');
    return response.data;
  }
}

export const usageService = new UsageService();
export default usageService;
