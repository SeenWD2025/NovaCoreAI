import { Controller, Get, Post, Body, UseGuards, Request, Query, Param, Headers } from '@nestjs/common';
import { IsString, IsNumber, IsOptional, IsObject, IsUUID } from 'class-validator';
import { UsageService } from './usage.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { ServiceAuthGuard } from '../auth/service-auth.guard';
import { usageRecordingAttempts } from '../metrics';

/**
 * DTO for recording usage events from other services
 */
export class RecordUsageDto {
  @IsString()
  @IsUUID()
  userId: string;

  @IsString()
  resourceType: string; // 'llm_tokens', 'memory_storage', 'agent_minutes', 'messages'

  @IsNumber()
  amount: number;

  @IsOptional()
  @IsObject()
  metadata?: Record<string, any>;
}

@Controller('usage')
export class UsageController {
  constructor(private readonly usageService: UsageService) {}

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('student', 'subscriber', 'admin')
  @Get('stats')
  async getUsageStats(@Request() req, @Query('days') days?: string) {
    const daysNum = days ? parseInt(days) : 30;
    return this.usageService.getUserUsageStats(req.user.userId, daysNum);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('student', 'subscriber', 'admin')
  @Get('tokens')
  async getTokenUsage(@Request() req) {
    return this.usageService.getDailyTokenUsage(req.user.userId);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('student', 'subscriber', 'admin')
  @Get('storage')
  async getStorageUsage(@Request() req) {
    return this.usageService.getStorageUsage(req.user.userId);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('student', 'subscriber', 'admin')
  @Post('check-quota')
  async checkQuota(
    @Request() req,
    @Body() body: { resourceType: string; amount: number },
  ) {
    return this.usageService.checkQuota(
      req.user.userId,
      body.resourceType,
      body.amount,
    );
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('student', 'subscriber', 'admin')
  @Get('timeseries/:resourceType')
  async getTimeSeries(
    @Request() req,
    @Param('resourceType') resourceType: string,
    @Query('days') days?: string,
  ) {
    const daysNum = days ? parseInt(days) : 30;
    return this.usageService.getUsageTimeSeries(
      req.user.userId,
      resourceType,
      daysNum,
    );
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('student', 'subscriber', 'admin')
  @Get('tier')
  async getUserTier(@Request() req) {
    const tier = await this.usageService.getUserTier(req.user.userId);
    return { userId: req.user.userId, tier };
  }

  /**
   * Get quota information - current usage and remaining quota
   * GET /usage/quota
   */
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('student', 'subscriber', 'admin')
  @Get('quota')
  async getQuotaInfo(@Request() req) {
    return this.usageService.getQuotaInfo(req.user.userId);
  }

  /**
   * Get usage history for the last N days
   * GET /usage/history?days=30
   */
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('student', 'subscriber', 'admin')
  @Get('history')
  async getUsageHistory(@Request() req, @Query('days') days?: string) {
    const daysNum = days ? parseInt(days) : 30;
    return this.usageService.getUsageHistory(req.user.userId, daysNum);
  }

  /**
   * Record usage event (Service-to-Service endpoint)
   * POST /usage/record
   * Requires X-Service-Token header
   * Used by Intelligence, Memory, and other services to log usage
   */
  @Post('record')
  @UseGuards(ServiceAuthGuard)
  async recordUsage(
    @Body() dto: RecordUsageDto,
    @Headers('x-user-id') headerUserId?: string,
  ) {
    try {
      // Use userId from header if provided, otherwise from body
      const userId = headerUserId || dto.userId;
      
      await this.usageService.recordUsage(
        userId,
        dto.resourceType,
        dto.amount,
        dto.metadata,
      );

      usageRecordingAttempts.labels({
        resource_type: dto.resourceType,
        result: 'success',
      }).inc();

      return {
        success: true,
        message: 'Usage recorded successfully',
        userId,
        resourceType: dto.resourceType,
        amount: dto.amount,
      };
    } catch (error) {
      usageRecordingAttempts.labels({
        resource_type: dto.resourceType,
        result: 'failure',
      }).inc();
      throw error;
    }
  }
}
