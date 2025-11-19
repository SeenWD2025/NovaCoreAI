import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { ServiceAuthService } from './service-auth.service';
import { ServiceAuthController } from './service-auth.controller';
import { ServiceAuthGuard } from './service-auth.guard';
import { JwtStrategy } from './jwt.strategy';
import { LocalStrategy } from './local.strategy';
import { RolesGuard } from './roles.guard';
import { RateLimitGuard } from './rate-limit.guard';
import { EmailModule } from '../email/email.module';

@Module({
  imports: [
    PassportModule,
    JwtModule.register({
      secret: process.env.JWT_SECRET || 'development-secret-change-in-production',
      signOptions: { expiresIn: process.env.JWT_EXPIRES_IN || '15m' },
    }),
    EmailModule,
  ],
  controllers: [AuthController, ServiceAuthController],
  providers: [AuthService, ServiceAuthService, JwtStrategy, LocalStrategy, RolesGuard, RateLimitGuard, ServiceAuthGuard],
  exports: [AuthService, ServiceAuthService, RolesGuard, ServiceAuthGuard],
})
export class AuthModule {}
