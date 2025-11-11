import { Controller, Post, Get, Body, UseGuards, Request, Headers, Req } from '@nestjs/common';
import { BillingService } from './billing.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { CreateCheckoutDto } from './dto/create-checkout.dto';
import { subscriptionChangesTotal, stripeWebhookTotal } from '../metrics';

@Controller('billing')
export class BillingController {
  constructor(private readonly billingService: BillingService) {}

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('student', 'subscriber')
  @Post('create-checkout')
  async createCheckout(@Request() req, @Body() createCheckoutDto: CreateCheckoutDto) {
    const result = await this.billingService.createCheckoutSession(
      req.user.userId,
      createCheckoutDto.tier,
    );
    
    // Track subscription change (from free_trial or current tier to new tier)
    subscriptionChangesTotal.labels({
      from_tier: 'free_trial', // TODO: Get actual current tier
      to_tier: createCheckoutDto.tier
    }).inc();
    
    return result;
  }

  @Post('webhooks')
  async handleWebhook(
    @Headers('stripe-signature') signature: string,
    @Req() request: any,
  ) {
    // rawBody is a Buffer when using express.raw() middleware
    const rawBody = request.body;
    
    try {
      const result = await this.billingService.handleWebhook(signature, rawBody);
      // Track successful webhook processing
      stripeWebhookTotal.labels({
        event_type: result?.eventType || 'unknown',
        status: 'success'
      }).inc();
      return result;
    } catch (error) {
      stripeWebhookTotal.labels({
        event_type: 'unknown',
        status: 'error'
      }).inc();
      throw error;
    }
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('student', 'subscriber', 'admin')
  @Get('portal')
  async getPortal(@Request() req) {
    return this.billingService.getCustomerPortalUrl(req.user.userId);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('student', 'subscriber', 'admin')
  @Get('usage')
  async getUsage(@Request() req) {
    return this.billingService.getUserUsage(req.user.userId);
  }
}

