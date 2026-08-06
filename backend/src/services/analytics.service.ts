import { prisma } from '../config/database';

const DAY_MS = 86_400_000;

/** Real analytics for a creator, computed from the database. */
export class AnalyticsService {
  static async summary(userId: string) {
    const [videos, user, views7d, follows7d] = await Promise.all([
      prisma.video.aggregate({
        where: { userId },
        _sum: {
          viewCount: true,
          likeCount: true,
          commentCount: true,
          shareCount: true,
        },
        _count: true,
      }),
      prisma.user.findUnique({
        where: { id: userId },
        select: { followerCount: true, followingCount: true },
      }),
      prisma.videoView.findMany({
        where: {
          video: { userId },
          createdAt: { gte: new Date(Date.now() - 7 * DAY_MS) },
        },
        select: { createdAt: true },
      }),
      prisma.follow.count({
        where: {
          followingId: userId,
          createdAt: { gte: new Date(Date.now() - 7 * DAY_MS) },
        },
      }),
    ]);

    const totalViews = Number(videos._sum.viewCount ?? 0);
    const totalLikes = Number(videos._sum.likeCount ?? 0);
    const totalComments = Number(videos._sum.commentCount ?? 0);
    const totalShares = Number(videos._sum.shareCount ?? 0);
    const followers = user?.followerCount ?? 0;

    const interactions = totalLikes + totalComments + totalShares;
    const engagementRate = totalViews > 0 ? (interactions / totalViews) * 100 : 0;

    // Bucket real view timestamps into 7 daily bins (oldest -> newest).
    const dailyViews = Array.from({ length: 7 }, (_, i) => {
      const start = Date.now() - (6 - i) * DAY_MS;
      const end = start + DAY_MS;
      return views7d.filter((v) => {
        const t = v.createdAt.getTime();
        return t >= start && t < end;
      }).length;
    });

    return {
      totalViews,
      totalLikes,
      totalComments,
      totalShares,
      followers,
      followersGained7d: follows7d,
      followingCount: user?.followingCount ?? 0,
      engagementRate,
      dailyViews,
      postsCount: videos._count,
    };
  }

  static async topVideos(userId: string, limit = 5) {
    return prisma.video.findMany({
      where: { userId },
      orderBy: [{ viewCount: 'desc' }],
      take: limit,
      select: {
        id: true,
        title: true,
        description: true,
        thumbnailUrl: true,
        videoUrl: true,
        viewCount: true,
        likeCount: true,
        commentCount: true,
        shareCount: true,
        createdAt: true,
      },
    });
  }

  static async dailyViews(userId: string, days = 30) {
    const rows = await prisma.videoView.findMany({
      where: {
        video: { userId },
        createdAt: { gte: new Date(Date.now() - days * DAY_MS) },
      },
      select: { createdAt: true },
    });
    const buckets = Array.from({ length: days }, (_, i) => {
      const start = Date.now() - (days - 1 - i) * DAY_MS;
      const end = start + DAY_MS;
      return {
        date: new Date(start).toISOString().slice(0, 10),
        views: rows.filter((r) => {
          const t = r.createdAt.getTime();
          return t >= start && t < end;
        }).length,
      };
    });
    return buckets;
  }
}
