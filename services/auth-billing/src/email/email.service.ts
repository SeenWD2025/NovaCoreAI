import { Injectable } from '@nestjs/common';
import * as nodemailer from 'nodemailer';
import { Transporter } from 'nodemailer';
import { createContextLogger } from '../logger';

@Injectable()
export class EmailService {
  private transporter: Transporter;
  private readonly logger = createContextLogger({ context: EmailService.name });
  private readonly fromEmail: string;
  private readonly frontendUrl: string;

  constructor() {
    this.fromEmail = process.env.EMAIL_FROM || 'noreply@novacore.ai';
    this.frontendUrl = (process.env.FRONTEND_URL || 'http://localhost:5173').replace(/\/$/, '');

    const smtpHost = process.env.SMTP_HOST;
    const smtpUser = process.env.SMTP_USER;
    const smtpPassword = process.env.SMTP_PASSWORD;
    const smtpPort = parseInt(process.env.SMTP_PORT || '587', 10);
    const smtpSecure = process.env.SMTP_SECURE === 'true';

    const hasSmtpCredentials = Boolean(smtpHost && smtpUser && smtpPassword);

    this.logger.debug('Email service configuration resolved', {
      fromEmail: this.fromEmail,
      frontendUrl: this.frontendUrl,
      smtpHost,
      smtpPort,
      smtpSecure,
      hasSmtpCredentials,
      nodeEnv: process.env.NODE_ENV || 'development',
    });

    if (process.env.NODE_ENV === 'production' && hasSmtpCredentials) {
  this.logger.info('Email service using configured SMTP transport (production mode).');
      this.transporter = nodemailer.createTransport({
        host: smtpHost,
        port: smtpPort,
        secure: smtpSecure,
        auth: {
          user: smtpUser,
          pass: smtpPassword,
        },
      });
      return;
    }

    if (hasSmtpCredentials) {
  this.logger.info('Email service using configured SMTP transport (non-production mode).');
      this.transporter = nodemailer.createTransport({
        host: smtpHost,
        port: smtpPort,
        secure: smtpSecure,
        auth: {
          user: smtpUser,
          pass: smtpPassword,
        },
      });
      return;
    }

    // Fallback: stream transport keeps messages local, ensuring dev/test environments succeed
  this.logger.warn('Email service using stream transport. Emails will be logged but not sent.');
    this.transporter = nodemailer.createTransport({
      streamTransport: true,
      newline: 'unix',
      buffer: true,
    });
  }

  /**
   * Send email verification email to user
   * @param email User's email address
   * @param token Verification token
   */
  async sendVerificationEmail(email: string, token: string): Promise<boolean> {
    const verificationUrl = `${this.frontendUrl}/verify-email?token=${token}`;

    const mailOptions = {
      from: this.fromEmail,
      to: email,
      subject: 'Verify Your NovaCoreAI Account',
      html: this.getVerificationEmailTemplate(verificationUrl, token),
      text: `Welcome to NovaCoreAI! Please verify your email by clicking this link: ${verificationUrl}`,
    };

    try {
      const info = await this.transporter.sendMail(mailOptions);
      
      if (process.env.NODE_ENV !== 'production') {
        this.logger.info('Verification email emitted (stream transport).', { email });
        const previewUrl = nodemailer.getTestMessageUrl(info);
        if (previewUrl) {
          this.logger.info('Preview URL', { previewUrl });
        }
        if ((info as any).message) {
          this.logger.debug('Email payload', { payload: (info as any).message.toString() });
        }
        this.logger.info('Verification URL', { verificationUrl });
      }

      return true;
    } catch (error) {
      this.logger.error('Failed to send verification email', {
        email,
        error: error instanceof Error ? error.message : error,
        stack: error instanceof Error ? error.stack : undefined,
      });
      if (process.env.NODE_ENV !== 'production') {
        this.logger.warn('Continuing without verification email delivery (non-production fallback).', {
          email,
        });
      }
      return false;
    }

  }

    private normalizeDate(value: Date | string): Date {
      return value instanceof Date ? value : new Date(value);
    }

