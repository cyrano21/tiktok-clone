import { useEffect, useState } from 'react';
import { studioService, CreatorAnalytics, CreatorVideo } from '@/services/studioService';
import { useStudioStore } from '@/store/studioStore';

export interface CreatorAnalyticsView extends CreatorAnalytics {
  topVideos: CreatorVideo[];
  live: boolean; // true when data comes from the real backend
}

/** Load real analytics; falls back to demo store when unauthenticated or offline. */
export function useCreatorAnalytics(): CreatorAnalyticsView {
  const [analytics, setAnalytics] = useState<CreatorAnalyticsView>(() => {
    const demo = useStudioStore.getState().analytics();
    const posts = useStudioStore.getState().posts;
    return {
      ...demo,
      followingCount: 0,
      topVideos: posts.slice(0, 5).map((p) => ({
        id: p.id,
        title: p.caption,
        description: p.caption,
        thumbnailUrl: p.thumbnailUrl,
        viewCount: p.metrics.views,
        likeCount: p.metrics.likes,
        commentCount: p.metrics.comments,
        shareCount: p.metrics.shares,
        createdAt: p.createdAt,
      })),
      live: false,
    };
  });

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const [summary, topVideos] = await Promise.all([
          studioService.getAnalytics(),
          studioService.getTopVideos(5),
        ]);
        if (mounted) {
          setAnalytics({
            ...summary,
            totalViews: Number(summary.totalViews ?? 0),
            totalLikes: Number(summary.totalLikes ?? 0),
            totalComments: Number(summary.totalComments ?? 0),
            totalShares: Number(summary.totalShares ?? 0),
            followers: Number(summary.followers ?? 0),
            followersGained7d: Number(summary.followersGained7d ?? 0),
            followingCount: Number(summary.followingCount ?? 0),
            engagementRate: Number(summary.engagementRate ?? 0),
            dailyViews: Array.isArray(summary.dailyViews)
              ? Array.from({ length: 7 }, (_, index) => Number(summary.dailyViews[index] ?? 0))
              : Array(7).fill(0),
            postsCount: Number(summary.postsCount ?? topVideos.length),
            topVideos,
            live: true,
          });
        }
      } catch {
        // keep demo fallback
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  return analytics;
}
