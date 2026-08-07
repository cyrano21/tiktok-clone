import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { authMiddleware } from '../middleware/auth';
import { prisma } from '../config/database';
import { getStripe, PaidPlanId, STRIPE_PRICE_IDS } from '../config/stripe';

export const PLANS = [
  {
    id: 'FREE',
    name: 'Freemium',
    priceCents: 0,
    priceLabel: '0€',
    features: [
      '50 vidéos publiées',
      'Analytics basiques (7 jours)',
      '1 plateforme connectée',
      'Marque "Powered by"',
    ],
  },
  {
    id: 'PRO',
    name: 'Pro',
    priceCents: 999,
    priceLabel: '9,99€/mois',
    features: [
      'Vidéos illimitées',
      'Analytics avancées + export',
      'Cross-posting TikTok · Reels · Shorts',
      'File de publication programmée',
      'Suppression de la marque',
    ],
  },
  {
    id: 'BUSINESS',
    name: 'Business',
    priceCents: 2999,
    priceLabel: '29,99€/mois',
    features: [
      'Tout le plan Pro',
      'Multi-comptes (10 membres)',
      'Modération & approbation d’équipe',
      'API + webhooks',
      'Support prioritaire 24/7',
    ],
  },
] as const;

const checkoutSchema = z.object({ plan: z.enum(['PRO', 'BUSINESS']) }).strict();

function appUrl(path: string) {
  const base = (process.env.APP_URL || 'http://localhost:3000').replace(/\/$/, '');
  return `${base}${path.startsWith('/') ? path : `/${path}`}`;
}

async function getOrCreateCustomer(userId: string) {
  const stripe = getStripe();
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, email: true, username: true, displayName: true },
  });
  if (!user) {
    const error = new Error('User not found');
    (error as any).statusCode = 404;
    throw error;
  }

  // userId is an internal UUID, therefore safe to use in Stripe's metadata search query.
  const existing = await stripe.customers.search({
    query: `metadata['userId']:'${userId}'`,
    limit: 1,
  });
  if (existing.data[0]) return existing.data[0];

  return stripe.customers.create({
    email: user.email ?? undefined,
    name: user.displayName || user.username,
    metadata: { userId },
  });
}

async function findActiveStripeSubscription(userId: string) {
  const stripe = getStripe();
  const customer = await getOrCreateCustomer(userId);
  const subscriptions = await stripe.subscriptions.list({
    customer: customer.id,
    status: 'all',
    limit: 20,
  });
  const active = subscriptions.data.find((subscription) =>
    ['active', 'trialing', 'past_due', 'incomplete'].includes(subscription.status),
  );
  return { stripe, customer, subscription: active ?? null };
}

export async function billingRoutes(app: FastifyInstance) {
  app.get('/plans', async (_req: FastifyRequest, reply: FastifyReply) => {
    return reply.send({ plans: PLANS });
  });

  app.get('/current', { preHandler: authMiddleware }, async (req: FastifyRequest, reply: FastifyReply) => {
    const userId = (req as any).userId as string;
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { plan: true, subscription: true },
    });
    return reply.send({
      plan: user?.plan ?? 'FREE',
      subscription: user?.subscription ?? null,
    });
  });

  app.post('/checkout', { preHandler: authMiddleware }, async (req: FastifyRequest, reply: FastifyReply) => {
    const userId = (req as any).userId as string;
    const { plan } = checkoutSchema.parse(req.body ?? {}) as { plan: PaidPlanId };

    const { stripe, customer, subscription } = await findActiveStripeSubscription(userId);
    if (subscription) {
      return reply.status(409).send({
        error: 'SUBSCRIPTION_EXISTS',
        message: 'An active Stripe subscription already exists. Use the billing portal to change it.',
      });
    }

    const successUrl = process.env.STRIPE_SUCCESS_URL || appUrl('/studio/billing?checkout=success');
    const cancelUrl = process.env.STRIPE_CANCEL_URL || appUrl('/studio/billing?checkout=cancelled');

    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      customer: customer.id,
      client_reference_id: userId,
      line_items: [{ price: STRIPE_PRICE_IDS[plan], quantity: 1 }],
      allow_promotion_codes: true,
      success_url: successUrl.includes('{CHECKOUT_SESSION_ID}')
        ? successUrl
        : `${successUrl}${successUrl.includes('?') ? '&' : '?'}session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: cancelUrl,
      metadata: { userId, plan },
      subscription_data: { metadata: { userId, plan } },
    });

    if (!session.url) {
      return reply.status(502).send({ error: 'STRIPE_CHECKOUT_ERROR', message: 'Stripe did not return a Checkout URL' });
    }
    return reply.send({ url: session.url, sessionId: session.id });
  });

  app.post('/portal', { preHandler: authMiddleware }, async (req: FastifyRequest, reply: FastifyReply) => {
    const userId = (req as any).userId as string;
    const stripe = getStripe();
    const customer = await getOrCreateCustomer(userId);
    const returnUrl = process.env.STRIPE_PORTAL_RETURN_URL || appUrl('/studio/billing');
    const session = await stripe.billingPortal.sessions.create({ customer: customer.id, return_url: returnUrl });
    return reply.send({ url: session.url });
  });

  app.post('/cancel', { preHandler: authMiddleware }, async (req: FastifyRequest, reply: FastifyReply) => {
    const userId = (req as any).userId as string;
    const { stripe, subscription } = await findActiveStripeSubscription(userId);
    if (!subscription) {
      return reply.status(400).send({ error: 'BAD_REQUEST', message: 'No active Stripe subscription' });
    }
    const updated = await stripe.subscriptions.update(subscription.id, { cancel_at_period_end: true });
    return reply.send({
      message: 'Subscription will cancel at the end of the current billing period.',
      cancelAtPeriodEnd: updated.cancel_at_period_end,
    });
  });
}
