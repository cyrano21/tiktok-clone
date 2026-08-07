import { prisma } from '../config/database';
import { redis } from '../config/redis';

const CACHE_TTL_SECONDS = 120;
const MAX_CANDIDATES = 400;
const RECENT_VIEW_WINDOW_MS = 3 * 24 * 60 * 60 * 1000;

type Candidate = Awaited<ReturnType<typeof RecommendationService.loadCandidates>>[number];

type PreferenceProfile = {
  followedCreators: Set<string>;
  creatorWeights: Map<string, number>;
  hashtagWeights: Map<string, number>;
  soundWeights: Map<string, number>;
  seenRecently: Set<string>;
  redisVideoWeights: Map<string, number>;
  blockedUsers: Set<string>;
};

function addWeight(map: Map<string, number>, key: string | null | undefined, weight: number) {
  if (!key) return;
  map.set(key, (map.get(key) ?? 0) + weight);
}

function normalizeCompletion(value: number) {
  if (!Number.isFinite(value) || value <= 0) return 0;
  return Math.min(1, value > 1 ? value / 100 : value);
}

function bigintToNumber(value: bigint | number) {
  return typeof value === 'bigint' ? Number(value) : value;
}

export class RecommendationService {
  static async getForYouFeed(userId: string | null, page: number = 1, limit: number = 20) {
    const safePage = Math.max(1, page);
    const safeLimit = Math.min(50, Math.max(1, limit));
    const cacheKey = userId ? `fyp:v3:${userId}:${safePage}:${safeLimit}` : `fyp:v3:guest:${safePage}:${safeLimit}`;

    const cached = await redis.get(cacheKey);
    if (cached) return JSON.parse(cached);

    const videos = userId
      ? await this.getPersonalizedFeed(userId, safePage, safeLimit)
      : await this.getTrendingFeed(safePage, safeLimit);

    await redis.set(
      cacheKey,
      JSON.stringify(videos, (_key, value) => typeof value === 'bigint' ? Number(value) : value),
      { EX: CACHE_TTL_SECONDS },
    );
    return videos;
  }

  private static async getPersonalizedFeed(userId: string, page: number, limit: number) {
    const offset = (page - 1) * limit;
    const profile = await this.buildPreferenceProfile(userId);
    const candidateCount = Math.min(MAX_CANDIDATES, Math.max(120, (offset + limit) * 8));
    const candidates = await this.loadCandidates(userId, profile.blockedUsers, candidateCount);

    const ranked = candidates
      .map((video) => ({ video, score: this.scoreCandidate(video, profile) }))
      .sort((a, b) => b.score - a.score);

    const creatorCounts = new Map<string, number>();
    const diversified = ranked
      .map((entry) => {
        const previous = creatorCounts.get(entry.video.userId) ?? 0;
        creatorCounts.set(entry.video.userId, previous + 1);
        return { ...entry, diversifiedScore: entry.score - previous * 4.5 };
      })
      .sort((a, b) => b.diversifiedScore - a.diversifiedScore)
      .map(({ video }) => video);

    return diversified.slice(offset, offset + limit);
  }

  static async loadCandidates(userId: string, blockedUsers: Set<string>, take: number) {
    const blockedIds = [...blockedUsers];
    const where = {
      visibility: 'public',
      userId: { notIn: [userId, ...blockedIds] },
      user: {
        isBanned: false,
        OR: [{ suspendedUntil: null }, { suspendedUntil: { lte: new Date() } }],
      },
    } as const;

    const include = {
      user: { select: { id: true, username: true, displayName: true, avatarUrl: true, isVerified: true } },
      hashtags: { include: { hashtag: { select: { id: true, name: true } } } },
      _count: { select: { likes: true, comments: true, shares: true, saves: true } },
    } as const;

    const half = Math.ceil(take / 2);
    const [recent, popular] = await Promise.all([
      prisma.video.findMany({ where, orderBy: { createdAt: 'desc' }, take: half, include }),
      prisma.video.findMany({
        where,
        orderBy: [{ isTrending: 'desc' }, { engagementScore: 'desc' }, { viewCount: 'desc' }, { createdAt: 'desc' }],
        take: half,
        include,
      }),
    ]);

    const deduped = new Map<string, (typeof recent)[number]>();
    for (const video of [...recent, ...popular]) deduped.set(video.id, video);
    return [...deduped.values()];
  }

  private static scoreCandidate(video: Candidate, profile: PreferenceProfile) {
    const ageHours = Math.max(0, (Date.now() - video.createdAt.getTime()) / 3_600_000);
    const freshness = Math.exp(-ageHours / (24 * 5)) * 7;

    const views = bigintToNumber(video.viewCount);
    const likes = bigintToNumber(video.likeCount);
    const comments = bigintToNumber(video.commentCount);
    const shares = bigintToNumber(video.shareCount);
    const saves = bigintToNumber(video.saveCount);
    const engagement = Math.log1p(views * 0.12 + likes * 3 + comments * 4 + shares * 6 + saves * 5);

    const followedBoost = profile.followedCreators.has(video.userId) ? 7 : 0;
    const creatorBoost = (profile.creatorWeights.get(video.userId) ?? 0) * 1.35;
    const hashtagBoost = video.hashtags.reduce(
      (sum, link) => sum + (profile.hashtagWeights.get(link.hashtagId) ?? 0) * 1.15,
      0,
    );
    const soundBoost = (profile.soundWeights.get(video.soundId ?? '') ?? 0) * 1.05;
    const explicitInteractionBoost = Math.min(8, (profile.redisVideoWeights.get(video.id) ?? 0) * 0.4);
    const unseenBoost = profile.seenRecently.has(video.id) ? -10 : 2.5;
    const verticalQualityBoost = video.height >= video.width && video.duration > 1 ? 1 : 0;

    return freshness
      + engagement
      + followedBoost
      + creatorBoost
      + hashtagBoost
      + soundBoost
      + explicitInteractionBoost
      + unseenBoost
      + verticalQualityBoost;
  }

