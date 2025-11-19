import { Controller, Get, Res } from '@nestjs/common';
import { Response } from 'express';
import { register } from './metrics';
import { DatabaseService } from './database/database.service';
import { RedisService } from './redis/redis.service';

interface HealthCheckResult {
  status: 'healthy' | 'unhealthy' | 'unknown';
  latencyMs?: number;
  error?: string;
}

/**
 * Health and Metrics Controller with comprehensive dependency checks
 * Addresses Issue #3: Health Check Insufficient
 */
@Controller()
export class HealthController {
  constructor(
    private readonly db: DatabaseService,
    private readonly redis: RedisService,
  ) {}

  @Get('health')
  async health() {
    // Perform comprehensive health checks
    const checks = {
      database: await this.checkDatabase(),
      redis: await this.checkRedis(),
      stripe: await this.checkStripe(),
      email: await this.checkEmail(),
    };

    // Determine overall status
    const hasUnhealthy = Object.values(checks).some(c => c.status === 'unhealthy');
    const hasDegraded = Object.values(checks).some(c => c.status === 'unknown');
    const overallStatus = hasUnhealthy ? 'unhealthy' : hasDegraded ? 'degraded' : 'healthy';

    return {
      status: overallStatus,
      service: 'auth-billing',
      version: '1.0.0',
      timestamp: new Date().toISOString(),
      checks,
    };
  }

  private async checkDatabase(): Promise<HealthCheckResult> {
    const start = Date.now();
    try {
      await this.db.query('SELECT 1');
      return { 
        status: 'healthy', 
        latencyMs: Date.now() - start 
      };
    } catch (error) {
      return { 
        status: 'unhealthy', 
        error: error instanceof Error ? error.message : 'Database connection failed'
      };
    }
  }

  private async checkRedis(): Promise<HealthCheckResult> {
    const start = Date.now();
    try {
      const client = this.redis.getClient();
      await client.ping();
      return { 
        status: 'healthy', 
        latencyMs: Date.now() - start 
      };
    } catch (error) {
      return { 
        status: 'unhealthy', 
        error: error instanceof Error ? error.message : 'Redis connection failed'
      };
    }
  }

  private async checkStripe(): Promise<HealthCheckResult> {
    try {
      if (!process.env.STRIPE_SECRET_KEY) {
        return { 
          status: 'unhealthy', 
          error: 'Stripe API key not configured' 
        };
      }
      
      if (process.env.STRIPE_SECRET_KEY.startsWith('sk_test_xxx')) {
        return { 
          status: 'unknown', 
          error: 'Stripe API key is placeholder value' 
        };
      }

      return { status: 'healthy' };
    } catch (error) {
      return { 
        status: 'unhealthy', 
        error: error instanceof Error ? error.message : 'Stripe check failed'
      };
    }
  }

  private async checkEmail(): Promise<HealthCheckResult> {
    if (process.env.NODE_ENV !== 'production') {
      return { 
        status: 'unknown', 
        error: 'Email not required in development' 
      };
    }

    if (!process.env.SMTP_HOST || !process.env.SMTP_USER) {
      return { 
        status: 'unknown', 
        error: 'SMTP not fully configured' 
      };
    }

    return { status: 'healthy' };
  }

  @Get('metrics')
  async metrics(@Res() res: Response) {
    try {
      res.set('Content-Type', register.contentType);
      res.end(await register.metrics());
    } catch (err) {
      res.status(500).end(err);
    }
  }
}
