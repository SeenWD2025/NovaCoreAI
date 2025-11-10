import { Injectable, UnauthorizedException, ConflictException, HttpException, HttpStatus } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { DatabaseService } from '../database/database.service';
import { RedisService } from '../redis/redis.service';
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
}
