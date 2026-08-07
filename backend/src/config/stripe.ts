import Stripe from 'stripe';

let stripeClient: Stripe | null = null;

export const STRIPE_PRICE_IDS = {
  PRO: process.env.STRIPE_PRICE_PRO || 'price_1U1mDNAh4XCbPrbnMiEUNHFJ',
  BUSINESS: process.env.STRIPE_PRICE_BUSINESS || 'price_1U1mDXAh4XCbPrbnJbQxIXPt',
} as const;

export type PaidPlanId = keyof typeof STRIPE_PRICE_IDS;

export function getStripe(): Stripe {
  const secretKey = process.env.STRIPE_SECRET_KEY;
  if (!secretKey) {
    const error = new Error('Stripe is not configured: STRIPE_SECRET_KEY is missing');
    (error as any).statusCode = 503;
    throw error;
  }
  if (!stripeClient) stripeClient = new Stripe(secretKey);
  return stripeClient;
}

export function getStripeWebhookSecret(): string {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) {
    const error = new Error('Stripe webhook is not configured: STRIPE_WEBHOOK_SECRET is missing');
    (error as any).statusCode = 503;
    throw error;
  }
  return secret;
}

export function planFromPriceId(priceId: string | null | undefined): PaidPlanId | null {
  if (!priceId) return null;
  if (priceId === STRIPE_PRICE_IDS.PRO) return 'PRO';
  if (priceId === STRIPE_PRICE_IDS.BUSINESS) return 'BUSINESS';
  return null;
}
