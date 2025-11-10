import { Controller, Post, Get, Body, UseGuards, Request, Headers, Req } from '@nestjs/common';
import { BillingService } from './billing.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { CreateCheckoutDto } from './dto/create-checkout.dto';

@Controller('billing')
export class BillingController {
  constructor(private readonly billingService: BillingService) {}

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('student', 'subscriber')
  @Post('create-checkout')
  async createCheckout(@Request() req, @Body() createCheckoutDto: CreateCheckoutDto) {
    return this.billingService.createCheckoutSession(
      req.user.userId,
      createCheckoutDto.tier,
    );
  }

  @Post('webhooks')
  async handleWebhook(
    @Headers('stripe-signature') signature: string,
    @Req() request: any,
  ) {
    // rawBody is a Buffer when using express.raw() middleware
    const rawBody = request.body;
    return this.billingService.handleWebhook(signature, rawBody);
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

