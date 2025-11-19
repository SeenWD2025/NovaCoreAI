import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { DatabaseService } from './database/database.service';
import { EmailService } from './email/email.service';
import { RedisService } from './redis/redis.service';
import { trialExpirationChecks } from './metrics';

/**
 * Trial Expiration Service (Issue #6)
 * Automated job to check and downgrade expired trial accounts
 */
@Injectable()
export class TrialExpirationService {
  private readonly logger = new Logger(TrialExpirationService.name);

  constructor(
    private readonly db: DatabaseService,
    private readonly emailService: EmailService,
    private readonly redisService: RedisService,
  ) {}

  /**
   * Check for expired trials and downgrade them
   * Runs daily at 2 AM UTC
   */
  @Cron(CronExpression.EVERY_DAY_AT_2AM)
  async checkExpiredTrials() {
    this.logger.log('🔍 Checking for expired trial accounts...');

    try {
      // Find users with expired trials
      const result = await this.db.query(
        `SELECT id, email, trial_ends_at, subscription_tier
         FROM users
         WHERE subscription_tier = 'free_trial'
         AND trial_ends_at < NOW()
         AND trial_ends_at IS NOT NULL`,
      );

      this.logger.log(`📋 Found ${result.rows.length} expired trial accounts`);

      let successCount = 0;
      let failureCount = 0;

      for (const user of result.rows) {
        try {
          // Downgrade to restricted free tier
          await this.db.query(
            `UPDATE users
             SET subscription_tier = 'free_restricted',
                 updated_at = NOW()
             WHERE id = $1`,
            [user.id],
          );

          // Notify Gateway to invalidate user tier cache (Issue #10)
          try {
            await this.redisService.getClient().publish(
              'user_tier_changed', 
              JSON.stringify({ userId: user.id, oldTier: 'free_trial', newTier: 'free_restricted' })
            );
          } catch (error) {
            this.logger.warn(`Failed to publish cache invalidation for user ${user.id}:`, error.message);
          }

          // Send trial expired notification email
          try {
            await this.emailService.sendTrialExpiredEmail(
              user.email,
              user.trial_ends_at,
            );
          } catch (emailError) {
            // Don't fail the entire process if email fails
            this.logger.warn(`📧 Failed to send trial expired email to ${user.email}:`, emailError);
          }

          trialExpirationChecks.labels({ action: 'expired' }).inc();
          this.logger.log(`⬇️ Downgraded user ${user.email} from trial`);
          successCount++;
        } catch (error) {
          this.logger.error(`❌ Failed to downgrade user ${user.id}:`, error);
          failureCount++;
        }
      }

      trialExpirationChecks.labels({ action: 'completed' }).inc();
      this.logger.log(`✅ Trial expiration check complete: ${successCount} downgraded, ${failureCount} failed`);
    } catch (error) {
      this.logger.error('💥 Trial expiration check failed:', error);
      trialExpirationChecks.labels({ action: 'error' }).inc();
    }
  }

  /**
   * Send reminder emails 1 day before trial expiration
   * Runs daily at 10 AM UTC
   */
  @Cron(CronExpression.EVERY_DAY_AT_10AM)
  async sendTrialExpirationReminders() {
    this.logger.log('📨 Sending trial expiration reminders...');

    try {
      // Find trials expiring in the next 24-48 hours
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      tomorrow.setHours(23, 59, 59, 999);

      const dayAfterTomorrow = new Date();
      dayAfterTomorrow.setDate(dayAfterTomorrow.getDate() + 2);
      dayAfterTomorrow.setHours(0, 0, 0, 0);

      const result = await this.db.query(
        `SELECT id, email, trial_ends_at
         FROM users
         WHERE subscription_tier = 'free_trial'
         AND trial_ends_at > NOW()
         AND trial_ends_at >= $1
         AND trial_ends_at < $2`,
        [tomorrow, dayAfterTomorrow],
      );

      this.logger.log(`📬 Sending trial expiration reminders to ${result.rows.length} users`);

      let sentCount = 0;
      let failedCount = 0;

      for (const user of result.rows) {
        try {
          await this.emailService.sendTrialExpiringEmail(user.email, user.trial_ends_at);
          trialExpirationChecks.labels({ action: 'reminded' }).inc();
          sentCount++;
        } catch (error) {
          this.logger.warn(`📧 Failed to send reminder to ${user.email}:`, error);
          failedCount++;
        }
      }

      this.logger.log(`📤 Sent ${sentCount} trial reminders, ${failedCount} failed`);
    } catch (error) {
      this.logger.error('💥 Trial reminder process failed:', error);
      trialExpirationChecks.labels({ action: 'reminder_error' }).inc();
    }
  }

