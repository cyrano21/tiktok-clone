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

/**
 * Adds viewer-specific social state after recommendation caching. This keeps the
 * ranking cache reusable while ensuring refreshes do not reset like/save/follow
 * state to false. Product matches are also attached from the canonical DB.
 */
async function decorateVideos(videos: any[], viewerId?: string | null) {
  if (!Array.isArray(videos) || videos.length === 0) return [];
  const videoIds = [...new Set(videos.map((video) => String(video.id)).filter(Boolean))];
  const creatorIds = [...new Set(videos.map((video) => String(video.userId || video.user?.id || '')).filter(Boolean))];

  const [matches, likes, saves, following, followedBy] = await Promise.all([
    prisma.videoProductMatch.findMany({
      where: { videoId: { in: videoIds }, status: 'active' },
      orderBy: [{ confidence: 'desc' }, { createdAt: 'asc' }],
      select: { id: true, videoId: true, orchidyCatalogItemId: true, variantKey: true, confidence: true, source: true },
    }),
    viewerId ? prisma.like.findMany({ where: { userId: viewerId, videoId: { in: videoIds } }, select: { videoId: true } }) : Promise.resolve([]),
    viewerId ? prisma.save.findMany({ where: { userId: viewerId, videoId: { in: videoIds } }, select: { videoId: true } }) : Promise.resolve([]),
    viewerId ? prisma.follow.findMany({ where: { followerId: viewerId, followingId: { in: creatorIds } }, select: { followingId: true } }) : Promise.resolve([]),
    viewerId ? prisma.follow.findMany({ where: { followerId: { in: creatorIds }, followingId: viewerId }, select: { followerId: true } }) : Promise.resolve([]),
  ]);

  const matchesByVideo = new Map<string, typeof matches>();
  for (const match of matches) {
    const list = matchesByVideo.get(match.videoId) ?? [];
    if (list.length < 5) list.push(match);
    matchesByVideo.set(match.videoId, list);
  }
  const liked = new Set(likes.map((entry) => entry.videoId));
  const saved = new Set(saves.map((entry) => entry.videoId));
  const followingIds = new Set(following.map((entry) => entry.followingId));
  const followedByIds = new Set(followedBy.map((entry) => entry.followerId));

  return videos.map((video) => {
    const creatorId = String(video.userId || video.user?.id || '');
    return {
      ...video,
      isLiked: liked.has(String(video.id)),
      isSaved: saved.has(String(video.id)),
      productMatches: matchesByVideo.get(String(video.id)) ?? [],
      user: video.user ? {
        ...video.user,
        isFollowing: viewerId ? followingIds.has(creatorId) : false,
        isFollowedBy: viewerId ? followedByIds.has(creatorId) : false,
      } : video.user,
    };
  });
}

const discoverInclude = {
  user: { select: { id: true, username: true, displayName: true, avatarUrl: true, isVerified: true, followerCount: true, followingCount: true, likeCount: true, videoCount: true } },
  sound: { select: { id: true, title: true, artist: true, coverUrl: true } },
  hashtags: { include: { hashtag: { select: { id: true, name: true } } } },
  _count: { select: { likes: true, comments: true, shares: true, saves: true } },
} as const;

export async function feedRoutes(app: FastifyInstance) {
  app.get('/for-you', { preHandler: optionalAuth }, async (req: FastifyRequest, reply: FastifyReply) => {
    const userId = ((req as any).userId as string | undefined) ?? null;
    const { page, limit } = paginationSchema.parse(req.query);
    const videos = await RecommendationService.getForYouFeed(userId, page, limit);
    return reply.send({ videos: await decorateVideos(videos as any[], userId), page, limit });
  });

  app.get('/following', { preHandler: authMiddleware }, async (req: FastifyRequest, reply: FastifyReply) => {
    const userId = (req as any).userId as string;
    const { page, limit } = paginationSchema.parse(req.query);
    const videos = await RecommendationService.getFollowingFeed(userId, page, limit);
    return reply.send({ videos: await decorateVideos(videos as any[], userId), page, limit });
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
      sourceType: 'ORKY_NATIVE',
      userId: { notIn: blockedIds },
      user: {
        isBanned: false,
        OR: [{ suspendedUntil: null }, { suspendedUntil: { lte: new Date() } }],
      },
    };

    if (category === 'trending') baseWhere.isTrending = true;
    if (category !== 'all' && category !== 'trending') {
      const terms = categoryTerms[category];
      baseWhere.OR = terms.flatMap((term) => [
        { title: { contains: term, mode: 'insensitive' } },
        { description: { contains: term, mode: 'insensitive' } },
        { sound: { title: { contains: term, mode: 'insensitive' } } },
        { sound: { artist: { contains: term, mode: 'insensitive' } } },
        { hashtags: { some: { hashtag: { name: { contains: term, mode: 'insensitive' } } } } },
      ]);
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
    return reply.send({ videos: await decorateVideos(videos as any[], viewerId), page, limit, category });
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
        sourceType: 'ORKY_NATIVE',
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
      include: discoverInclude,
    });
    return reply.send({ videos: await decorateVideos(videos as any[], viewerId), page, limit });
  });
}
