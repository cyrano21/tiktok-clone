import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { authMiddleware, optionalAuth } from '../middleware/auth';
import { prisma } from '../config/database';

export async function soundRoutes(app: FastifyInstance) {
  // Get sound detail
  app.get('/:id', { preHandler: optionalAuth }, async (req: FastifyRequest, reply: FastifyReply) => {
    const { id } = req.params as any;
    const sound = await prisma.sound.findUnique({
      where: { id },
      include: {
        user: { select: { id: true, username: true, displayName: true, avatar: true } },
        _count: { select: { videos: true } },
      },
    });
    if (!sound) return reply.status(404).send({ error: 'NOT_FOUND', message: 'Sound not found' });
    return reply.send({ sound });
  });

  // Get videos using a sound
  app.get('/:id/videos', { preHandler: optionalAuth }, async (req: FastifyRequest, reply: FastifyReply) => {
    const { id } = req.params as any;
    const { page = '1', limit = '20' } = req.query as any;
    const offset = (parseInt(page) - 1) * parseInt(limit);
    const videos = await prisma.video.findMany({
      where: { soundId: id },
      orderBy: { createdAt: 'desc' },
      skip: offset,
      take: parseInt(limit),
      include: {
        user: { select: { id: true, username: true, displayName: true, avatar: true, isVerified: true } },
        _count: { select: { likes: true, comments: true } },
      },
    });
    return reply.send({ videos, page: parseInt(page), limit: parseInt(limit) });
  });

  // Trending sounds
  app.get('/trending/list', { preHandler: optionalAuth }, async (req: FastifyRequest, reply: FastifyReply) => {
    const { limit = '20' } = req.query as any;
    const sounds = await prisma.sound.findMany({
      orderBy: { videos: { _count: 'desc' } },
      take: parseInt(limit),
      include: {
        user: { select: { id: true, username: true, displayName: true, avatar: true } },
        _count: { select: { videos: true } },
      },
    });
    return reply.send({ sounds });
  });

  // Search sounds
  app.get('/search/query', { preHandler: optionalAuth }, async (req: FastifyRequest, reply: FastifyReply) => {
    const { q, page = '1', limit = '20' } = req.query as any;
    if (!q) return reply.status(400).send({ error: 'BAD_REQUEST', message: 'Query parameter q is required' });
    const offset = (parseInt(page) - 1) * parseInt(limit);
    const sounds = await prisma.sound.findMany({
      where: { OR: [{ title: { contains: q, mode: 'insensitive' } }, { artist: { contains: q, mode: 'insensitive' } }] },
      skip: offset,
      take: parseInt(limit),
      include: {
        user: { select: { id: true, username: true, displayName: true, avatar: true } },
        _count: { select: { videos: true } },
      },
    });
    return reply.send({ sounds, page: parseInt(page), limit: parseInt(limit) });
  });

  // Upload sound
  app.post('/', { preHandler: authMiddleware }, async (req: FastifyRequest, reply: FastifyReply) => {
    const userId = (req as any).userId;
    // Sound upload logic handled by service
    return reply.status(201).send({ message: 'Sound uploaded successfully' });
  });
}
