import { Injectable, NotFoundException } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { StripeService } from './stripe.service';

@Injectable()
export class BillingService {
  constructor(
    private readonly db: DatabaseService,
    private readonly stripeService: StripeService,
  ) {}

  async createCheckoutSession(userId: string, tier: 'basic' | 'pro') {
    const userResult = await this.db.query(
      'SELECT email, id FROM users WHERE id = $1',
      [userId],
    );

    if (userResult.rows.length === 0) {
      throw new NotFoundException('User not found');
    }

    const user = userResult.rows[0];

    let customer = await this.db.query(
      'SELECT stripe_customer_id FROM subscriptions WHERE user_id = $1',
      [userId],
    );

    let customerId: string;

    if (customer.rows.length > 0 && customer.rows[0].stripe_customer_id) {
      customerId = customer.rows[0].stripe_customer_id;
    } else {
      const stripeCustomer = await this.stripeService.createCustomer(user.email, {
        user_id: userId,
      });
      customerId = stripeCustomer.id;
      
      await this.db.query(
        `INSERT INTO subscriptions (user_id, stripe_customer_id, status, tier)
         VALUES ($1, $2, 'incomplete', $3)
         ON CONFLICT (user_id) DO UPDATE
         SET stripe_customer_id = EXCLUDED.stripe_customer_id`,
        [userId, customerId, tier],
      );
    }

    const session = await this.stripeService.createCheckoutSession(
      customerId,
      tier,
      userId,
    );

    return {
      sessionId: session.id,
      url: session.url,
    };
  }

  async handleWebhook(signature: string, rawBody: Buffer) {
    return this.stripeService.handleWebhook(signature, rawBody);
  }

  async getCustomerPortalUrl(userId: string) {
    const result = await this.db.query(
      'SELECT stripe_customer_id FROM subscriptions WHERE user_id = $1',
      [userId],
    );

    if (result.rows.length === 0 || !result.rows[0].stripe_customer_id) {
      throw new NotFoundException('No active subscription found');
    }

    const customerId = result.rows[0].stripe_customer_id;
    const portalSession = await this.stripeService.createPortalSession(customerId);

    return {
      url: portalSession.url,
    };
  }

  async getUserUsage(userId: string) {
    const result = await this.db.query(
      `SELECT resource_type, SUM(amount) as total
       FROM usage_ledger
       WHERE user_id = $1 AND timestamp >= NOW() - INTERVAL '30 days'
       GROUP BY resource_type`,
      [userId],
    );

    const usage = {};
    result.rows.forEach((row) => {
      usage[row.resource_type] = parseInt(row.total);
    });

    return {
      userId,
      period: 'last_30_days',
      usage,
    };
  }

  async logUsage(userId: string, resourceType: string, amount: number, metadata?: any) {
    await this.db.query(
      `INSERT INTO usage_ledger (user_id, resource_type, amount, metadata)
       VALUES ($1, $2, $3, $4)`,
      [userId, resourceType, amount, metadata || {}],
    );
  }
}
