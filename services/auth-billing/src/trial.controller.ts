import { Controller, Get, Post, UseGuards } from '@nestjs/common';
import { TrialExpirationService } from './trial-expiration.service';
import { ServiceAuthGuard } from './auth/service-auth.guard';

/**
 * Trial Management Controller (Issue #6)
 * Endpoints for monitoring trial status and manual management
 */
@Controller('trials')
export class TrialController {
  constructor(private readonly trialService: TrialExpirationService) {}

  /**
   * Get trial statistics for monitoring dashboard
   * GET /trials/stats
   * Service-to-service endpoint for monitoring systems
   */
  @Get('stats')
  @UseGuards(ServiceAuthGuard)
  async getTrialStats() {
    const stats = await this.trialService.getTrialStats();
    return {
      success: true,
      timestamp: new Date().toISOString(),
      stats,
    };
  }

  /**
   * Manual trial expiration check (for testing/ops)
   * POST /trials/check
   * Service-to-service endpoint for manual triggers
   */
  @Post('check')
  @UseGuards(ServiceAuthGuard)
  async manualTrialCheck() {
    const result = await this.trialService.manualTrialCheck();
    return {
      success: true,
      timestamp: new Date().toISOString(),
      result,
      message: 'Manual trial check completed',
    };
  }
}