import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { authMiddleware, optionalAuth } from '../middleware/auth';
import { prisma } from '../config/database';
import { RecommendationService } from '../services/recommendation.service';

const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});

const discoverQuerySchema = paginationSchema.extend({
  category: z.enum(['all', 'trending', 'music', 'comedy', 'sports', 'food', 'beauty']).default('all'),
});

async function blockedIdsFor(userId: string | undefined) {
  if (!userId) return [] as string[];
  const blocks = await prisma.userBlock.findMany({
    where: { OR: [{ blockerId: userId }, { blockedId: userId }] },
    select: { blockerId: true, blockedId: true },
  });
  return blocks.map((block) => block.blockerId === userId ? block.blockedId : block.blockerId);
}

const discoverInclude = {
  user: { select: { id: true, username: true, displayName: true, avatarUrl: true, isVerified: true } },
  sound: { select: { id: true, title: true, artist: true, coverUrl: true } },
  hashtags: { include: { hashtag: { select: { id: true, name: true } } } },
  _count: { select: { likes: true, comments: true, shares: true, saves: true } },
} as const;

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

  app.get('/discover', { preHandler: optionalAuth }, async (req: FastifyRequest, reply: FastifyReply) => {
    const viewerId = (req as any).userId as string | undefined;
    const { category, page, limit } = discoverQuerySchema.parse(req.query);
    const blockedIds = await blockedIdsFor(viewerId);
    const categoryTerms: Record<string, string[]> = {
      music: ['music', 'song', 'chanson', 'musique', 'dance', 'danse'],
      comedy: ['comedy', 'humor', 'humour', 'funny', 'sketch', 'comédie'],
      sports: ['sport', 'fitness', 'workout', 'football', 'basketball', 'gym'],
      food: ['food', 'recipe', 'cooking', 'cuisine', 'recette'],
      beauty: ['beauty', 'makeup', 'skincare', 'mode', 'fashion', 'beauté'],
    };

    const baseWhere: any = {
      visibility: 'public',
      userId: { notIn: blockedIds },
      user: {
        isBanned: false,
        OR: [{ suspendedUntil: null }, { suspendedUntil: { lte: new Date() } }],
      },
    };

    if (category === 'trending') baseWhere.isTrending = true;
    if (category !== 'all' && category !== 'trending') {
      const terms = categoryTerms[category];
      baseWhere.OR = [
        { title: { contains: terms[0], mode: 'insensitive' } },
        { description: { contains: terms[0], mode: 'insensitive' } },
        { sound: { title: { contains: terms[0], mode: 'insensitive' } } },
        { sound: { artist: { contains: terms[0], mode: 'insensitive' } } },
        { hashtags: { some: { hashtag: { name: { contains: terms[0], mode: 'insensitive' } } } } },
      ];
      if (terms.length > 1) {
        baseWhere.OR = terms.flatMap((term) => [
          { title: { contains: term, mode: 'insensitive' } },
          { description: { contains: term, mode: 'insensitive' } },
          { sound: { title: { contains: term, mode: 'insensitive' } } },
          { sound: { artist: { contains: term, mode: 'insensitive' } } },
          { hashtags: { some: { hashtag: { name: { contains: term, mode: 'insensitive' } } } } },
        ]);
      }
    }

    const videos = await prisma.video.findMany({
      where: baseWhere,
      orderBy: category === 'trending'
        ? [{ trendingRank: 'asc' }, { engagementScore: 'desc' }, { createdAt: 'desc' }]
        : [{ createdAt: 'desc' }, { engagementScore: 'desc' }],
      skip: (page - 1) * limit,
      take: limit,
      include: discoverInclude,
    });
    return reply.send({ videos, page, limit, category });
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
