import { prisma } from '../config/database';
import { redis } from '../config/redis';

export class RecommendationService {
  private static CACHE_TTL = 300; // 5 minutes

  static async getForYouFeed(userId: string | null, page: number = 1, limit: number = 20) {
    const offset = (page - 1) * limit;
    const cacheKey = userId ? `fyp:${userId}:${page}` : `fyp:guest:${page}`;

    // Check cache
    const cached = await redis.get(cacheKey);
    if (cached) {
      return JSON.parse(cached);
    }

    let videos;

    if (userId) {
      // Personalized feed based on user interactions
      videos = await this.getPersonalizedFeed(userId, offset, limit);
    } else {
      // Trending/popular feed for guests
      videos = await this.getTrendingFeed(offset, limit);
    }

    // Cache the result
    await redis.set(cacheKey, JSON.stringify(videos), { EX: this.CACHE_TTL });

    return videos;
  }

  private static async getPersonalizedFeed(userId: string, offset: number, limit: number) {
    // Algorithm factors:
    // 1. User interests (liked videos, watched categories)
    // 2. Engagement signals (watch time, likes, shares)
    // 3. Content freshness
    // 4. Creator diversity
    // 5. Content quality signals

    const videos = await prisma.video.findMany({
      where: {
        isPublished: true,
        userId: { not: userId },
      },
      orderBy: [
        { likesCount: 'desc' },
        { viewsCount: 'desc' },
        { createdAt: 'desc' },
      ],
      skip: offset,
      take: limit,
      include: {
        user: { select: { id: true, username: true, displayName: true, avatar: true, isVerified: true } },
        _count: { select: { likes: true, comments: true, shares: true } },
      },
    });

    return videos;
  }

  private static async getTrendingFeed(offset: number, limit: number) {
    const videos = await prisma.video.findMany({
      where: { isPublished: true },
      orderBy: [
        { viewsCount: 'desc' },
        { likesCount: 'desc' },
        { createdAt: 'desc' },
      ],
      skip: offset,
      take: limit,
      include: {
        user: { select: { id: true, username: true, displayName: true, avatar: true, isVerified: true } },
        _count: { select: { likes: true, comments: true, shares: true } },
      },
    });

    return videos;
  }

  static async getFollowingFeed(userId: string, page: number = 1, limit: number = 20) {
    const offset = (page - 1) * limit;

    const videos = await prisma.video.findMany({
      where: {
        isPublished: true,
        user: {
          followers: { some: { followerId: userId } },
        },
      },
      orderBy: { createdAt: 'desc' },
      skip: offset,
      take: limit,
      include: {
        user: { select: { id: true, username: true, displayName: true, avatar: true, isVerified: true } },
        _count: { select: { likes: true, comments: true, shares: true } },
      },
    });

    return videos;
  }

  static async recordInteraction(userId: string, videoId: string, type: string, weight: number = 1) {
    // Record user interaction for future recommendations
    const key = `interactions:${userId}`;
    await redis.zIncrBy(key, weight, `${type}:${videoId}`);
    await redis.expire(key, 30 * 24 * 60 * 60); // 30 days
  }
}
