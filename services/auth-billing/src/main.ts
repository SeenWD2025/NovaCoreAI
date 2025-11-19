import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';
import * as dotenv from 'dotenv';
import * as express from 'express';
import * as fs from 'fs';
import * as path from 'path';
import helmet from 'helmet';
import { CorrelationIdInterceptor } from './interceptors/correlation-id.interceptor';
import { logger } from './logger';

dotenv.config();

const repoRootEnvPath = path.resolve(__dirname, '../../../.env');
if (fs.existsSync(repoRootEnvPath)) {
  // Support local npm start executions that run from service directory
  dotenv.config({ path: repoRootEnvPath });
}

// Global error handlers to surface bootstrap failures and unexpected exits
const exitWithLog = (code: number) => {
  // give winston a moment to flush to stdout/stderr
  setTimeout(() => process.exit(code), 100);
};

process.on('unhandledRejection', (reason) => {
  logger.error('Unhandled promise rejection encountered', {
    error: reason instanceof Error ? reason.message : reason,
    stack: reason instanceof Error ? reason.stack : undefined,
  });
  exitWithLog(1);
});

process.on('uncaughtException', (error) => {
  logger.error('Uncaught exception encountered', {
    error: error.message,
    stack: error.stack,
  });
  exitWithLog(1);
});

process.on('exit', (code) => {
  logger.warn('Auth-Billing service process exiting', { code });
});

process.on('beforeExit', (code) => {
  logger.warn('Auth-Billing service beforeExit triggered', { code });
});

/**
 * Environment Variable Validation (Issue #9)
 * Validates required environment variables at startup
 */
async function validateEnvironment() {
  const required = [
    'JWT_SECRET',
    'JWT_REFRESH_SECRET', 
    'SERVICE_JWT_SECRET',
    'DATABASE_URL',
  ];

  const missing = required.filter(key => !process.env[key]);
  
  if (missing.length > 0) {
    logger.error(`❌ Missing required environment variables: ${missing.join(', ')}`);
    throw new Error(`Missing environment variables: ${missing.join(', ')}`);
  }

  // Warn about default values
  const defaults = {
    JWT_SECRET: 'your-secret-key-change-in-production',
    JWT_REFRESH_SECRET: 'your-refresh-secret-change-in-production', 
    SERVICE_JWT_SECRET: 'your-service-jwt-secret-change-in-production',
  };

  let hasWarnings = false;
  for (const [key, defaultValue] of Object.entries(defaults)) {
    if (process.env[key] === defaultValue) {
      logger.warn(`⚠️  ${key} is using default value! Change in production!`);
      hasWarnings = true;
    }
  }

  // Check secret strength in production
  if (process.env.NODE_ENV === 'production') {
    for (const key of ['JWT_SECRET', 'JWT_REFRESH_SECRET', 'SERVICE_JWT_SECRET']) {
      const secret = process.env[key];
      if (!secret || secret.length < 32) {
        logger.error(`❌ ${key} must be at least 32 characters in production (current: ${secret ? secret.length : 0} chars)`);
        throw new Error(`${key} must be at least 32 characters in production`);
      }
    }
  }

  // Check optional but important variables
  const optional = {
    STRIPE_SECRET_KEY: 'Stripe functionality disabled',
    REDIS_URL: 'Rate limiting may not work',
    SMTP_HOST: 'Email notifications disabled',
  };

  for (const [key, impact] of Object.entries(optional)) {
    if (!process.env[key]) {
      logger.warn(`⚠️  ${key} not set: ${impact}`);
    } else if (key === 'STRIPE_SECRET_KEY' && process.env[key].startsWith('sk_test_xxx')) {
      logger.warn(`⚠️  ${key} appears to be a placeholder`);
    }
  }

  if (!hasWarnings && process.env.NODE_ENV === 'production') {
    logger.info('✅ All environment variables validated');
  } else {
    logger.info('✅ Environment variables validated (with warnings)');
  }
}

async function bootstrap() {
  // Validate environment before starting
  await validateEnvironment();
  const app = await NestFactory.create(AppModule, {
    // Re-enable Nest error logging to surface bootstrap failures while Winston integration is refined
    logger: ['error', 'warn'],
  });
  
  // Security headers
  app.use(helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        scriptSrc: ["'self'"],
      },
    },
    hsts: {
      maxAge: 31536000, // 1 year
      includeSubDomains: true,
    },
  }));
  
  // Configure raw body for Stripe webhook verification
  // This must be done before JSON parsing
  app.use('/billing/webhooks', express.raw({ type: 'application/json' }));
  
  // Global correlation ID interceptor
  app.useGlobalInterceptors(new CorrelationIdInterceptor());
  
  app.useGlobalPipes(new ValidationPipe({
    whitelist: true,
    forbidNonWhitelisted: true,
    transform: true,
  }));
  
  // CORS Configuration (Issue #11 - Security Fix)
  // Only allow requests from Gateway and Frontend
  app.enableCors({
    origin: (origin, callback) => {
      const allowedOrigins = [
        process.env.GATEWAY_URL || 'http://localhost:5000',
        process.env.FRONTEND_URL || 'http://localhost:5173',
        'http://localhost:5000', // Gateway
        'http://localhost:5173', // Frontend
      ];

      // Allow requests with no origin (server-to-server, Postman, curl)
      if (!origin) {
        return callback(null, true);
      }

      if (allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        logger.warn('Blocked CORS request from unauthorized origin', { origin });
        callback(new Error('Not allowed by CORS'));
      }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Service-Token', 'X-User-Id', 'X-User-Email', 'X-User-Role'],
  });
  
  const port = process.env.PORT || 3001;
  await app.listen(port, '0.0.0.0');
  
  logger.info('🔐 Auth & Billing Service running', {
    port,
    environment: process.env.NODE_ENV || 'development'
  });
  logger.info('✅ Stripe webhook configured at /billing/webhooks');
  logger.info('📊 Metrics available at /metrics');
  logger.info('🔗 Correlation IDs enabled');
  
  if (!process.env.STRIPE_WEBHOOK_SECRET) {
    logger.warn('⚠️  WARNING: STRIPE_WEBHOOK_SECRET not set!');
  }
}

bootstrap().catch((error) => {
  logger.error('Bootstrap failure: unable to start Auth-Billing service', {
    error: error instanceof Error ? error.message : error,
    stack: error instanceof Error ? error.stack : undefined,
  });
  exitWithLog(1);
});
