import { Injectable, NotFoundException } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';

interface UsageBreakdown {
  resourceType: string;
  amount: number;
  humanReadable?: string;
  percentage?: number;
}

interface TierLimits {
  llmTokensDay: number;
  memoryStorageBytes: number;
  agentMinutesMonth: number;
}

interface UsageStats {
  userId: string;
  period: string;
  breakdown: UsageBreakdown[];
  limits: TierLimits;
  warnings: string[];
  timestamp: string;
}

@Injectable()
export class UsageService {
  constructor(private readonly db: DatabaseService) {}

  /**
   * Get tier limits based on subscription tier
   */
  private getTierLimits(tier: string): TierLimits {
    const limits = {
      free_trial: {
        llmTokensDay: 1000,
        memoryStorageBytes: 1 * 1024 * 1024 * 1024, // 1 GB
        agentMinutesMonth: 0,
      },
      basic: {
        llmTokensDay: 50000,
        memoryStorageBytes: 10 * 1024 * 1024 * 1024, // 10 GB
        agentMinutesMonth: 60,
      },
      pro: {
        llmTokensDay: -1, // Unlimited
        memoryStorageBytes: -1, // Unlimited
        agentMinutesMonth: -1, // Unlimited
      },
    };

    return limits[tier] || limits.free_trial;
  }

