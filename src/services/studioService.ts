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

export interface PublishedVideo {
  id: string;
  videoUrl: string;
  thumbnailUrl: string | null;
  duration: number;
  width: number;
  height: number;
  description: string | null;
}

export interface PublishMediaOptions {
  filename: string;
  description: string;
  title?: string;
  visibility?: 'public' | 'friends' | 'private';
  allowDuet?: boolean;
  allowStitch?: boolean;
  allowComment?: boolean;
  trimStart?: number;
  trimEnd?: number;
  overlayText?: string;
  filters?: {
    brightness?: number;
    contrast?: number;
    saturate?: number;
    grayscale?: number;
  };
}

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

  async publishMedia(blob: Blob, options: PublishMediaOptions): Promise<PublishedVideo> {
    const form = new FormData();

    // Fastify multipart fields must arrive before the file for req.file().fields
    // to contain them immediately, so append metadata first and the binary last.
    form.append('description', options.description);
    if (options.title) form.append('title', options.title);
    form.append('visibility', options.visibility ?? 'public');
    form.append('allowDuet', String(options.allowDuet ?? true));
    form.append('allowStitch', String(options.allowStitch ?? true));
    form.append('allowComment', String(options.allowComment ?? true));
    form.append('trimStart', String(options.trimStart ?? 0));
    form.append('trimEnd', String(options.trimEnd ?? 0));
    form.append('overlayText', options.overlayText ?? '');
    form.append('filters', JSON.stringify(options.filters ?? {}));
    form.append('file', blob, options.filename);

    const raw = await apiClient.upload<{ video: PublishedVideo }>('/videos', form);
    return raw.video;
  },
};
