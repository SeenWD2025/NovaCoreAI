import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';
import * as dotenv from 'dotenv';
import * as express from 'express';
import helmet from 'helmet';

dotenv.config();

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  
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
  
  app.useGlobalPipes(new ValidationPipe({
    whitelist: true,
    forbidNonWhitelisted: true,
    transform: true,
  }));
  
  app.enableCors();
  
  const port = process.env.PORT || 3001;
  await app.listen(port, '0.0.0.0');
  
  console.log(`🔐 Auth & Billing Service running on port ${port}`);
  console.log(`📊 Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`✅ Stripe webhook configured at /billing/webhooks`);
  
  if (!process.env.STRIPE_WEBHOOK_SECRET) {
    console.warn('⚠️  WARNING: STRIPE_WEBHOOK_SECRET not set!');
  }
}

bootstrap();
