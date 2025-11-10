import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { ServiceAuthService } from './service-auth.service';
import { ServiceAuthController } from './service-auth.controller';
import { JwtStrategy } from './jwt.strategy';
import { LocalStrategy } from './local.strategy';
import { RolesGuard } from './roles.guard';

@Module({
  imports: [
    PassportModule,
    JwtModule.register({
      secret: process.env.JWT_SECRET || 'development-secret-change-in-production',
      signOptions: { expiresIn: process.env.JWT_EXPIRES_IN || '15m' },
    }),
  ],
  controllers: [AuthController, ServiceAuthController],
  providers: [AuthService, ServiceAuthService, JwtStrategy, LocalStrategy, RolesGuard],
  exports: [AuthService, ServiceAuthService, RolesGuard],
})
export class AuthModule {}
