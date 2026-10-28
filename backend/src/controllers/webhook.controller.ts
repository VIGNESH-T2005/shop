import { Request, Response } from 'express';
import { env } from '../config/env';
import { getStripe } from '../config/stripe';
import { handleStripeEvent } from '../services/order.service';
import { logger } from '../utils/logger';

/** Mounted with express.raw() so the signature can be verified against the exact bytes Stripe sent. */
export async function stripeWebhook(req: Request, res: Response) {
  if (!env.STRIPE_WEBHOOK_SECRET) {
    logger.error('STRIPE_WEBHOOK_SECRET is not set; webhook rejected.');
    return res.status(503).json({ success: false, error: { code: 'WEBHOOK_NOT_CONFIGURED', message: 'Webhook secret missing.' } });
  }
  let event;
  try {
    event = getStripe().webhooks.constructEvent(req.body, req.headers['stripe-signature'] as string, env.STRIPE_WEBHOOK_SECRET);
  } catch {
    return res.status(400).json({ success: false, error: { code: 'BAD_SIGNATURE', message: 'Webhook signature verification failed.' } });
  }
  try {
    const result = await handleStripeEvent(event);
    return res.json({ received: true, result });
  } catch (e) {
    logger.error(`Webhook ${event.type} failed:`, (e as Error).message);
    return res.status(500).json({ received: false }); // Stripe will retry; handlers are idempotent
  }
}
