import { Module } from '@nestjs/common';
import { AuthModule } from './auth/auth.module';
import { BillingModule } from './billing/billing.module';
import { DatabaseModule } from './database/database.module';
import { HealthController } from './health.controller';

@Module({
  imports: [
    DatabaseModule,
    AuthModule,
    BillingModule,
  ],
  controllers: [HealthController],
})
export class AppModule {}
