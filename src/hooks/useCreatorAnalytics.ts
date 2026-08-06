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
        if (mounted) setAnalytics({ ...summary, topVideos, live: true });
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
