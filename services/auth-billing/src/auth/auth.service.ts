import { Injectable, UnauthorizedException, ConflictException, HttpException, HttpStatus, NotFoundException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';
import { DatabaseService } from '../database/database.service';
import { RedisService } from '../redis/redis.service';
import { EmailService } from '../email/email.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';

@Injectable()
export class AuthService {
  private readonly MAX_LOGIN_ATTEMPTS = 5;
  private readonly LOCKOUT_DURATION_MINUTES = 15;

  constructor(
    private readonly db: DatabaseService,
    private readonly jwtService: JwtService,
    private readonly redisService: RedisService,
    private readonly emailService: EmailService,
  ) {}

  async register(registerDto: RegisterDto) {
    const { email, password } = registerDto;

    const existingUser = await this.db.query(
      'SELECT id FROM users WHERE email = $1',
      [email],
    );

    if (existingUser.rows.length > 0) {
      throw new ConflictException('User with this email already exists');
    }

    const passwordHash = await bcrypt.hash(password, 10);
    
    const trialEndsAt = new Date();
    trialEndsAt.setDate(trialEndsAt.getDate() + 7);

    const result = await this.db.query(
      `INSERT INTO users (email, password_hash, role, subscription_tier, trial_ends_at)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, email, role, subscription_tier, trial_ends_at, created_at`,
      [email, passwordHash, 'student', 'free_trial', trialEndsAt],
    );

    const user = result.rows[0];

    await this.db.query(
      `INSERT INTO user_progress (user_id, current_level, total_xp)
       VALUES ($1, 1, 0)`,
      [user.id],
    );

    const { accessToken, refreshToken } = await this.generateTokens(user.id, user.email, user.role);

    // Send verification email (don't block registration if email fails)
    try {
      await this.sendVerificationEmail(user.id);
    } catch (error) {
      // Log error but don't fail registration
      console.error('Failed to send verification email:', error);
    }

    return {
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
        subscription_tier: user.subscription_tier,
        trial_ends_at: user.trial_ends_at,
        email_verified: false, // New users are not verified
      },
      accessToken,
      refreshToken,
    };
  }

  async login(loginDto: LoginDto) {
    const { email, password } = loginDto;

    // Check if account is locked due to too many failed attempts
    const attempts = await this.redisService.getLoginAttempts(email);
    if (attempts >= this.MAX_LOGIN_ATTEMPTS) {
      const ttl = await this.redisService.getLoginAttemptsTTL(email);
      const minutesRemaining = Math.ceil(ttl / 60);
      
      throw new HttpException(
        {
          statusCode: HttpStatus.TOO_MANY_REQUESTS,
          message: `Too many failed login attempts. Account is locked. Please try again in ${minutesRemaining} minute(s).`,
          retryAfter: ttl,
        },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    const result = await this.db.query(
      'SELECT id, email, password_hash, role, subscription_tier, trial_ends_at FROM users WHERE email = $1',
      [email],
    );

    if (result.rows.length === 0) {
      // Increment failed attempts even for non-existent users to prevent enumeration
      await this.redisService.incrementLoginAttempts(email);
      throw new UnauthorizedException('Invalid credentials');
    }

    const user = result.rows[0];
    const isPasswordValid = await bcrypt.compare(password, user.password_hash);

    if (!isPasswordValid) {
      // Increment failed attempts
      const newAttempts = await this.redisService.incrementLoginAttempts(email);
      
      if (newAttempts >= this.MAX_LOGIN_ATTEMPTS) {
        throw new HttpException(
          {
            statusCode: HttpStatus.TOO_MANY_REQUESTS,
            message: `Too many failed login attempts. Account is locked for ${this.LOCKOUT_DURATION_MINUTES} minutes.`,
            retryAfter: this.LOCKOUT_DURATION_MINUTES * 60,
          },
          HttpStatus.TOO_MANY_REQUESTS,
        );
      }
      
      const remainingAttempts = this.MAX_LOGIN_ATTEMPTS - newAttempts;
      throw new UnauthorizedException(
        `Invalid credentials. ${remainingAttempts} attempt(s) remaining before account lockout.`,
      );
    }

    // Successful login - reset attempt counter
    await this.redisService.resetLoginAttempts(email);

    const { accessToken, refreshToken } = await this.generateTokens(user.id, user.email, user.role);

    return {
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
        subscription_tier: user.subscription_tier,
        trial_ends_at: user.trial_ends_at,
      },
      accessToken,
      refreshToken,
    };
  }

  async refreshAccessToken(refreshToken: string) {
    try {
      const payload = this.jwtService.verify(refreshToken, {
        secret: process.env.JWT_REFRESH_SECRET || 'refresh-secret-change-in-production',
      });

      const result = await this.db.query(
        'SELECT id, email, role FROM users WHERE id = $1',
        [payload.sub],
      );

      if (result.rows.length === 0) {
        throw new UnauthorizedException('User not found');
      }

      const user = result.rows[0];
      const { accessToken, refreshToken: newRefreshToken } = await this.generateTokens(
        user.id,
        user.email,
        user.role,
      );

      return {
        accessToken,
        refreshToken: newRefreshToken,
      };
    } catch (error) {
      throw new UnauthorizedException('Invalid refresh token');
    }
  }

  async getUserById(userId: string) {
    const result = await this.db.query(
      `SELECT u.id, u.email, u.role, u.subscription_tier, u.trial_ends_at, u.created_at,
              s.status as subscription_status, s.current_period_end,
              up.current_level, up.total_xp
       FROM users u
       LEFT JOIN subscriptions s ON u.id = s.user_id
       LEFT JOIN user_progress up ON u.id = up.user_id
       WHERE u.id = $1`,
      [userId],
    );

    if (result.rows.length === 0) {
      throw new UnauthorizedException('User not found');
    }

    const user = result.rows[0];
    
    return {
      id: user.id,
      email: user.email,
      role: user.role,
      subscription_tier: user.subscription_tier,
      trial_ends_at: user.trial_ends_at,
      subscription_status: user.subscription_status,
      current_period_end: user.current_period_end,
      ngs_progress: {
        current_level: user.current_level,
        total_xp: user.total_xp,
      },
      created_at: user.created_at,
    };
  }

  private async generateTokens(userId: string, email: string, role: string) {
    const payload = { sub: userId, email, role };

    const accessToken = this.jwtService.sign(payload);
    
    const refreshToken = this.jwtService.sign(payload, {
      secret: process.env.JWT_REFRESH_SECRET || 'refresh-secret-change-in-production',
      expiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d',
    });

    return { accessToken, refreshToken };
  }

  async validateUser(email: string, password: string): Promise<any> {
    const result = await this.db.query(
      'SELECT id, email, password_hash, role FROM users WHERE email = $1',
      [email],
    );

    if (result.rows.length === 0) {
      return null;
    }

    const user = result.rows[0];
    const isPasswordValid = await bcrypt.compare(password, user.password_hash);

    if (isPasswordValid) {
      const { password_hash, ...userWithoutPassword } = user;
      return userWithoutPassword;
    }

    return null;
  }

  /**
   * Generate a secure random token for email verification
   * @returns 32-byte hex string token
   */
  private generateVerificationToken(): string {
    return crypto.randomBytes(32).toString('hex');
  }

  /**
   * Send email verification to user
   * @param userId User ID
   */
  async sendVerificationEmail(userId: string): Promise<void> {
    // Get user email
    const result = await this.db.query(
      'SELECT email, email_verified FROM users WHERE id = $1',
      [userId],
    );

    if (result.rows.length === 0) {
      throw new NotFoundException('User not found');
    }

    const user = result.rows[0];

    if (user.email_verified) {
      throw new ConflictException('Email already verified');
    }

    // Generate verification token
    const token = this.generateVerificationToken();
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 24); // 24 hour expiration

    // Store token in database
    await this.db.query(
      `UPDATE users 
       SET email_verification_token = $1, 
           email_verification_token_expires_at = $2,
           updated_at = NOW()
       WHERE id = $3`,
      [token, expiresAt, userId],
    );

    // Send verification email
    const emailSent = await this.emailService.sendVerificationEmail(user.email, token);

    if (!emailSent) {
      throw new HttpException(
        'Failed to send verification email. Please try again later.',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Verify email with token
   * @param token Verification token
   */
  async verifyEmail(token: string): Promise<{ message: string }> {
    if (!token || token.trim() === '') {
      throw new HttpException('Invalid verification token', HttpStatus.BAD_REQUEST);
    }

    // Find user by token
    const result = await this.db.query(
      `SELECT id, email, email_verified, email_verification_token_expires_at 
       FROM users 
       WHERE email_verification_token = $1`,
      [token],
    );

    if (result.rows.length === 0) {
      throw new HttpException(
        'Invalid or expired verification token',
        HttpStatus.BAD_REQUEST,
      );
    }

    const user = result.rows[0];

    // Check if already verified
    if (user.email_verified) {
      throw new ConflictException('Email already verified');
    }

    // Check if token expired
    const now = new Date();
    const expiresAt = new Date(user.email_verification_token_expires_at);

    if (now > expiresAt) {
      throw new HttpException(
        'Verification token has expired. Please request a new one.',
        HttpStatus.BAD_REQUEST,
      );
    }

    // Mark email as verified and clear token (single-use)
    await this.db.query(
      `UPDATE users 
       SET email_verified = true,
           email_verification_token = NULL,
           email_verification_token_expires_at = NULL,
           updated_at = NOW()
       WHERE id = $1`,
      [user.id],
    );

    return {
      message: 'Email verified successfully! You can now access all features.',
    };
  }

  /**
   * Resend verification email
   * @param userId User ID
   */
  async resendVerificationEmail(userId: string): Promise<{ message: string }> {
    // Check rate limiting (3 attempts per hour)
    const rateLimitKey = `email_verify_resend:${userId}`;
    const attemptsStr = await this.redisService.get(rateLimitKey);
    const attempts = attemptsStr ? parseInt(attemptsStr, 10) : 0;

    if (attempts >= 3) {
      const ttl = await this.redisService.getClient().ttl(rateLimitKey);
      const minutesRemaining = Math.ceil(ttl / 60);
      
      throw new HttpException(
        {
          statusCode: HttpStatus.TOO_MANY_REQUESTS,
          message: `Too many verification email requests. Please try again in ${minutesRemaining} minute(s).`,
          retryAfter: ttl,
        },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    await this.sendVerificationEmail(userId);

    // Increment counter with 1 hour expiration
    const newAttempts = attempts + 1;
    await this.redisService.setWithExpiry(rateLimitKey, newAttempts.toString(), 3600);

    return {
      message: 'Verification email sent successfully. Please check your inbox.',
    };
  }
}
