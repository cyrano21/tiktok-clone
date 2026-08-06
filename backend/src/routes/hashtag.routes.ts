import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { optionalAuth } from '../middleware/auth';
import { prisma } from '../config/database';

export async function hashtagRoutes(app: FastifyInstance) {
  // Get hashtag detail
  app.get('/:name', { preHandler: optionalAuth }, async (req: FastifyRequest, reply: FastifyReply) => {
    const { name } = req.params as any;
    const hashtag = await prisma.hashtag.findUnique({
      where: { name },
      include: { _count: { select: { videos: true } } },
    });
    if (!hashtag) return reply.status(404).send({ error: 'NOT_FOUND', message: 'Hashtag not found' });
    return reply.send({ hashtag });
  });

  // Get videos by hashtag
  app.get('/:name/videos', { preHandler: optionalAuth }, async (req: FastifyRequest, reply: FastifyReply) => {
    const { name } = req.params as any;
    const { page = '1', limit = '20' } = req.query as any;
    const offset = (parseInt(page) - 1) * parseInt(limit);
    const videos = await prisma.video.findMany({
      where: { hashtags: { some: { hashtag: { name } } } },
      orderBy: { createdAt: 'desc' },
      skip: offset,
      take: parseInt(limit),
      include: {
        user: { select: { id: true, username: true, displayName: true, avatarUrl: true, isVerified: true } },
        _count: { select: { likes: true, comments: true } },
      },
    });
    return reply.send({ videos, page: parseInt(page), limit: parseInt(limit) });
  });

  // Trending hashtags
  app.get('/trending/list', { preHandler: optionalAuth }, async (req: FastifyRequest, reply: FastifyReply) => {
    const { limit = '20' } = req.query as any;
    const hashtags = await prisma.hashtag.findMany({
      orderBy: { videos: { _count: 'desc' } },
      take: parseInt(limit),
      include: { _count: { select: { videos: true } } },
    });
    return reply.send({ hashtags });
  });
}
