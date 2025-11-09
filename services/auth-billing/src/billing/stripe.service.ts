import { Injectable } from '@nestjs/common';
import Stripe from 'stripe';
import { DatabaseService } from '../database/database.service';

@Injectable()
export class StripeService {
  private stripe: Stripe;
  private webhookSecret: string;

  constructor(private readonly db: DatabaseService) {
    this.stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '', {
      apiVersion: '2023-10-16',
    });
    this.webhookSecret = process.env.STRIPE_WEBHOOK_SECRET || '';
  }

  async createCustomer(email: string, metadata?: any): Promise<Stripe.Customer> {
    return this.stripe.customers.create({
      email,
      metadata,
    });
  }

  async createCheckoutSession(
    customerId: string,
    tier: 'basic' | 'pro',
    userId: string,
  ): Promise<Stripe.Checkout.Session> {
    const priceId = tier === 'basic'
      ? process.env.STRIPE_BASIC_PRICE_ID
      : process.env.STRIPE_PRO_PRICE_ID;

    if (!priceId) {
      throw new Error(`Stripe price ID not configured for tier: ${tier}`);
    }

    return this.stripe.checkout.sessions.create({
      customer: customerId,
      mode: 'subscription',
      payment_method_types: ['card'],
      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],
      success_url: `${process.env.FRONTEND_URL || 'http://localhost:5000'}/billing/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${process.env.FRONTEND_URL || 'http://localhost:5000'}/billing/cancel`,
      metadata: {
        user_id: userId,
        tier,
      },
    });
  }

  async createPortalSession(customerId: string): Promise<Stripe.BillingPortal.Session> {
    return this.stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: `${process.env.FRONTEND_URL || 'http://localhost:5000'}/billing`,
    });
  }

  async handleWebhook(signature: string, rawBody: Buffer) {
    try {
      const event = this.stripe.webhooks.constructEvent(
        rawBody,
        signature,
        this.webhookSecret,
      );

      switch (event.type) {
        case 'checkout.session.completed':
          await this.handleCheckoutComplete(event.data.object as Stripe.Checkout.Session);
          break;
        
        case 'customer.subscription.updated':
        case 'customer.subscription.created':
          await this.handleSubscriptionUpdate(event.data.object as Stripe.Subscription);
          break;
        
        case 'customer.subscription.deleted':
          await this.handleSubscriptionDelete(event.data.object as Stripe.Subscription);
          break;
        
        case 'invoice.payment_failed':
          await this.handlePaymentFailed(event.data.object as Stripe.Invoice);
          break;
        
        default:
          console.log(`Unhandled event type: ${event.type}`);
      }

      return { received: true };
    } catch (error) {
      console.error('Webhook error:', error.message);
      throw error;
    }
  }

  private async handleCheckoutComplete(session: Stripe.Checkout.Session) {
    const userId = session.metadata?.user_id;
    const tier = session.metadata?.tier;
    
    if (!userId || !tier) {
      console.error('Missing metadata in checkout session');
      return;
    }

    if (!session.subscription) {
      console.error('No subscription in checkout session');
      return;
    }

    const subscription = await this.stripe.subscriptions.retrieve(
      session.subscription as string,
    );

    await this.db.query(
      `INSERT INTO subscriptions (user_id, stripe_subscription_id, stripe_customer_id, status, tier, current_period_start, current_period_end)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       ON CONFLICT (user_id) DO UPDATE
       SET stripe_subscription_id = EXCLUDED.stripe_subscription_id,
           stripe_customer_id = EXCLUDED.stripe_customer_id,
           status = EXCLUDED.status,
           tier = EXCLUDED.tier,
           current_period_start = EXCLUDED.current_period_start,
           current_period_end = EXCLUDED.current_period_end,
           updated_at = NOW()`,
      [
        userId,
        subscription.id,
        session.customer,
        subscription.status,
        tier,
        new Date(subscription.current_period_start * 1000),
        new Date(subscription.current_period_end * 1000),
      ],
    );

    await this.db.query(
      `UPDATE users SET subscription_tier = $1 WHERE id = $2`,
      [tier, userId],
    );

    console.log(`Subscription created for user ${userId}: ${tier}`);
  }

  private async handleSubscriptionUpdate(subscription: Stripe.Subscription) {
    const userResult = await this.db.query(
      'SELECT user_id FROM subscriptions WHERE stripe_subscription_id = $1',
      [subscription.id],
    );

    if (userResult.rows.length === 0) {
      console.error(`Subscription not found: ${subscription.id}`);
      return;
    }

    const userId = userResult.rows[0].user_id;

    await this.db.query(
      `UPDATE subscriptions
       SET status = $1, current_period_start = $2, current_period_end = $3, updated_at = NOW()
       WHERE stripe_subscription_id = $4`,
      [
        subscription.status,
        new Date(subscription.current_period_start * 1000),
        new Date(subscription.current_period_end * 1000),
        subscription.id,
      ],
    );

    console.log(`Subscription updated: ${subscription.id}`);
  }

  private async handleSubscriptionDelete(subscription: Stripe.Subscription) {
    const userResult = await this.db.query(
      'SELECT user_id FROM subscriptions WHERE stripe_subscription_id = $1',
      [subscription.id],
    );

    if (userResult.rows.length === 0) {
      return;
    }

    const userId = userResult.rows[0].user_id;

    await this.db.query(
      `UPDATE subscriptions SET status = $1, updated_at = NOW() WHERE stripe_subscription_id = $2`,
      ['canceled', subscription.id],
    );

    await this.db.query(
      `UPDATE users SET subscription_tier = $1 WHERE id = $2`,
      ['free_trial', userId],
    );

    console.log(`Subscription canceled for user ${userId}`);
  }

  private async handlePaymentFailed(invoice: Stripe.Invoice) {
    console.error(`Payment failed for subscription: ${invoice.subscription}`);
  }
}
