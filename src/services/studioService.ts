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

export interface MediaFilterSettings {
  brightness?: number;
  contrast?: number;
  saturate?: number;
  sepia?: number;
  grayscale?: number;
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
  filters?: MediaFilterSettings;
}

export interface PublishCompositionOptions {
  description: string;
  title?: string;
  visibility?: 'public' | 'friends' | 'private';
  allowDuet?: boolean;
  allowStitch?: boolean;
  allowComment?: boolean;
}

export interface PublishCompositionAsset {
  fieldName: string;
  blob: Blob;
  filename: string;
  mimetype: string;
}

export interface PublishCompositionManifest {
  version: 1;
  clips: Array<{
    id: string;
    sourceField: string;
    kind: 'video' | 'image';
    trimStart: number;
    trimEnd: number;
    imageDuration: number;
    overlayText: string;
    filters: MediaFilterSettings;
    transition: 'none' | 'fade';
  }>;
}

function mediaUrls(video: PublishedVideo): PublishedVideo {
  return {
    ...video,
    videoUrl: `/v1/media/videos/${encodeURIComponent(video.id)}`,
    thumbnailUrl: video.thumbnailUrl ? `/v1/media/thumbnails/${encodeURIComponent(video.id)}` : null,
  };
}

function appendPublishMetadata(form: FormData, options: PublishCompositionOptions) {
  form.append('description', options.description);
  if (options.title) form.append('title', options.title);
  form.append('visibility', options.visibility ?? 'public');
  form.append('allowDuet', String(options.allowDuet ?? true));
  form.append('allowStitch', String(options.allowStitch ?? true));
  form.append('allowComment', String(options.allowComment ?? true));
}

export const studioService = {
  async getAnalytics(): Promise<CreatorAnalytics> {
    return apiClient.get<CreatorAnalytics>('/analytics/summary');
  },

  async getTopVideos(limit = 5): Promise<CreatorVideo[]> {
    const raw = await apiClient.get<{ videos: any[] }>('/analytics/videos', { params: { limit } });
    return (raw.videos ?? []).map((v) => ({
      id: v.id,
      title: v.title ?? null,
      description: v.description ?? null,
      thumbnailUrl: v.thumbnailUrl ? `/v1/media/thumbnails/${encodeURIComponent(v.id)}` : null,
      viewCount: Number(v.viewCount ?? 0),
      likeCount: Number(v.likeCount ?? 0),
      commentCount: Number(v.commentCount ?? 0),
      shareCount: Number(v.shareCount ?? 0),
      createdAt: v.createdAt ?? new Date().toISOString(),
    }));
  },

  async publishMedia(blob: Blob, options: PublishMediaOptions): Promise<PublishedVideo> {
    if ((options.visibility ?? 'public') !== 'public') {
      throw new Error('La publication friends/private sera activée lorsque la lecture média signée sera disponible.');
    }
    const form = new FormData();
    appendPublishMetadata(form, options);
    form.append('trimStart', String(options.trimStart ?? 0));
    form.append('trimEnd', String(options.trimEnd ?? 0));
    form.append('overlayText', options.overlayText ?? '');
    form.append('filters', JSON.stringify(options.filters ?? {}));
    form.append('file', blob, options.filename);

    const raw = await apiClient.upload<{ video: PublishedVideo }>('/videos', form);
    return mediaUrls(raw.video);
  },

  async publishComposition(
    assets: PublishCompositionAsset[],
    manifest: PublishCompositionManifest,
    options: PublishCompositionOptions,
  ): Promise<PublishedVideo> {
    if ((options.visibility ?? 'public') !== 'public') {
      throw new Error('La publication friends/private sera activée lorsque la lecture média signée sera disponible.');
    }
    if (!assets.length || assets.length > 8) throw new Error('Le montage doit contenir entre 1 et 8 sources.');
    if (!manifest.clips.length || manifest.clips.length > 20) throw new Error('Le montage doit contenir entre 1 et 20 clips.');

    const fields = new Set<string>();
    for (const asset of assets) {
      if (!/^source_\d+$/.test(asset.fieldName) || fields.has(asset.fieldName)) {
        throw new Error('Identifiant de source de montage invalide.');
      }
      fields.add(asset.fieldName);
    }
    for (const clip of manifest.clips) {
      if (!fields.has(clip.sourceField)) throw new Error('Un clip référence une source absente.');
    }

    const form = new FormData();
    // @fastify/multipart parses fields serially. Keep all metadata before files.
    appendPublishMetadata(form, options);
    form.append('composition', JSON.stringify(manifest));
    for (const asset of assets) {
      form.append(asset.fieldName, asset.blob, asset.filename);
    }

    const raw = await apiClient.upload<{ video: PublishedVideo }>('/videos/compose', form);
    return mediaUrls(raw.video);
  },
};
