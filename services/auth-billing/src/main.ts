import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';
import * as dotenv from 'dotenv';
import * as express from 'express';
import helmet from 'helmet';
import { CorrelationIdInterceptor } from './interceptors/correlation-id.interceptor';
import { logger } from './logger';

dotenv.config();

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    logger: false, // Disable default logger, use Winston
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
  
  app.enableCors();
  
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

bootstrap();