  /**
   * Send password reset email (for future implementation)
   * @param email User's email address
   * @param token Reset token
   */
  async sendPasswordResetEmail(email: string, token: string): Promise<boolean> {
    const resetUrl = `${this.frontendUrl}/reset-password?token=${token}`;

    const mailOptions = {
      from: this.fromEmail,
      to: email,
      subject: 'Reset Your NovaCoreAI Password',
      html: this.getPasswordResetEmailTemplate(resetUrl, token),
      text: `Reset your password by clicking this link: ${resetUrl}`,
    };

    try {
      const info = await this.transporter.sendMail(mailOptions);
      
      if (process.env.NODE_ENV !== 'production') {
        this.logger.info('Password reset email emitted (stream transport).', { email });
        const previewUrl = nodemailer.getTestMessageUrl(info);
        if (previewUrl) {
          this.logger.info('Preview URL', { previewUrl });
        }
        if ((info as any).message) {
          this.logger.debug('Email payload', { payload: (info as any).message.toString() });
        }
      }

      return true;
    } catch (error) {
      this.logger.error('Failed to send password reset email', {
        email,
        error: error instanceof Error ? error.message : error,
        stack: error instanceof Error ? error.stack : undefined,
      });
      if (process.env.NODE_ENV !== 'production') {
        this.logger.warn('Continuing without password reset email delivery (non-production fallback).', {
          email,
        });
      }
      return false;
    }
  }

  /**
   * HTML template for verification email
   */
  private getVerificationEmailTemplate(verificationUrl: string, token: string): string {
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Verify Your Email</title>
        <style>
          body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
            line-height: 1.6;
            color: #333;
            max-width: 600px;
            margin: 0 auto;
            padding: 20px;
          }
          .header {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            padding: 30px;
            text-align: center;
            border-radius: 8px 8px 0 0;
          }
          .content {
            background: #ffffff;
            padding: 40px 30px;
            border: 1px solid #e0e0e0;
            border-top: none;
            border-radius: 0 0 8px 8px;
          }
          .button {
            display: inline-block;
            padding: 14px 32px;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white !important;
            text-decoration: none;
            border-radius: 6px;
            font-weight: 600;
            margin: 20px 0;
          }
          .footer {
            text-align: center;
            margin-top: 30px;
            color: #666;
            font-size: 14px;
          }
          .token {
            background: #f5f5f5;
            padding: 10px;
            border-radius: 4px;
            font-family: monospace;
            word-break: break-all;
            margin: 10px 0;
          }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>🌟 Welcome to NovaCoreAI</h1>
        </div>
        <div class="content">
          <h2>Verify Your Email Address</h2>
          <p>Thank you for joining NovaCoreAI! To complete your registration and start your AI-powered learning journey, please verify your email address.</p>
          
          <p style="text-align: center;">
            <a href="${verificationUrl}" class="button">Verify Email Address</a>
          </p>

          <p>If the button doesn't work, copy and paste this link into your browser:</p>
          <p class="token">${verificationUrl}</p>

          <p><strong>This link will expire in 24 hours.</strong></p>

          <p>If you didn't create an account with NovaCoreAI, you can safely ignore this email.</p>

          <hr style="border: none; border-top: 1px solid #e0e0e0; margin: 30px 0;">

