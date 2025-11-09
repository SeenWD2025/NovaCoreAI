import { Controller, Get, Post, Body, UseGuards, Request, Query, Param } from '@nestjs/common';
import { UsageService } from './usage.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';

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
}
