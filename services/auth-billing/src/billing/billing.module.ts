import { Module } from '@nestjs/common';
import { BillingController } from './billing.controller';
import { BillingService } from './billing.service';
import { StripeService } from './stripe.service';
import { DatabaseModule } from '../database/database.module';
import { AuthModule } from '../auth/auth.module';
import { EmailModule } from '../email/email.module';

@Module({
  imports: [DatabaseModule, AuthModule, EmailModule],
  controllers: [BillingController],
  providers: [BillingService, StripeService],
  exports: [BillingService],
})
export class BillingModule {}