          <p><strong>What's Next?</strong></p>
          <ul>
            <li>🤖 Start conversations with your AI companion</li>
            <li>📚 Begin your Noble Growth System (NGS) curriculum</li>
            <li>🧠 Build your personal memory system</li>
            <li>🎯 Unlock achievements and level up</li>
          </ul>
        </div>
        <div class="footer">
          <p>NovaCoreAI - Constitutional AI for Noble Growth</p>
          <p>If you have questions, reply to this email or visit our support page.</p>
        </div>
      </body>
      </html>
    `;
  }

  /**
   * Send subscription confirmation email
   * @param email User's email address
   * @param tier Subscription tier (basic or pro)
   */
  async sendSubscriptionConfirmationEmail(email: string, tier: string): Promise<boolean> {
    const mailOptions = {
      from: this.fromEmail,
      to: email,
      subject: `Welcome to NovaCoreAI ${tier.charAt(0).toUpperCase() + tier.slice(1)}!`,
      html: this.getSubscriptionConfirmationTemplate(tier),
      text: `Thank you for subscribing to NovaCoreAI ${tier}! Your subscription is now active.`,
    };

    try {
      const info = await this.transporter.sendMail(mailOptions);
      
      if (process.env.NODE_ENV !== 'production') {
        this.logger.info('Subscription confirmation email emitted (stream transport).', { email, tier });
        const previewUrl = nodemailer.getTestMessageUrl(info);
        if (previewUrl) {
          this.logger.info('Preview URL', { previewUrl });
        }
      }

      return true;
    } catch (error) {
      this.logger.error('Failed to send subscription confirmation email', {
        email,
        tier,
        error: error instanceof Error ? error.message : error,
      });
      return false;
    }
  }

  /**
   * Send payment failure notification email
   * @param email User's email address
   * @param amount Amount that failed to charge
   */
  async sendPaymentFailureEmail(email: string, amount: number): Promise<boolean> {
    const mailOptions = {
      from: this.fromEmail,
      to: email,
      subject: 'Payment Failed - Action Required',
      html: this.getPaymentFailureTemplate(amount),
      text: `Your recent payment of $${amount.toFixed(2)} failed. Please update your payment method to continue your subscription.`,
    };

    try {
      const info = await this.transporter.sendMail(mailOptions);
      
      if (process.env.NODE_ENV !== 'production') {
        this.logger.info('Payment failure email emitted (stream transport).', { email, amount });
        const previewUrl = nodemailer.getTestMessageUrl(info);
        if (previewUrl) {
          this.logger.info('Preview URL', { previewUrl });
        }
      }

      return true;
    } catch (error) {
      this.logger.error('Failed to send payment failure email', {
        email,
        amount,
        error: error instanceof Error ? error.message : error,
      });
      return false;
    }
  }

  /**
   * Send subscription cancellation email
   * @param email User's email address
   */
  async sendSubscriptionCancellationEmail(email: string): Promise<boolean> {
    const mailOptions = {
      from: this.fromEmail,
      to: email,
      subject: 'Subscription Cancelled',
      html: this.getSubscriptionCancellationTemplate(),
      text: 'Your NovaCoreAI subscription has been cancelled. You can resubscribe anytime.',
    };

    try {
      const info = await this.transporter.sendMail(mailOptions);
      
      if (process.env.NODE_ENV !== 'production') {
        this.logger.info('Subscription cancellation email emitted (stream transport).', { email });
        const previewUrl = nodemailer.getTestMessageUrl(info);
        if (previewUrl) {
          this.logger.info('Preview URL', { previewUrl });
        }
      }

      return true;
    } catch (error) {
      this.logger.error('Failed to send subscription cancellation email', {
        email,
        error: error instanceof Error ? error.message : error,
      });
      return false;
    }
  }

  /**
   * HTML template for subscription confirmation email
   */
  private getSubscriptionConfirmationTemplate(tier: string): string {
    const tierName = tier.charAt(0).toUpperCase() + tier.slice(1);
    const features = tier === 'pro' 
      ? ['Unlimited AI conversations', 'Priority support', 'Advanced memory features', 'Custom AI agents', 'Early access to new features']
      : ['50,000 tokens per day', 'Full curriculum access', 'Memory system', 'Progress tracking', 'Achievement system'];

    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Subscription Confirmed</title>
        <style>
          body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
            line-height: 1.6;
            color: #333;
            max-width: 600px;
            margin: 0 auto;
            padding: 20px;
          }
          .header {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            padding: 30px;
            text-align: center;
            border-radius: 8px 8px 0 0;
          }
          .content {
            background: #ffffff;
            padding: 40px 30px;
            border: 1px solid #e0e0e0;
            border-top: none;
            border-radius: 0 0 8px 8px;
          }
          .features {
            background: #f8f9fa;
            padding: 20px;
            border-radius: 6px;
            margin: 20px 0;
          }
          .features ul {
            margin: 10px 0;
            padding-left: 20px;
          }
          .footer {
            text-align: center;
            margin-top: 30px;
            color: #666;
            font-size: 14px;
          }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>🎉 Welcome to ${tierName}!</h1>
        </div>
        <div class="content">
          <h2>Your Subscription is Active</h2>
          <p>Thank you for subscribing to NovaCoreAI ${tierName}! Your account has been upgraded and you now have access to all ${tierName} features.</p>
          
          <div class="features">
            <h3>Your ${tierName} Benefits:</h3>
            <ul>
              ${features.map(f => `<li>${f}</li>`).join('\n              ')}
            </ul>
          </div>

          <p><strong>What's Next?</strong></p>
          <ul>
            <li>Start using your enhanced features immediately</li>
            <li>Explore the full Noble Growth System curriculum</li>
            <li>Build your personalized AI memory system</li>
            <li>Track your progress and earn achievements</li>
          </ul>

          <p>You can manage your subscription anytime from your account settings.</p>
        </div>
        <div class="footer">
          <p>NovaCoreAI - Constitutional AI for Noble Growth</p>
          <p>Questions? Reply to this email or visit our support page.</p>
        </div>
      </body>
      </html>
    `;
  }

  /**
   * HTML template for payment failure email
   */
  private getPaymentFailureTemplate(amount: number): string {
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Payment Failed</title>
        <style>
          body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
            line-height: 1.6;
            color: #333;
            max-width: 600px;
            margin: 0 auto;
            padding: 20px;
          }
          .header {
            background: #dc3545;
            color: white;
            padding: 30px;
            text-align: center;
            border-radius: 8px 8px 0 0;
          }
          .content {
            background: #ffffff;
            padding: 40px 30px;
            border: 1px solid #e0e0e0;
            border-top: none;
            border-radius: 0 0 8px 8px;
          }
          .warning {
            background: #fff3cd;
            border: 1px solid #ffc107;
            padding: 15px;
            border-radius: 4px;
            margin: 20px 0;
          }
          .button {
            display: inline-block;
            padding: 14px 32px;
            background: #667eea;
            color: white !important;
            text-decoration: none;
            border-radius: 6px;
            font-weight: 600;
            margin: 20px 0;
          }
          .footer {
            text-align: center;
            margin-top: 30px;
            color: #666;
            font-size: 14px;
          }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>⚠️ Payment Failed</h1>
        </div>
        <div class="content">
          <h2>Action Required</h2>
          <p>We were unable to process your recent payment of <strong>$${amount.toFixed(2)}</strong> for your NovaCoreAI subscription.</p>
          
          <div class="warning">
            <strong>Your subscription may be suspended if payment is not updated.</strong>
          </div>

          <p>Common reasons for payment failures:</p>
          <ul>
            <li>Insufficient funds</li>
            <li>Expired credit card</li>
            <li>Incorrect billing information</li>
            <li>Bank declined the transaction</li>
          </ul>

          <p style="text-align: center;">
            <a href="${this.frontendUrl}/billing" class="button">Update Payment Method</a>
          </p>

          <p>If you continue to experience issues, please contact your bank or our support team.</p>
        </div>
        <div class="footer">
          <p>NovaCoreAI - Constitutional AI for Noble Growth</p>
          <p>Questions? Reply to this email or visit our support page.</p>
        </div>
      </body>
      </html>
    `;
  }

  /**
   * HTML template for subscription cancellation email
   */
  private getSubscriptionCancellationTemplate(): string {
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Subscription Cancelled</title>
        <style>
          body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
            line-height: 1.6;
            color: #333;
            max-width: 600px;
            margin: 0 auto;
            padding: 20px;
          }
          .header {
            background: #6c757d;
            color: white;
            padding: 30px;
            text-align: center;
            border-radius: 8px 8px 0 0;
          }
          .content {
            background: #ffffff;
            padding: 40px 30px;
            border: 1px solid #e0e0e0;
            border-top: none;
            border-radius: 0 0 8px 8px;
          }
          .button {
            display: inline-block;
            padding: 14px 32px;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white !important;
            text-decoration: none;
            border-radius: 6px;
            font-weight: 600;
            margin: 20px 0;
          }
          .footer {
            text-align: center;
            margin-top: 30px;
            color: #666;
            font-size: 14px;
          }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>Subscription Cancelled</h1>
        </div>
        <div class="content">
          <h2>We're Sorry to See You Go</h2>
          <p>Your NovaCoreAI subscription has been cancelled. You'll continue to have access to your current features until the end of your billing period.</p>
          
          <p><strong>What happens next:</strong></p>
          <ul>
            <li>Your account will revert to the free tier after your billing period ends</li>
            <li>Your progress and data will be preserved</li>
            <li>You can resubscribe anytime to regain full access</li>
          </ul>

          <p>We'd love to have you back! If you cancelled due to an issue, please let us know how we can improve.</p>

          <p style="text-align: center;">
            <a href="${this.frontendUrl}/billing" class="button">Resubscribe</a>
          </p>
        </div>
        <div class="footer">
          <p>NovaCoreAI - Constitutional AI for Noble Growth</p>
          <p>Questions? Reply to this email or visit our support page.</p>
        </div>
      </body>
      </html>
    `;
  }

  /**
   * HTML template for password reset email
   */
  private getPasswordResetEmailTemplate(resetUrl: string, token: string): string {
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Reset Your Password</title>
        <style>
          body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
            line-height: 1.6;
            color: #333;
            max-width: 600px;
            margin: 0 auto;
            padding: 20px;
          }
          .header {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            padding: 30px;
            text-align: center;
            border-radius: 8px 8px 0 0;
          }
          .content {
            background: #ffffff;
            padding: 40px 30px;
            border: 1px solid #e0e0e0;
            border-top: none;
            border-radius: 0 0 8px 8px;
          }
          .button {
            display: inline-block;
            padding: 14px 32px;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white !important;
            text-decoration: none;
            border-radius: 6px;
            font-weight: 600;
            margin: 20px 0;
          }
          .footer {
            text-align: center;
            margin-top: 30px;
            color: #666;
            font-size: 14px;
          }
          .token {
            background: #f5f5f5;
            padding: 10px;
            border-radius: 4px;
            font-family: monospace;
            word-break: break-all;
            margin: 10px 0;
          }
          .warning {
            background: #fff3cd;
            border: 1px solid #ffc107;
            padding: 15px;
            border-radius: 4px;
            margin: 20px 0;
          }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>🔒 Password Reset Request</h1>
        </div>
        <div class="content">
          <h2>Reset Your Password</h2>
          <p>We received a request to reset your password for your NovaCoreAI account.</p>
          
          <p style="text-align: center;">
            <a href="${resetUrl}" class="button">Reset Password</a>
          </p>

          <p>If the button doesn't work, copy and paste this link into your browser:</p>
          <p class="token">${resetUrl}</p>

          <div class="warning">
            <strong>⚠️ Security Notice:</strong> This link will expire in 1 hour. If you didn't request a password reset, please ignore this email and your password will remain unchanged.
          </div>

          <p>For security reasons, we recommend:</p>
          <ul>
            <li>Use a strong, unique password</li>
            <li>Enable two-factor authentication (coming soon)</li>
            <li>Never share your password with anyone</li>
          </ul>
        </div>
        <div class="footer">
          <p>NovaCoreAI - Constitutional AI for Noble Growth</p>
          <p>If you have questions, reply to this email or visit our support page.</p>
        </div>
      </body>
      </html>
    `;
  }

  /**
   * Send trial expiration reminder email (Issue #6)
   * @param email User's email address
   * @param trialEndDate Date when trial expires
   */
  async sendTrialExpiringEmail(email: string, trialEndDate: Date | string): Promise<boolean> {
    const normalizedDate = this.normalizeDate(trialEndDate);
    const formattedDate = normalizedDate.toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });

    const mailOptions = {
      from: this.fromEmail,
      to: email,
      subject: '⏰ Your NovaCoreAI Trial Expires Tomorrow',
      html: this.getTrialExpiringTemplate(formattedDate),
      text: `Your NovaCoreAI free trial expires on ${formattedDate}. Subscribe now to continue your AI learning journey!`,
    };

    try {
      const info = await this.transporter.sendMail(mailOptions);
      
      if (process.env.NODE_ENV !== 'production') {
        this.logger.info('Trial expiring email emitted (stream transport).', { email, trialEndDate: normalizedDate.toISOString() });
        const previewUrl = nodemailer.getTestMessageUrl(info);
        if (previewUrl) {
          this.logger.info('Preview URL', { previewUrl });
        }
      }

      return true;
    } catch (error) {
      this.logger.error('Failed to send trial expiring email', {
        email,
        trialEndDate,
        error: error instanceof Error ? error.message : error,
      });
      return false;
    }
  }

  /**
   * Send trial expired notification email (Issue #6)
   * @param email User's email address
   * @param trialEndDate Date when trial expired
   */
  async sendTrialExpiredEmail(email: string, trialEndDate: Date | string): Promise<boolean> {
    const normalizedDate = this.normalizeDate(trialEndDate);
    const formattedDate = normalizedDate.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });

    const mailOptions = {
      from: this.fromEmail,
      to: email,
      subject: '🔒 Your NovaCoreAI Trial Has Expired',
      html: this.getTrialExpiredTemplate(formattedDate),
      text: `Your NovaCoreAI free trial expired on ${formattedDate}. Your account has been moved to our free tier. Subscribe anytime to unlock full features!`,
    };

    try {
      const info = await this.transporter.sendMail(mailOptions);
      
      if (process.env.NODE_ENV !== 'production') {
        this.logger.info('Trial expired email emitted (stream transport).', { email, trialEndDate: normalizedDate.toISOString() });
        const previewUrl = nodemailer.getTestMessageUrl(info);
        if (previewUrl) {
          this.logger.info('Preview URL', { previewUrl });
        }
      }

      return true;
    } catch (error) {
      this.logger.error('Failed to send trial expired email', {
        email,
        trialEndDate,
        error: error instanceof Error ? error.message : error,
      });
      return false;
    }
  }

  /**
   * HTML template for trial expiring reminder email
   */
  private getTrialExpiringTemplate(formattedDate: string): string {
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Trial Expires Tomorrow</title>
        <style>
          body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
            line-height: 1.6;
            color: #333;
            max-width: 600px;
            margin: 0 auto;
            padding: 20px;
          }
          .header {
            background: linear-gradient(135deg, #ff9a56 0%, #ff6b6b 100%);
            color: white;
            padding: 30px;
            text-align: center;
            border-radius: 8px 8px 0 0;
          }
          .content {
            background: #ffffff;
            padding: 40px 30px;
            border: 1px solid #e0e0e0;
            border-top: none;
            border-radius: 0 0 8px 8px;
          }
          .urgent {
            background: #fff3cd;
            border: 1px solid #ffc107;
            padding: 20px;
            border-radius: 6px;
            margin: 20px 0;
            text-align: center;
          }
          .button-primary {
            display: inline-block;
            padding: 14px 32px;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white !important;
            text-decoration: none;
            border-radius: 6px;
            font-weight: 600;
            margin: 10px 10px;
          }
          .button-secondary {
            display: inline-block;
            padding: 14px 32px;
            background: #6c757d;
            color: white !important;
            text-decoration: none;
            border-radius: 6px;
            font-weight: 600;
            margin: 10px 10px;
          }
          .pricing {
            background: #f8f9fa;
            padding: 20px;
            border-radius: 6px;
            margin: 20px 0;
          }
          .price-plan {
            display: inline-block;
            width: 45%;
            margin: 10px 2%;
            padding: 15px;
            border: 1px solid #dee2e6;
            border-radius: 4px;
            text-align: center;
            vertical-align: top;
          }
          .footer {
            text-align: center;
            margin-top: 30px;
            color: #666;
            font-size: 14px;
          }
          @media (max-width: 600px) {
            .price-plan { width: 90%; display: block; margin: 10px auto; }
          }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>⏰ Don't Lose Your Progress!</h1>
        </div>
        <div class="content">
          <div class="urgent">
            <h2 style="margin: 0; color: #856404;">Your free trial expires on ${formattedDate}</h2>
          </div>

          <p>You've been making great progress with NovaCoreAI! Your free trial ends soon, and we'd hate to see you lose access to your personalized AI learning experience.</p>

          <h3>🚀 What You'll Keep With a Subscription:</h3>
          <ul>
            <li><strong>Unlimited AI Conversations</strong> - No daily limits</li>
            <li><strong>Your Personal Memory System</strong> - All your progress preserved</li>
            <li><strong>Noble Growth System</strong> - Complete curriculum access</li>
            <li><strong>Achievement System</strong> - Continue earning and unlocking</li>
            <li><strong>Priority Support</strong> - Get help when you need it</li>
          </ul>

          <div class="pricing">
            <h3 style="text-align: center; margin-top: 0;">Choose Your Plan:</h3>
            
            <div class="price-plan">
              <h4>Basic</h4>
              <div style="font-size: 24px; font-weight: bold; color: #667eea;">$9.99/mo</div>
              <p>50K tokens daily<br>Full curriculum<br>Memory system</p>
            </div>
            
            <div class="price-plan">
              <h4>Pro</h4>
              <div style="font-size: 24px; font-weight: bold; color: #667eea;">$19.99/mo</div>
              <p>Unlimited tokens<br>Custom AI agents<br>Priority support</p>
            </div>
          </div>

          <div style="text-align: center; margin: 30px 0;">
            <a href="${this.frontendUrl}/billing" class="button-primary">Subscribe Now</a>
            <a href="${this.frontendUrl}/pricing" class="button-secondary">View All Plans</a>
          </div>

          <p><strong>Questions?</strong> Reply to this email and our team will help you choose the perfect plan for your learning goals.</p>

          <p style="font-size: 14px; color: #666;"><em>After your trial expires, your account will move to our free tier with limited features. You can upgrade anytime to regain full access.</em></p>
        </div>
        <div class="footer">
          <p>NovaCoreAI - Constitutional AI for Noble Growth</p>
          <p>Don't want these emails? <a href="${this.frontendUrl}/unsubscribe">Unsubscribe</a></p>
        </div>
      </body>
      </html>
    `;
  }

  /**
   * HTML template for trial expired notification email
   */
  private getTrialExpiredTemplate(formattedDate: string): string {
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Trial Expired</title>
        <style>
          body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
            line-height: 1.6;
            color: #333;
            max-width: 600px;
            margin: 0 auto;
            padding: 20px;
          }
          .header {
            background: #6c757d;
            color: white;
            padding: 30px;
            text-align: center;
            border-radius: 8px 8px 0 0;
          }
          .content {
            background: #ffffff;
            padding: 40px 30px;
            border: 1px solid #e0e0e0;
            border-top: none;
            border-radius: 0 0 8px 8px;
          }
          .info-box {
            background: #e3f2fd;
            border-left: 4px solid #2196f3;
            padding: 20px;
            margin: 20px 0;
          }
          .free-features {
            background: #f8f9fa;
            padding: 20px;
            border-radius: 6px;
            margin: 20px 0;
          }
          .button {
            display: inline-block;
            padding: 14px 32px;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white !important;
            text-decoration: none;
            border-radius: 6px;
            font-weight: 600;
            margin: 20px 0;
          }
          .footer {
            text-align: center;
            margin-top: 30px;
            color: #666;
            font-size: 14px;
          }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>Your Trial Has Ended</h1>
        </div>
        <div class="content">
          <p>Your NovaCoreAI free trial expired on <strong>${formattedDate}</strong>. Thank you for exploring what AI-powered learning can do!</p>

          <div class="info-box">
            <h3 style="margin-top: 0;">📋 Your Account Status:</h3>
            <p><strong>✅ All your progress is saved</strong><br>
            Your conversations, achievements, and memory data are preserved and waiting for you.</p>
            
            <p><strong>🔄 Moved to Free Tier</strong><br>
            You now have access to our basic features with daily usage limits.</p>
          </div>

          <div class="free-features">
            <h3>🆓 What You Can Still Do (Free Tier):</h3>
            <ul>
              <li>5 AI conversations per day</li>
              <li>Basic curriculum access</li>
              <li>View your progress and achievements</li>
              <li>Browse the community features</li>
            </ul>
          </div>

          <h3>🚀 Ready to Unlock Everything?</h3>
          <p>Upgrade anytime to get back unlimited access to:</p>
          <ul>
            <li><strong>Unlimited AI conversations</strong></li>
            <li><strong>Your complete personal memory system</strong></li>
            <li><strong>Full Noble Growth System curriculum</strong></li>
            <li><strong>Achievement system and progress tracking</strong></li>
            <li><strong>Custom AI agents (Pro plan)</strong></li>
            <li><strong>Priority support</strong></li>
          </ul>

          <div style="text-align: center;">
            <a href="${this.frontendUrl}/billing" class="button">Reactivate Your Subscription</a>
          </div>

          <p>🤔 <strong>Have questions?</strong> We're here to help! Reply to this email or reach out to our support team.</p>

          <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;">
          
          <p style="font-size: 14px; color: #666;">
            <strong>We miss you already!</strong> Our AI remembers your learning style and preferences. When you return, you'll pick up exactly where you left off.
          </p>
        </div>
        <div class="footer">
          <p>NovaCoreAI - Constitutional AI for Noble Growth</p>
          <p>Want to update your email preferences? <a href="${this.frontendUrl}/settings">Account Settings</a></p>
        </div>
      </body>
      </html>
    `;
  }

}
