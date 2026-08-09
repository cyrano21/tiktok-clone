import { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { authMiddleware, optionalAuth } from '../middleware/auth';
import { prisma } from '../config/database';

const createSchema = z.object({
  videoId: z.string().uuid(),
  orchidyCatalogItemId: z.string().trim().min(1).max(300),
  variantKey: z.string().trim().max(300).optional().default(''),
  confidence: z.number().min(0).max(1).optional().default(1),
  source: z.enum(['manual', 'matcher', 'import']).optional().default('manual'),
}).strict();

function activeUserWhere() {
  return {
    isBanned: false,
    OR: [{ suspendedUntil: null }, { suspendedUntil: { lte: new Date() } }],
  } as const;
}

export async function productMatchRoutes(app: FastifyInstance) {
  app.get('/video/:videoId', { preHandler: optionalAuth }, async (req: FastifyRequest, reply: FastifyReply) => {
    const { videoId } = z.object({ videoId: z.string().uuid() }).parse(req.params);
    const viewerId = (req as any).userId as string | undefined;
    const video = await prisma.video.findFirst({
      where: {
        id: videoId,
        OR: [{ visibility: 'public' }, ...(viewerId ? [{ userId: viewerId }] : [])],
        user: activeUserWhere(),
      },
      select: { id: true },
    });
    if (!video) return reply.status(404).send({ error: 'NOT_FOUND', message: 'Video not found' });

    const matches = await prisma.videoProductMatch.findMany({
      where: { videoId, status: 'active' },
      orderBy: [{ confidence: 'desc' }, { createdAt: 'asc' }],
      take: 5,
    });
    return reply.send({ matches });
  });

  app.post('/', { preHandler: authMiddleware }, async (req: FastifyRequest, reply: FastifyReply) => {
    const userId = (req as any).userId as string;
    const body = createSchema.parse(req.body);
    const video = await prisma.video.findUnique({
      where: { id: body.videoId },
      select: { id: true, userId: true },
    });
    if (!video) return reply.status(404).send({ error: 'NOT_FOUND', message: 'Video not found' });
    if (video.userId !== userId) {
      return reply.status(403).send({ error: 'FORBIDDEN', message: 'Only the video owner may attach products' });
    }

    const match = await prisma.videoProductMatch.upsert({
      where: {
        videoId_orchidyCatalogItemId_variantKey: {
          videoId: body.videoId,
          orchidyCatalogItemId: body.orchidyCatalogItemId,
          variantKey: body.variantKey,
        },
      },
      create: {
        videoId: body.videoId,
        orchidyCatalogItemId: body.orchidyCatalogItemId,
        variantKey: body.variantKey,
        confidence: body.confidence,
        source: body.source,
        status: 'active',
      },
      update: {
        confidence: body.confidence,
        source: body.source,
        status: 'active',
      },
    });
    return reply.status(201).send({ match });
  });

  app.delete('/:id', { preHandler: authMiddleware }, async (req: FastifyRequest, reply: FastifyReply) => {
    const userId = (req as any).userId as string;
    const { id } = z.object({ id: z.string().uuid() }).parse(req.params);
    const match = await prisma.videoProductMatch.findUnique({
      where: { id },
      include: { video: { select: { userId: true } } },
    });
    if (!match) return reply.status(404).send({ error: 'NOT_FOUND', message: 'Product match not found' });
    if (match.video.userId !== userId) {
      return reply.status(403).send({ error: 'FORBIDDEN', message: 'Only the video owner may remove products' });
    }
    await prisma.videoProductMatch.delete({ where: { id } });
    return reply.send({ deleted: true });
  });
}
