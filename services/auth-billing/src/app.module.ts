import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { AuthModule } from './auth/auth.module';
import { BillingModule } from './billing/billing.module';
import { UsageModule } from './usage/usage.module';
import { DatabaseModule } from './database/database.module';
import { RedisModule } from './redis/redis.module';
import { EmailModule } from './email/email.module';
import { HealthController } from './health.controller';
import { TrialController } from './trial.controller';
import { TrialExpirationService } from './trial-expiration.service';
import { RedisService } from './redis/redis.service';

@Module({
  imports: [
    ScheduleModule.forRoot(),
    DatabaseModule,
    RedisModule,
    EmailModule,
    AuthModule,
    BillingModule,
    UsageModule,
  ],
  controllers: [HealthController, TrialController],
  providers: [TrialExpirationService],
})
export class AppModule {}
