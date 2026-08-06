import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { authMiddleware } from '../middleware/auth';
import { prisma } from '../config/database';

const PLATFORMS = [
  {
    id: 'tiktok',
    name: 'TikTok',
    icon: '🎵',
    connected: false, // true when user has a TikTokAccount
  },
  { id: 'reels', name: 'Instagram Reels', icon: '📸', connected: false },
  { id: 'shorts', name: 'YouTube Shorts', icon: '▶️', connected: false },
];

export async function publishRoutes(app: FastifyInstance) {
  app.addHook('preHandler', authMiddleware);

  // Platform connection status (tiktok is real via TikTokAccount; others need setup)
  app.get('/platforms', async (req: FastifyRequest, reply: FastifyReply) => {
    const userId = (req as any).userId;
    const tiktok = await prisma.tikTokAccount.findUnique({ where: { userId } });
    return reply.send({
      platforms: PLATFORMS.map((p) =>
        p.id === 'tiktok' ? { ...p, connected: !!tiktok } : p
      ),
    });
  });

  // List the user's publish jobs
  app.get('/', async (req: FastifyRequest, reply: FastifyReply) => {
    const userId = (req as any).userId;
    const { page = '1', limit = '20' } = req.query as any;
    const jobs = await prisma.publishJob.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      skip: (parseInt(page) - 1) * parseInt(limit),
      take: parseInt(limit),
    });
    return reply.send({ jobs, page: parseInt(page), limit: parseInt(limit) });
  });

  // Schedule a cross-post
  app.post('/', async (req: FastifyRequest, reply: FastifyReply) => {
    const userId = (req as any).userId;
    const body = req.body as {
      videoId?: string;
      videoUrl?: string;
      caption?: string;
      platforms: string[];
      scheduledAt?: string;
    };
    if (!Array.isArray(body.platforms) || body.platforms.length === 0) {
      return reply.status(400).send({ error: 'BAD_REQUEST', message: 'platforms[] is required' });
    }
    if (!body.videoId && !body.videoUrl) {
      return reply.status(400).send({ error: 'BAD_REQUEST', message: 'videoId or videoUrl is required' });
    }

    const scheduledAt = body.scheduledAt ? new Date(body.scheduledAt) : new Date();
    if (isNaN(scheduledAt.getTime())) {
      return reply.status(400).send({ error: 'BAD_REQUEST', message: 'Invalid scheduledAt date' });
    }
    if (scheduledAt.getTime() < Date.now() - 60_000) {
      return reply.status(400).send({ error: 'BAD_REQUEST', message: 'scheduledAt cannot be in the past' });
    }

    const valid = new Set(PLATFORMS.map((p) => p.id));
    const platforms = body.platforms.filter((p) => valid.has(p));
    if (platforms.length === 0) {
      return reply.status(400).send({ error: 'BAD_REQUEST', message: 'No valid platforms provided' });
    }

    // Plan gating: cross-posting multi-platform is a PRO/BUSINESS feature.
    const user = await prisma.user.findUnique({ where: { id: userId }, select: { plan: true } });
    const plan = user?.plan ?? 'FREE';
    if (plan === 'FREE' && platforms.length > 1) {
      return reply.status(403).send({
        error: 'PLAN_LIMIT',
        message: 'Le plan Freemium permet 1 plateforme par publication. Passe au Pro (9,99€/mois) pour le cross-posting multi-plateformes.',
      });
    }

    const jobs = [];
    for (const platform of platforms) {
      jobs.push(
        await prisma.publishJob.create({
          data: {
            userId,
            videoId: body.videoId ?? null,
            videoUrl: body.videoUrl ?? null,
            caption: body.caption ?? null,
            platform,
            status: 'scheduled',
            scheduledAt,
          },
        })
      );
    }
    return reply.status(201).send({ jobs });
  });

  // Cancel a scheduled job
  app.post('/:id/cancel', async (req: FastifyRequest, reply: FastifyReply) => {
    const userId = (req as any).userId;
    const { id } = req.params as any;
    const job = await prisma.publishJob.findFirst({ where: { id, userId } });
    if (!job) return reply.status(404).send({ error: 'NOT_FOUND', message: 'Job not found' });
    if (job.status !== 'scheduled') {
      return reply.status(400).send({ error: 'BAD_REQUEST', message: 'Only scheduled jobs can be canceled' });
    }
    await prisma.publishJob.update({ where: { id }, data: { status: 'canceled' } });
    return reply.send({ message: 'Job canceled' });
  });
}
