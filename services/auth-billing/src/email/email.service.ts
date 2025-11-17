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
    this.frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';

    const smtpHost = process.env.SMTP_HOST;
    const smtpUser = process.env.SMTP_USER;
    const smtpPassword = process.env.SMTP_PASSWORD;
    const smtpPort = parseInt(process.env.SMTP_PORT || '587', 10);
    const smtpSecure = process.env.SMTP_SECURE === 'true';

    const hasSmtpCredentials = Boolean(smtpHost && smtpUser && smtpPassword);

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
}
