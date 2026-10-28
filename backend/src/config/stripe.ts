import Stripe from 'stripe';
import { env } from './env';
import { ApiError } from '../utils/ApiError';

let client: Stripe | null = null;
export const stripeConfigured = () => Boolean(env.STRIPE_SECRET_KEY);
export function getStripe(): Stripe {
  if (!env.STRIPE_SECRET_KEY) {
    throw new ApiError(503, 'Payments are not configured yet. Set STRIPE_SECRET_KEY on the server.', 'STRIPE_NOT_CONFIGURED');
  }
  if (!client) client = new Stripe(env.STRIPE_SECRET_KEY);
  return client;
}