  private static async buildPreferenceProfile(userId: string): Promise<PreferenceProfile> {
    const since = new Date(Date.now() - RECENT_VIEW_WINDOW_MS);
    const [follows, likes, saves, views, blocks, redisVideoWeights] = await Promise.all([
      prisma.follow.findMany({ where: { followerId: userId }, select: { followingId: true }, take: 500 }),
      prisma.like.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        take: 120,
        include: { video: { select: { userId: true, soundId: true, hashtags: { select: { hashtagId: true } } } } },
      }),
      prisma.save.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        take: 120,
        include: { video: { select: { userId: true, soundId: true, hashtags: { select: { hashtagId: true } } } } },
      }),
      prisma.videoView.findMany({
        where: { userId, createdAt: { gte: since } },
        orderBy: { createdAt: 'desc' },
        take: 250,
        select: {
          videoId: true,
          watchPercentage: true,
          video: { select: { userId: true, soundId: true, hashtags: { select: { hashtagId: true } } } },
        },
      }),
      prisma.userBlock.findMany({
        where: { OR: [{ blockerId: userId }, { blockedId: userId }] },
        select: { blockerId: true, blockedId: true },
      }),
      this.getRedisVideoSignals(userId),
    ]);

    const creatorWeights = new Map<string, number>();
    const hashtagWeights = new Map<string, number>();
    const soundWeights = new Map<string, number>();

    for (const like of likes) {
      addWeight(creatorWeights, like.video.userId, 1.8);
      addWeight(soundWeights, like.video.soundId, 1.2);
      for (const tag of like.video.hashtags) addWeight(hashtagWeights, tag.hashtagId, 1.4);
    }
    for (const save of saves) {
      addWeight(creatorWeights, save.video.userId, 2.6);
      addWeight(soundWeights, save.video.soundId, 2);
      for (const tag of save.video.hashtags) addWeight(hashtagWeights, tag.hashtagId, 2.2);
    }
    for (const view of views) {
      const completion = normalizeCompletion(view.watchPercentage);
      const affinity = completion >= 0.8 ? 1.2 : completion >= 0.5 ? 0.5 : completion <= 0.15 ? -0.35 : 0;
      if (!affinity) continue;
      addWeight(creatorWeights, view.video.userId, affinity);
      addWeight(soundWeights, view.video.soundId, affinity * 0.65);
      for (const tag of view.video.hashtags) addWeight(hashtagWeights, tag.hashtagId, affinity * 0.8);
    }

    const blockedUsers = new Set<string>();
    for (const block of blocks) {
      blockedUsers.add(block.blockerId === userId ? block.blockedId : block.blockerId);
    }

    return {
      followedCreators: new Set(follows.map((follow) => follow.followingId)),
      creatorWeights,
      hashtagWeights,
      soundWeights,
      seenRecently: new Set(views.map((view) => view.videoId)),
      redisVideoWeights,
      blockedUsers,
    };
  }

  private static async getRedisVideoSignals(userId: string) {
    const result = new Map<string, number>();
    try {
      const interactions = await redis.zRangeWithScores(`interactions:${userId}`, 0, -1);
      for (const item of interactions) {
        const separator = item.value.indexOf(':');
        if (separator === -1) continue;
        const videoId = item.value.slice(separator + 1);
        result.set(videoId, (result.get(videoId) ?? 0) + item.score);
      }
    } catch {
      // Database signals remain sufficient if Redis history is temporarily unavailable.
    }
    return result;
  }

  private static async getTrendingFeed(page: number, limit: number) {
    const offset = (page - 1) * limit;
    return prisma.video.findMany({
      where: {
        visibility: 'public',
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
      skip: offset,
      take: limit,
      include: {
        user: { select: { id: true, username: true, displayName: true, avatarUrl: true, isVerified: true } },
        _count: { select: { likes: true, comments: true, shares: true, saves: true } },
      },
    });
  }

  static async getFollowingFeed(userId: string, page: number = 1, limit: number = 20) {
    const safePage = Math.max(1, page);
    const safeLimit = Math.min(50, Math.max(1, limit));
    const offset = (safePage - 1) * safeLimit;
    const blocks = await prisma.userBlock.findMany({
      where: { OR: [{ blockerId: userId }, { blockedId: userId }] },
      select: { blockerId: true, blockedId: true },
    });
    const blockedIds = blocks.map((block) => block.blockerId === userId ? block.blockedId : block.blockerId);

    return prisma.video.findMany({
      where: {
        visibility: 'public',
        userId: { notIn: blockedIds },
        user: {
          isBanned: false,
          OR: [{ suspendedUntil: null }, { suspendedUntil: { lte: new Date() } }],
          followers: { some: { followerId: userId } },
        },
      },
      orderBy: { createdAt: 'desc' },
      skip: offset,
      take: safeLimit,
      include: {
        user: { select: { id: true, username: true, displayName: true, avatarUrl: true, isVerified: true } },
        _count: { select: { likes: true, comments: true, shares: true, saves: true } },
      },
    });
  }

  static async recordInteraction(userId: string, videoId: string, type: string, weight: number = 1) {
    const key = `interactions:${userId}`;
    await redis.zIncrBy(key, weight, `${type}:${videoId}`);
    await redis.expire(key, 30 * 24 * 60 * 60);
    await redis.del(Array.from({ length: 5 }, (_, index) => `fyp:v3:${userId}:${index + 1}:20`));
  }
}