  /**
   * Manual trigger for testing (not exposed via cron)
   */
  async manualTrialCheck(): Promise<{ expired: number; reminded: number }> {
    this.logger.log('🛠️ Manual trial check triggered');

    // Run both processes manually
    await this.checkExpiredTrials();
    const expiredCount = await this.getExpiredTrialsCount();

    await this.sendTrialExpirationReminders();
    const reminderCount = await this.getTrialsExpiringTomorrowCount();

    return {
      expired: expiredCount,
      reminded: reminderCount,
    };
  }

  /**
   * Get count of trials that would be expired (for monitoring)
   */
  private async getExpiredTrialsCount(): Promise<number> {
    const result = await this.db.query(
      `SELECT COUNT(*) as count
       FROM users
       WHERE subscription_tier = 'free_trial'
       AND trial_ends_at < NOW()
       AND trial_ends_at IS NOT NULL`,
    );
    return parseInt(result.rows[0].count);
  }

  /**
   * Get count of trials expiring tomorrow (for monitoring)
   */
  private async getTrialsExpiringTomorrowCount(): Promise<number> {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(23, 59, 59, 999);

    const dayAfterTomorrow = new Date();
    dayAfterTomorrow.setDate(dayAfterTomorrow.getDate() + 2);
    dayAfterTomorrow.setHours(0, 0, 0, 0);

    const result = await this.db.query(
      `SELECT COUNT(*) as count
       FROM users
       WHERE subscription_tier = 'free_trial'
       AND trial_ends_at > NOW()
       AND trial_ends_at >= $1
       AND trial_ends_at < $2`,
      [tomorrow, dayAfterTomorrow],
    );
    return parseInt(result.rows[0].count);
  }

  /**
   * Get trial statistics for monitoring dashboard
   */
  async getTrialStats(): Promise<{
    activeTrials: number;
    expiringToday: number;
    expiringTomorrow: number;
    expiredPendingDowngrade: number;
  }> {
    const today = new Date();
    today.setHours(23, 59, 59, 999);

    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(23, 59, 59, 999);

    const [activeTrials, expiringToday, expiringTomorrow, expiredPending] = await Promise.all([
      // Active trials
      this.db.query(
        `SELECT COUNT(*) as count FROM users WHERE subscription_tier = 'free_trial' AND trial_ends_at > NOW()`,
      ),
      // Expiring today
      this.db.query(
        `SELECT COUNT(*) as count FROM users 
         WHERE subscription_tier = 'free_trial' AND trial_ends_at <= $1 AND trial_ends_at > NOW()`,
        [today],
      ),
      // Expiring tomorrow
      this.db.query(
        `SELECT COUNT(*) as count FROM users 
         WHERE subscription_tier = 'free_trial' AND trial_ends_at <= $1 AND trial_ends_at > $2`,
        [tomorrow, today],
      ),
      // Expired but not yet downgraded
      this.db.query(
        `SELECT COUNT(*) as count FROM users 
         WHERE subscription_tier = 'free_trial' AND trial_ends_at < NOW()`,
      ),
    ]);

    return {
      activeTrials: parseInt(activeTrials.rows[0].count),
      expiringToday: parseInt(expiringToday.rows[0].count),
      expiringTomorrow: parseInt(expiringTomorrow.rows[0].count),
      expiredPendingDowngrade: parseInt(expiredPending.rows[0].count),
    };
  }
}