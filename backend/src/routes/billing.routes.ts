import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { authMiddleware } from '../middleware/auth';
import { prisma } from '../config/database';

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
];

export async function billingRoutes(app: FastifyInstance) {
  app.addHook('preHandler', authMiddleware);

  // List available plans
  app.get('/plans', async (_req: FastifyRequest, reply: FastifyReply) => {
    return reply.send({ plans: PLANS });
  });

  // Current subscription for the authenticated user
  app.get('/current', async (req: FastifyRequest, reply: FastifyReply) => {
    const userId = (req as any).userId;
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { plan: true, subscription: true },
    });
    return reply.send({
      plan: user?.plan ?? 'FREE',
      subscription: user?.subscription ?? null,
    });
  });

  // Subscribe / upgrade to a plan (mock payment — swap with Stripe checkout when keys exist)
  app.post('/subscribe', async (req: FastifyRequest, reply: FastifyReply) => {
    const userId = (req as any).userId;
    const { plan } = req.body as { plan?: string };
    if (!plan || !PLANS.some((p) => p.id === plan)) {
      return reply.status(400).send({ error: 'BAD_REQUEST', message: 'Invalid plan' });
    }
    const selected = PLANS.find((p) => p.id === plan)!;

    const now = new Date();
    const renewsAt = selected.priceCents > 0 ? new Date(now.getTime() + 30 * 86_400_000) : null;

    const subscription = await prisma.subscription.upsert({
      where: { userId },
      create: {
        userId,
        plan: selected.id,
        status: 'active',
        priceCents: selected.priceCents,
        startedAt: now,
        renewsAt,
      },
      update: {
        plan: selected.id,
        status: 'active',
        priceCents: selected.priceCents,
        startedAt: now,
        renewsAt,
        canceledAt: null,
      },
    });
    await prisma.user.update({ where: { id: userId }, data: { plan: selected.id } });

    return reply.send({ subscription, plan: selected.id, message: `Subscribed to ${selected.name}` });
  });

  // Cancel subscription (downgrade to FREE at end of period)
  app.post('/cancel', async (req: FastifyRequest, reply: FastifyReply) => {
    const userId = (req as any).userId;
    const sub = await prisma.subscription.findUnique({ where: { userId } });
    if (!sub) {
      return reply.status(400).send({ error: 'BAD_REQUEST', message: 'No active subscription' });
    }
    await prisma.subscription.update({
      where: { userId },
      data: { status: 'canceled', canceledAt: new Date() },
    });
    return reply.send({ message: 'Subscription canceled. Plan stays active until period end.' });
  });
}
