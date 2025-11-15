import { Controller, Post, Get, Body, UseGuards, Request, Query } from '@nestjs/common';
import { AuthService } from './auth.service';
import { JwtAuthGuard } from './jwt-auth.guard';
import { RateLimitGuard, RateLimit } from './rate-limit.guard';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { RequestPasswordResetDto } from './dto/request-password-reset.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { authLoginTotal, authRegistrationTotal } from '../metrics';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('register')
  async register(@Body() registerDto: RegisterDto) {
    try {
      const result = await this.authService.register(registerDto);
      authRegistrationTotal.labels({ status: 'success' }).inc();
      return result;
    } catch (error) {
      authRegistrationTotal.labels({ status: 'failure' }).inc();
      throw error;
    }
  }

  @Post('login')
  async login(@Body() loginDto: LoginDto) {
    try {
      const result = await this.authService.login(loginDto);
      authLoginTotal.labels({ result: 'success' }).inc();
      return result;
    } catch (error) {
      authLoginTotal.labels({ result: 'failure' }).inc();
      throw error;
    }
  }

  @Post('refresh')
  async refresh(@Body() refreshTokenDto: RefreshTokenDto) {
    return this.authService.refreshAccessToken(refreshTokenDto.refreshToken);
  }

  @Post('request-password-reset')
  @UseGuards(RateLimitGuard)
  @RateLimit({
    points: 5,
    duration: 15 * 60,
    keyPrefix: 'password_reset_request',
    useIp: true,
  })
  async requestPasswordReset(@Body() dto: RequestPasswordResetDto) {
    return this.authService.requestPasswordReset(dto.email);
  }

  @Post('reset-password')
  async resetPassword(@Body() dto: ResetPasswordDto) {
    return this.authService.resetPassword(dto.token, dto.password);
  }

  @UseGuards(JwtAuthGuard)
  @Get('me')
  async getProfile(@Request() req) {
    return this.authService.getUserById(req.user.userId);
  }

  @Get('verify-email')
  @UseGuards(RateLimitGuard)
  @RateLimit({
    points: 5,
    duration: 15 * 60, // 15 minutes
    keyPrefix: 'email_verify',
    useIp: true,
  })
  async verifyEmail(@Query('token') token: string) {
    return this.authService.verifyEmail(token);
  }

  @UseGuards(JwtAuthGuard)
  @Post('resend-verification')
  async resendVerificationEmail(@Request() req) {
    return this.authService.resendVerificationEmail(req.user.userId);
  }
}
