import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import Stripe from 'stripe';
import { prisma } from '../config/database';
import { getStripe, getStripeWebhookSecret, planFromPriceId } from '../config/stripe';

const ACTIVE_ENTITLEMENT_STATUSES = new Set(['active', 'trialing', 'past_due']);

function unixToDate(value: number | null | undefined) {
  return typeof value === 'number' ? new Date(value * 1000) : null;
}

async function syncSubscription(subscription: Stripe.Subscription) {
  const userId = subscription.metadata?.userId;
  if (!userId) return;

  const priceId = subscription.items.data[0]?.price?.id;
  const plan = (subscription.metadata?.plan === 'PRO' || subscription.metadata?.plan === 'BUSINESS')
    ? subscription.metadata.plan
    : planFromPriceId(priceId);
  if (!plan) return;

  const entitled = ACTIVE_ENTITLEMENT_STATUSES.has(subscription.status);
  const periodEnd = unixToDate((subscription as any).current_period_end);
  const canceledAt = unixToDate((subscription as any).canceled_at);
  const priceCents = plan === 'PRO' ? 999 : 2999;

  await prisma.$transaction([
    prisma.subscription.upsert({
      where: { userId },
      create: {
        userId,
        plan,
        status: subscription.status,
        priceCents,
        startedAt: unixToDate((subscription as any).start_date) ?? new Date(),
        renewsAt: periodEnd,
        canceledAt,
      },
      update: {
        plan,
        status: subscription.status,
        priceCents,
        renewsAt: periodEnd,
        canceledAt,
      },
    }),
    prisma.user.update({
      where: { id: userId },
      data: { plan: entitled ? plan : 'FREE' },
    }),
  ]);
}

async function handleStripeEvent(event: Stripe.Event) {
  switch (event.type) {
    case 'customer.subscription.created':
    case 'customer.subscription.updated':
    case 'customer.subscription.deleted':
      await syncSubscription(event.data.object as Stripe.Subscription);
      break;
    case 'checkout.session.completed': {
      const session = event.data.object as Stripe.Checkout.Session;
      // No entitlement is granted from Checkout alone. Subscription webhooks are canonical.
      if (!session.client_reference_id && session.metadata?.userId) {
        // Kept intentionally as a no-op validation point for observability.
      }
      break;
    }
    default:
      break;
  }
}

export async function stripeWebhookRoutes(app: FastifyInstance) {
  // Stripe signature verification requires the exact raw request bytes. This parser
  // is encapsulated inside this plugin and therefore does not affect the rest of the API.
  app.removeContentTypeParser('application/json');
  app.addContentTypeParser('application/json', { parseAs: 'buffer' }, (_req, body, done) => {
    done(null, body);
  });

  app.post('/webhook', async (req: FastifyRequest, reply: FastifyReply) => {
    const signature = req.headers['stripe-signature'];
    if (!signature || Array.isArray(signature)) {
      return reply.status(400).send({ error: 'BAD_REQUEST', message: 'Missing Stripe signature' });
    }
    if (!Buffer.isBuffer(req.body)) {
      return reply.status(400).send({ error: 'BAD_REQUEST', message: 'Stripe webhook body must be raw bytes' });
    }

    let event: Stripe.Event;
    try {
      event = getStripe().webhooks.constructEvent(req.body, signature, getStripeWebhookSecret());
    } catch (error: any) {
      req.log.warn({ err: error }, 'Rejected invalid Stripe webhook');
      return reply.status(400).send({ error: 'INVALID_SIGNATURE', message: 'Invalid Stripe webhook signature' });
    }

    await handleStripeEvent(event);
    return reply.send({ received: true });
  });
}
