import { Module } from '@nestjs/common';
import { UsageController } from './usage.controller';
import { UsageService } from './usage.service';
import { DatabaseService } from '../database/database.service';

@Module({
  controllers: [UsageController],
  providers: [UsageService, DatabaseService],
  exports: [UsageService],
})
export class UsageModule {}
