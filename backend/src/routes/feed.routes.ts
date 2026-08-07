import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { authMiddleware, optionalAuth } from '../middleware/auth';
import { prisma } from '../config/database';
import { RecommendationService } from '../services/recommendation.service';

const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});

async function blockedIdsFor(userId: string | undefined) {
  if (!userId) return [] as string[];
  const blocks = await prisma.userBlock.findMany({
    where: { OR: [{ blockerId: userId }, { blockedId: userId }] },
    select: { blockerId: true, blockedId: true },
  });
  return blocks.map((block) => block.blockerId === userId ? block.blockedId : block.blockerId);
}

export async function feedRoutes(app: FastifyInstance) {
  app.get('/for-you', { preHandler: optionalAuth }, async (req: FastifyRequest, reply: FastifyReply) => {
    const userId = ((req as any).userId as string | undefined) ?? null;
    const { page, limit } = paginationSchema.parse(req.query);
    const videos = await RecommendationService.getForYouFeed(userId, page, limit);
    return reply.send({ videos, page, limit });
  });

  app.get('/following', { preHandler: authMiddleware }, async (req: FastifyRequest, reply: FastifyReply) => {
    const userId = (req as any).userId as string;
    const { page, limit } = paginationSchema.parse(req.query);
    const videos = await RecommendationService.getFollowingFeed(userId, page, limit);
    return reply.send({ videos, page, limit });
  });

  app.get('/live', { preHandler: optionalAuth }, async (req: FastifyRequest, reply: FastifyReply) => {
    const viewerId = (req as any).userId as string | undefined;
    const { page, limit } = paginationSchema.parse(req.query);
    const excludedUserIds = await blockedIdsFor(viewerId);
    const streams = await prisma.liveStream.findMany({
      where: {
        status: 'live',
        userId: { notIn: excludedUserIds },
        user: {
          isBanned: false,
          OR: [{ suspendedUntil: null }, { suspendedUntil: { lte: new Date() } }],
        },
      },
      orderBy: { viewerCount: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
      include: {
        user: { select: { id: true, username: true, displayName: true, avatarUrl: true, isVerified: true } },
      },
    });
    return reply.send({ streams, page, limit });
  });

  app.get('/trending', { preHandler: optionalAuth }, async (req: FastifyRequest, reply: FastifyReply) => {
    const viewerId = (req as any).userId as string | undefined;
    const { page, limit } = paginationSchema.parse(req.query);
    const excludedUserIds = await blockedIdsFor(viewerId);
    const videos = await prisma.video.findMany({
      where: {
        visibility: 'public',
        userId: { notIn: excludedUserIds },
        user: {
          isBanned: false,
          OR: [{ suspendedUntil: null }, { suspendedUntil: { lte: new Date() } }],
        },
      },
      orderBy: [
        { isTrending: 'desc' },
        { engagementScore: 'desc' },
        { viewCount: 'desc' },
        { likeCount: 'desc' },
        { createdAt: 'desc' },
      ],
      skip: (page - 1) * limit,
      take: limit,
      include: {
        user: { select: { id: true, username: true, displayName: true, avatarUrl: true, isVerified: true } },
        _count: { select: { likes: true, comments: true, shares: true, saves: true } },
      },
    });
    return reply.send({ videos, page, limit });
  });
}
