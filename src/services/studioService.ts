import { apiClient } from './api';

export interface CreatorAnalytics {
  totalViews: number;
  totalLikes: number;
  totalComments: number;
  totalShares: number;
  followers: number;
  followersGained7d: number;
  followingCount: number;
  engagementRate: number;
  dailyViews: number[];
  postsCount: number;
}

export interface CreatorVideo {
  id: string;
  title: string | null;
  description: string | null;
  thumbnailUrl: string | null;
  viewCount: number;
  likeCount: number;
  commentCount: number;
  shareCount: number;
  createdAt: string;
}

/** Real analytics from the backend. Throws when unauthenticated/offline — caller falls back to demo. */
export const studioService = {
  async getAnalytics(): Promise<CreatorAnalytics> {
    return apiClient.get<CreatorAnalytics>('/analytics/summary');
  },

  async getTopVideos(limit = 5): Promise<CreatorVideo[]> {
    const raw = await apiClient.get<{ videos: any[] }>('/analytics/videos', {
      params: { limit },
    });
    return (raw.videos ?? []).map((v) => ({
      id: v.id,
      title: v.title ?? null,
      description: v.description ?? null,
      thumbnailUrl: v.thumbnailUrl ?? null,
      viewCount: Number(v.viewCount ?? 0),
      likeCount: Number(v.likeCount ?? 0),
      commentCount: Number(v.commentCount ?? 0),
      shareCount: Number(v.shareCount ?? 0),
      createdAt: v.createdAt ?? new Date().toISOString(),
    }));
  },
};
