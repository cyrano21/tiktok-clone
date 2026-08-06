import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { authMiddleware, optionalAuth } from '../middleware/auth';
import { prisma } from '../config/database';
import { NotificationService } from '../services/notification.service';

export async function userRoutes(app: FastifyInstance) {
  // Get user profile
  app.get('/:username', { preHandler: optionalAuth }, async (req: FastifyRequest, reply: FastifyReply) => {
    const { username } = req.params as any;
    const user = await prisma.user.findUnique({
      where: { username },
      select: {
        id: true,
        username: true,
        displayName: true,
        avatarUrl: true,
        bio: true,
        isVerified: true,
        createdAt: true,
        _count: { select: { followers: true, following: true, videos: true } },
      },
    });
    if (!user) return reply.status(404).send({ error: 'NOT_FOUND', message: 'User not found' });
    return reply.send({ user });
  });

  // Get user videos
  app.get('/:username/videos', { preHandler: optionalAuth }, async (req: FastifyRequest, reply: FastifyReply) => {
    const { username } = req.params as any;
    const { page = '1', limit = '20' } = req.query as any;
    const offset = (parseInt(page) - 1) * parseInt(limit);
    const user = await prisma.user.findUnique({ where: { username } });
    if (!user) return reply.status(404).send({ error: 'NOT_FOUND', message: 'User not found' });
    const videos = await prisma.video.findMany({
      where: { userId: user.id, visibility: 'public' },
      orderBy: { createdAt: 'desc' },
      skip: offset,
      take: parseInt(limit),
      include: { _count: { select: { likes: true, comments: true } } },
    });
    return reply.send({ videos, page: parseInt(page), limit: parseInt(limit) });
  });

  // Follow user
  app.post('/:id/follow', { preHandler: authMiddleware }, async (req: FastifyRequest, reply: FastifyReply) => {
    const { id } = req.params as any;
    const userId = (req as any).userId;
    if (id === userId) return reply.status(400).send({ error: 'BAD_REQUEST', message: 'Cannot follow yourself' });
    const existing = await prisma.follow.findUnique({ where: { followerId_followingId: { followerId: userId, followingId: id } } });
    if (existing) {
      await prisma.follow.delete({ where: { id: existing.id } });
      return reply.send({ following: false });
    }
    await prisma.follow.create({ data: { followerId: userId, followingId: id } });
    await NotificationService.notifyFollow(id, userId);
    return reply.send({ following: true });
  });

  // Unfollow user
  app.delete('/:id/follow', { preHandler: authMiddleware }, async (req: FastifyRequest, reply: FastifyReply) => {
    const { id } = req.params as any;
    const userId = (req as any).userId;
    await prisma.follow.deleteMany({ where: { followerId: userId, followingId: id } });
    return reply.send({ following: false });
  });

  // Get suggested users
  app.get('/suggestions/list', { preHandler: authMiddleware }, async (req: FastifyRequest, reply: FastifyReply) => {
    const userId = (req as any).userId;
    const { limit = '10' } = req.query as any;
    const users = await prisma.user.findMany({
      where: {
        id: { not: userId },
        followers: { none: { followerId: userId } },
      },
      orderBy: { followers: { _count: 'desc' } },
      take: parseInt(limit),
      select: {
        id: true,
        username: true,
        displayName: true,
        avatarUrl: true,
        isVerified: true,
        _count: { select: { followers: true } },
      },
    });
    return reply.send({ users });
  });
}
