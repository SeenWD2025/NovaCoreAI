import { Module } from '@nestjs/common';
import { AuthModule } from './auth/auth.module';
import { BillingModule } from './billing/billing.module';
import { UsageModule } from './usage/usage.module';
import { DatabaseModule } from './database/database.module';
import { RedisModule } from './redis/redis.module';
import { HealthController } from './health.controller';

@Module({
  imports: [
    DatabaseModule,
    RedisModule,
    AuthModule,
    BillingModule,
    UsageModule,
  ],
  controllers: [HealthController],
})
export class AppModule {}
