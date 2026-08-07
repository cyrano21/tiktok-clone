import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { authMiddleware, optionalAuth } from '../middleware/auth';
import { prisma } from '../config/database';
import { NotificationService } from '../services/notification.service';

async function blockedBetween(userId: string | undefined, otherUserId: string) {
  if (!userId || userId === otherUserId) return false;
  return Boolean(await prisma.userBlock.findFirst({
    where: {
      OR: [
        { blockerId: userId, blockedId: otherUserId },
        { blockerId: otherUserId, blockedId: userId },
      ],
    },
    select: { id: true },
  }));
}

const publicUserSelect = {
  id: true,
  username: true,
  displayName: true,
  avatarUrl: true,
  isVerified: true,
} as const;

export async function userRoutes(app: FastifyInstance) {
  app.get('/:username', { preHandler: optionalAuth }, async (req: FastifyRequest, reply: FastifyReply) => {
    const { username } = z.object({ username: z.string().trim().min(1).max(64) }).parse(req.params);
    const viewerId = (req as any).userId as string | undefined;
    const user = await prisma.user.findFirst({
      where: {
        username,
        isBanned: false,
        OR: [{ suspendedUntil: null }, { suspendedUntil: { lte: new Date() } }],
      },
      select: {
        id: true,
        username: true,
        displayName: true,
        avatarUrl: true,
        bio: true,
        isVerified: true,
        isPrivate: true,
        likeCount: true,
        createdAt: true,
        _count: { select: { followers: true, following: true, videos: true } },
      },
    });
    if (!user || await blockedBetween(viewerId, user.id)) {
      return reply.status(404).send({ error: 'NOT_FOUND', message: 'User not found' });
    }
    const receivedLikes = await prisma.video.aggregate({
      where: { userId: user.id },
      _sum: { likeCount: true },
    });
    return reply.send({ user: { ...user, likeCount: receivedLikes._sum.likeCount ?? 0 } });
  });

  app.get('/:username/likes', { preHandler: optionalAuth }, async (req: FastifyRequest, reply: FastifyReply) => {
    const { username } = z.object({ username: z.string().trim().min(1).max(64) }).parse(req.params);
    const viewerId = (req as any).userId as string | undefined;
    const { page, limit } = z.object({
      page: z.coerce.number().int().min(1).default(1),
      limit: z.coerce.number().int().min(1).max(100).default(20),
    }).parse(req.query);
    const user = await prisma.user.findFirst({
      where: {
        username,
        isBanned: false,
        OR: [{ suspendedUntil: null }, { suspendedUntil: { lte: new Date() } }],
      },
      select: { id: true, isPrivate: true },
    });
    if (!user || await blockedBetween(viewerId, user.id)) {
      return reply.status(404).send({ error: 'NOT_FOUND', message: 'User not found' });
    }
    if (user.isPrivate && viewerId !== user.id) {
      return reply.status(403).send({ error: 'FORBIDDEN', message: 'Liked videos are private' });
    }

    const likes = await prisma.like.findMany({
      where: {
        userId: user.id,
        video: {
          visibility: 'public',
          user: {
            isBanned: false,
            OR: [{ suspendedUntil: null }, { suspendedUntil: { lte: new Date() } }],
            NOT: viewerId ? {
              OR: [
                { blocksReceived: { some: { blockerId: viewerId } } },
                { blocksInitiated: { some: { blockedId: viewerId } } },
              ],
            } : undefined,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
      include: {
        video: {
          include: {
            user: { select: publicUserSelect },
            sound: true,
            hashtags: { include: { hashtag: true } },
            _count: { select: { likes: true, comments: true, shares: true, saves: true } },
          },
        },
      },
    });

    return reply.send({
      videos: likes.map(({ video }) => ({
        ...video,
        hashtags: video.hashtags.map((link) => link.hashtag),
      })),
      page,
      limit,
    });
  });

  app.get('/:username/videos', { preHandler: optionalAuth }, async (req: FastifyRequest, reply: FastifyReply) => {
    const { username } = z.object({ username: z.string().trim().min(1).max(64) }).parse(req.params);
    const viewerId = (req as any).userId as string | undefined;
    const { page, limit } = z.object({
      page: z.coerce.number().int().min(1).default(1),
      limit: z.coerce.number().int().min(1).max(100).default(20),
    }).parse(req.query);
    const user = await prisma.user.findFirst({
      where: {
        username,
        isBanned: false,
        OR: [{ suspendedUntil: null }, { suspendedUntil: { lte: new Date() } }],
      },
      select: { id: true, isPrivate: true },
    });
    if (!user || await blockedBetween(viewerId, user.id)) {
      return reply.status(404).send({ error: 'NOT_FOUND', message: 'User not found' });
    }
    if (user.isPrivate && viewerId !== user.id) {
      return reply.status(403).send({ error: 'FORBIDDEN', message: 'Profile is private' });
    }

    const videos = await prisma.video.findMany({
      where: { userId: user.id, visibility: 'public' },
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
      include: {
        user: { select: publicUserSelect },
        sound: true,
        hashtags: { include: { hashtag: true } },
        _count: { select: { likes: true, comments: true, shares: true, saves: true } },
      },
    });

    return reply.send({ videos, page, limit });
  });

  app.post('/:id/follow', { preHandler: authMiddleware }, async (req: FastifyRequest, reply: FastifyReply) => {
    const { id } = z.object({ id: z.string().uuid() }).parse(req.params);
    const userId = (req as any).userId as string;
    if (id === userId) return reply.status(400).send({ error: 'BAD_REQUEST', message: 'Cannot follow yourself' });

    const target = await prisma.user.findFirst({
      where: {
        id,
        isBanned: false,
        OR: [{ suspendedUntil: null }, { suspendedUntil: { lte: new Date() } }],
      },
      select: { id: true },
    });
    if (!target || await blockedBetween(userId, id)) {
      return reply.status(404).send({ error: 'NOT_FOUND', message: 'User not found' });
    }

    const existing = await prisma.follow.findUnique({
      where: { followerId_followingId: { followerId: userId, followingId: id } },
    });
    if (existing) {
      await prisma.$transaction([
        prisma.follow.delete({ where: { id: existing.id } }),
        prisma.user.update({ where: { id: userId }, data: { followingCount: { decrement: 1 } } }),
        prisma.user.update({ where: { id }, data: { followerCount: { decrement: 1 } } }),
      ]);
      return reply.send({ following: false });
    }

    await prisma.$transaction([
      prisma.follow.create({ data: { followerId: userId, followingId: id } }),
      prisma.user.update({ where: { id: userId }, data: { followingCount: { increment: 1 } } }),
      prisma.user.update({ where: { id }, data: { followerCount: { increment: 1 } } }),
    ]);
    await NotificationService.notifyFollow(id, userId);
    return reply.send({ following: true });
  });

  app.delete('/:id/follow', { preHandler: authMiddleware }, async (req: FastifyRequest, reply: FastifyReply) => {
    const { id } = z.object({ id: z.string().uuid() }).parse(req.params);
    const userId = (req as any).userId as string;
    const existing = await prisma.follow.findUnique({
      where: { followerId_followingId: { followerId: userId, followingId: id } },
    });
    if (existing) {
      await prisma.$transaction([
        prisma.follow.delete({ where: { id: existing.id } }),
        prisma.user.update({ where: { id: userId }, data: { followingCount: { decrement: 1 } } }),
        prisma.user.update({ where: { id }, data: { followerCount: { decrement: 1 } } }),
      ]);
    }
    return reply.send({ following: false });
  });

  app.get('/suggestions/list', { preHandler: authMiddleware }, async (req: FastifyRequest, reply: FastifyReply) => {
    const userId = (req as any).userId as string;
    const { limit } = z.object({ limit: z.coerce.number().int().min(1).max(50).default(10) }).parse(req.query);
    const blocks = await prisma.userBlock.findMany({
      where: { OR: [{ blockerId: userId }, { blockedId: userId }] },
      select: { blockerId: true, blockedId: true },
    });
    const blockedIds = blocks.map((block) => block.blockerId === userId ? block.blockedId : block.blockerId);

    const users = await prisma.user.findMany({
      where: {
        id: { notIn: [userId, ...blockedIds] },
        isBanned: false,
        OR: [{ suspendedUntil: null }, { suspendedUntil: { lte: new Date() } }],
        followers: { none: { followerId: userId } },
      },
      orderBy: { followers: { _count: 'desc' } },
      take: limit,
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
