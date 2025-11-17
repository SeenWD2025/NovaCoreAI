import { Injectable } from '@nestjs/common';
import Stripe from 'stripe';
import { DatabaseService } from '../database/database.service';
import { EmailService } from '../email/email.service';

@Injectable()
export class StripeService {
  private stripe: Stripe;
  private webhookSecret: string;

  constructor(
    private readonly db: DatabaseService,
    private readonly emailService: EmailService,
  ) {
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
    // Verify webhook secret is configured
    if (!this.webhookSecret) {
      console.error('STRIPE_WEBHOOK_SECRET is not configured');
      throw new Error('Webhook secret not configured');
    }

    if (!signature) {
      console.error('Missing stripe-signature header');
      throw new Error('Missing stripe-signature header');
    }

    try {
      // Verify signature and construct event
      // This will throw an error if the signature is invalid
      const event = this.stripe.webhooks.constructEvent(
        rawBody,
        signature,
        this.webhookSecret,
      );

      console.log(`✅ Webhook verified: ${event.type} (ID: ${event.id})`);

      // Handle the event based on type
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
        
        case 'invoice.payment_succeeded':
          await this.handlePaymentSuccess(event.data.object as Stripe.Invoice);
          break;
        
        case 'invoice.payment_failed':
          await this.handlePaymentFailed(event.data.object as Stripe.Invoice);
          break;
        
        default:
          console.log(`ℹ️  Unhandled event type: ${event.type}`);
      }

      return { received: true, eventType: event.type };
    } catch (error) {
      // Log detailed error information
      if (error.message.includes('No signatures found')) {
        console.error('❌ Webhook signature verification failed: Invalid signature');
      } else if (error.message.includes('timestamp is too old')) {
        console.error('❌ Webhook signature verification failed: Timestamp too old (replay attack?)');
      } else {
        console.error('❌ Webhook error:', error.message);
      }
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
    
    const userResult = await this.db.query(
      'SELECT email FROM users WHERE id = $1',
      [userId],
    );
    
    if (userResult.rows.length > 0) {
      const userEmail = userResult.rows[0].email;
      await this.emailService.sendSubscriptionConfirmationEmail(userEmail, tier);
      console.log(`Subscription confirmation email sent to ${userEmail}`);
    }
  }

  private async handleSubscriptionUpdate(subscription: Stripe.Subscription) {
    const userResult = await this.db.query(
      'SELECT user_id, tier FROM subscriptions WHERE stripe_subscription_id = $1',
      [subscription.id],
    );

    if (userResult.rows.length === 0) {
      console.error(`Subscription not found: ${subscription.id}`);
      return;
    }

    const userId = userResult.rows[0].user_id;
    let tier = userResult.rows[0].tier;

    // If subscription has items, try to determine tier from price ID
    if (subscription.items && subscription.items.data.length > 0) {
      const priceId = subscription.items.data[0].price.id;
      const newTier = this.mapPriceIdToTier(priceId);
      if (newTier !== 'free_trial' && newTier !== tier) {
        tier = newTier;
        // Update tier in users table if it changed
        await this.db.query(
          `UPDATE users SET subscription_tier = $1 WHERE id = $2`,
          [tier, userId],
        );
        console.log(`Subscription tier changed to ${tier} for user ${userId}`);
      }
    }

    await this.db.query(
      `UPDATE subscriptions
       SET status = $1, tier = $2, current_period_start = $3, current_period_end = $4, updated_at = NOW()
       WHERE stripe_subscription_id = $5`,
      [
        subscription.status,
        tier,
        new Date(subscription.current_period_start * 1000),
        new Date(subscription.current_period_end * 1000),
        subscription.id,
      ],
    );

    console.log(`✅ Subscription updated: ${subscription.id} (${tier})`);
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
    
    const userResult = await this.db.query(
      'SELECT email FROM users WHERE id = $1',
      [userId],
    );
    
    if (userResult.rows.length > 0) {
      const userEmail = userResult.rows[0].email;
      await this.emailService.sendSubscriptionCancellationEmail(userEmail);
      console.log(`Subscription cancellation email sent to ${userEmail}`);
    }
  }

  private async handlePaymentSuccess(invoice: Stripe.Invoice) {
    console.log(`💰 Payment succeeded for subscription: ${invoice.subscription}`);
    
    // Log successful payment to database for record-keeping
    if (invoice.subscription) {
      const userResult = await this.db.query(
        'SELECT user_id FROM subscriptions WHERE stripe_subscription_id = $1',
        [invoice.subscription],
      );

      if (userResult.rows.length > 0) {
        const userId = userResult.rows[0].user_id;
        console.log(`Payment recorded for user ${userId}: $${(invoice.amount_paid / 100).toFixed(2)}`);
      }
    }
  }

  private async handlePaymentFailed(invoice: Stripe.Invoice) {
    console.error(`❌ Payment failed for subscription: ${invoice.subscription}`);
    
    if (invoice.subscription) {
      const userResult = await this.db.query(
        'SELECT user_id FROM subscriptions WHERE stripe_subscription_id = $1',
        [invoice.subscription],
      );

      if (userResult.rows.length > 0) {
        const userId = userResult.rows[0].user_id;
        const amount = invoice.amount_due / 100;
        console.error(`Payment failure for user ${userId} - amount: $${amount.toFixed(2)}`);
        
        const emailResult = await this.db.query(
          'SELECT email FROM users WHERE id = $1',
          [userId],
        );
        
        if (emailResult.rows.length > 0) {
          const userEmail = emailResult.rows[0].email;
          await this.emailService.sendPaymentFailureEmail(userEmail, amount);
          console.log(`Payment failure notification sent to ${userEmail}`);
        }
      }
    }
  }

  /**
   * Map Stripe price ID to subscription tier
   * This is used when we need to determine tier from Stripe data
   */
  private mapPriceIdToTier(priceId: string): string {
    if (priceId === process.env.STRIPE_BASIC_PRICE_ID) {
      return 'basic';
    } else if (priceId === process.env.STRIPE_PRO_PRICE_ID) {
      return 'pro';
    }
    return 'free_trial';
  }
}
