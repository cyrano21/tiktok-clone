import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { authMiddleware } from '../middleware/auth';
import { capabilitiesFromScopes } from '../config/tiktok';
import { getSummary } from '../services/tiktokAccount.repository';
import { prisma } from '../config/database';

export async function publishRoutes(app: FastifyInstance) {
  app.addHook('preHandler', authMiddleware);

  // This endpoint now reports actual delivery capability, not planned product scope.
  app.get('/platforms', async (req: FastifyRequest, reply: FastifyReply) => {
    const userId = (req as any).userId as string;
    const tiktok = await getSummary(userId);
    const capabilities = capabilitiesFromScopes(tiktok?.scope ?? '');
    return reply.send({
      platforms: [
        {
          id: 'tiktok',
          name: 'TikTok',
          icon: '🎵',
          connected: Boolean(tiktok),
          available: Boolean(tiktok && (capabilities.canPublish || capabilities.canUploadDraft)),
          capability: tiktok && (capabilities.canPublish || capabilities.canUploadDraft) ? 'direct_post' : 'connection_only',
          message: !tiktok
            ? 'Connectez TikTok.'
            : capabilities.canPublish || capabilities.canUploadDraft
              ? 'La publication immédiate passe par l’API officielle TikTok.'
              : 'Le compte est connecté en lecture, mais les scopes Content Posting ne sont pas approuvés.',
        },
        {
          id: 'reels',
          name: 'Instagram Reels',
          icon: '📸',
          connected: false,
          available: false,
          capability: 'unavailable',
          message: 'Connecteur de publication non implémenté.',
        },
        {
          id: 'shorts',
          name: 'YouTube Shorts',
          icon: '▶️',
          connected: false,
          available: false,
          capability: 'unavailable',
          message: 'Connecteur de publication non implémenté.',
        },
      ],
    });
  });

  // Historical jobs remain visible so old records are not lost. New fake
  // scheduling is disabled until a delivery worker exists.
  app.get('/', async (req: FastifyRequest, reply: FastifyReply) => {
    const userId = (req as any).userId as string;
    const query = req.query as { page?: string; limit?: string };
    const page = Math.max(1, Number.parseInt(query.page || '1', 10) || 1);
    const limit = Math.min(100, Math.max(1, Number.parseInt(query.limit || '20', 10) || 20));
    const jobs = await prisma.publishJob.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
    });
    return reply.send({ jobs, page, limit, schedulingAvailable: false });
  });

  app.post('/', async (_req: FastifyRequest, reply: FastifyReply) => {
    return reply.status(501).send({
      error: 'PUBLISH_WORKER_NOT_AVAILABLE',
      message: 'La publication programmée multi-plateformes n’est pas encore disponible. Aucun job fictif n’a été créé.',
      availableAlternative: '/v1/tiktok/publish',
    });
  });

  app.post('/:id/cancel', async (req: FastifyRequest, reply: FastifyReply) => {
    const userId = (req as any).userId as string;
    const { id } = req.params as { id: string };
    const job = await prisma.publishJob.findFirst({ where: { id, userId } });
    if (!job) return reply.status(404).send({ error: 'NOT_FOUND', message: 'Job not found' });
    if (job.status !== 'scheduled') {
      return reply.status(400).send({ error: 'BAD_REQUEST', message: 'Only scheduled jobs can be canceled' });
    }
    await prisma.publishJob.update({ where: { id }, data: { status: 'canceled' } });
    return reply.send({ message: 'Job canceled' });
  });
}