  /**
   * Convert bytes to human-readable format
   */
  private bytesToHuman(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(2)} KB`;
    if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
    return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
  }

  /**
   * Get user's subscription tier
   */
  async getUserTier(userId: string): Promise<string> {
    const result = await this.db.query(
      'SELECT subscription_tier FROM users WHERE id = $1',
      [userId],
    );

    if (result.rows.length === 0) {
      throw new NotFoundException('User not found');
    }

    return result.rows[0].subscription_tier || 'free_trial';
  }

  /**
   * Get comprehensive usage statistics for a user
   */
  async getUserUsageStats(userId: string, days: number = 30): Promise<UsageStats> {
    const tier = await this.getUserTier(userId);
    const limits = this.getTierLimits(tier);
    const warnings: string[] = [];

    // Get usage breakdown by resource type
    const result = await this.db.query(
      `SELECT 
        resource_type,
        SUM(amount) as total_amount
       FROM usage_ledger
       WHERE user_id = $1 
       AND timestamp >= NOW() - INTERVAL '${days} days'
       GROUP BY resource_type
       ORDER BY total_amount DESC`,
      [userId],
    );

    const breakdown: UsageBreakdown[] = [];

    for (const row of result.rows) {
      const resourceType = row.resource_type;
      const amount = parseInt(row.total_amount);
      let limit = 0;
      let percentage = 0;
      let humanReadable = '';

      switch (resourceType) {
        case 'llm_tokens':
          limit = limits.llmTokensDay;
          humanReadable = `${amount.toLocaleString()} tokens`;
          break;
        case 'memory_storage':
          limit = limits.memoryStorageBytes;
          humanReadable = this.bytesToHuman(amount);
          break;
        case 'agent_minutes':
          limit = limits.agentMinutesMonth;
          humanReadable = `${amount} minutes`;
          break;
        default:
          humanReadable = `${amount}`;
      }

      if (limit > 0) {
        percentage = (amount / limit) * 100;
        
        if (percentage >= 100) {
          warnings.push(`${resourceType} quota exceeded (${percentage.toFixed(1)}%)`);
        } else if (percentage >= 80) {
          warnings.push(`${resourceType} at ${percentage.toFixed(1)}% of quota`);
        }
      }

      breakdown.push({
        resourceType,
        amount,
        humanReadable,
        percentage: limit > 0 ? Math.round(percentage * 100) / 100 : undefined,
      });
    }

    return {
      userId,
      period: `last_${days}_days`,
      breakdown,
      limits,
      warnings,
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Get daily token usage for current period
   */
  async getDailyTokenUsage(userId: string): Promise<{ used: number; limit: number; percentage: number }> {
    const tier = await this.getUserTier(userId);
    const limits = this.getTierLimits(tier);

    const result = await this.db.query(
      `SELECT COALESCE(SUM(amount), 0) as total
       FROM usage_ledger
       WHERE user_id = $1
       AND resource_type = 'llm_tokens'
       AND timestamp >= CURRENT_DATE`,
      [userId],
    );

    const used = parseInt(result.rows[0]?.total || 0);
    const limit = limits.llmTokensDay;
    const percentage = limit > 0 ? (used / limit) * 100 : 0;

    return {
      used,
      limit,
      percentage: Math.round(percentage * 100) / 100,
    };
  }

  /**
   * Get current storage usage
   */
  async getStorageUsage(userId: string): Promise<{ used: number; limit: number; percentage: number; humanReadable: string }> {
    const tier = await this.getUserTier(userId);
    const limits = this.getTierLimits(tier);

    const result = await this.db.query(
      `SELECT COALESCE(SUM(amount), 0) as total
       FROM usage_ledger
       WHERE user_id = $1
       AND resource_type = 'memory_storage'`,
      [userId],
    );

    const used = parseInt(result.rows[0]?.total || 0);
    const limit = limits.memoryStorageBytes;
    const percentage = limit > 0 ? (used / limit) * 100 : 0;

    return {
      used,
      limit,
      percentage: Math.round(percentage * 100) / 100,
      humanReadable: this.bytesToHuman(used),
    };
  }

  /**
   * Check if user has quota available for a resource
   */
  async checkQuota(
    userId: string,
    resourceType: string,
    amount: number,
  ): Promise<{ hasQuota: boolean; message: string }> {
    const tier = await this.getUserTier(userId);
    const limits = this.getTierLimits(tier);

    let currentUsage = 0;
    let limit = 0;

    switch (resourceType) {
      case 'llm_tokens':
        const tokenUsage = await this.getDailyTokenUsage(userId);
        currentUsage = tokenUsage.used;
        limit = tokenUsage.limit;
        break;
      case 'memory_storage':
        const storageUsage = await this.getStorageUsage(userId);
        currentUsage = storageUsage.used;
        limit = storageUsage.limit;
        break;
      default:
        return { hasQuota: true, message: 'Unknown resource type' };
    }

    // Pro tier has unlimited
    if (limit === -1) {
      return { hasQuota: true, message: 'Unlimited quota' };
    }

    const newTotal = currentUsage + amount;

    if (newTotal > limit) {
      return {
        hasQuota: false,
        message: `Quota exceeded. Current: ${currentUsage}, Requested: ${amount}, Limit: ${limit}`,
      };
    }

    const percentage = (newTotal / limit) * 100;
    if (percentage >= 80) {
      return {
        hasQuota: true,
        message: `Warning: ${percentage.toFixed(1)}% of quota will be used`,
      };
    }

    return { hasQuota: true, message: 'Quota available' };
  }

  /**
   * Get usage time series data for visualization
   */
  async getUsageTimeSeries(
    userId: string,
    resourceType: string,
    days: number = 30,
  ): Promise<Array<{ date: string; amount: number }>> {
    const result = await this.db.query(
      `SELECT 
        DATE(timestamp) as date,
        SUM(amount) as daily_amount
       FROM usage_ledger
       WHERE user_id = $1
       AND resource_type = $2
       AND timestamp >= NOW() - INTERVAL '${days} days'
       GROUP BY DATE(timestamp)
       ORDER BY date ASC`,
      [userId, resourceType],
    );

    return result.rows.map((row) => ({
      date: row.date.toISOString().split('T')[0],
      amount: parseInt(row.daily_amount),
    }));
  }

  /**
   * Record usage event
   */
  async recordUsage(
    userId: string,
    resourceType: string,
    amount: number,
    metadata?: any,
  ): Promise<void> {
    await this.db.query(
      `INSERT INTO usage_ledger (user_id, resource_type, amount, metadata)
       VALUES ($1, $2, $3, $4)`,
      [userId, resourceType, amount, JSON.stringify(metadata || {})],
    );
  }
}
