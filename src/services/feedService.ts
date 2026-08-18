import {
  FeedResponse,
  Video,
  Comment,
  FeedAction,
  PaginationParams,
  User,
  Hashtag,
  Sound,
} from '@/types';
import { apiClient } from './api';

// Demo behavior is fail-closed: it must be explicitly requested.
const USE_DEMO = process.env.NEXT_PUBLIC_USE_DEMO === 'true';
// External scraped content is a research/read-only source. It must never silently
// replace the canonical ORKY recommendation graph in production.
const USE_SCRAPER_FEED = process.env.NEXT_PUBLIC_USE_SCRAPER_FEED === 'true';
let _scraperAvailable: boolean | null = null;
let _scraperCheckedAt = 0;
const SCRAPER_CHECK_TTL_MS = 15_000;

async function useScraper(): Promise<boolean> {
  if (!USE_SCRAPER_FEED) return false;
  if (_scraperAvailable !== null && Date.now() - _scraperCheckedAt < SCRAPER_CHECK_TTL_MS) {
    return _scraperAvailable;
  }
  try {
    const { scraperBridge } = await import('./scraperBridge');
    _scraperAvailable = await scraperBridge.isAvailable();
  } catch {
    _scraperAvailable = false;
  }
  _scraperCheckedAt = Date.now();
  return _scraperAvailable;
}

interface BackendUser {
  id: string;
  username: string;
  displayName: string | null;
  avatarUrl?: string | null;
  avatar?: string | null;
  bio?: string | null;
  followerCount?: number;
  followingCount?: number;
  likeCount?: number | string;
  videoCount?: number;
  isVerified?: boolean;
  isFollowing?: boolean;
  isFollowedBy?: boolean;
  createdAt?: string;
}

type BackendHashtag =
  | { id: string; name: string }
  | { hashtag: { id: string; name: string } };

interface BackendProductMatch {
  id: string;
  orchidyCatalogItemId: string;
  variantKey?: string | null;
  confidence?: number;
  source?: string;
}

interface BackendVideo {
  id: string;
  user: BackendUser;
  videoUrl: string;
  thumbnailUrl?: string | null;
  coverUrl?: string | null;
  description?: string | null;
  title?: string | null;
  duration?: number;
  viewCount?: number | string;
  likeCount?: number | string;
  commentCount?: number | string;
  shareCount?: number | string;
  saveCount?: number | string;
  createdAt?: string;
  allowComment?: boolean;
  allowDuet?: boolean;
  allowStitch?: boolean;
  isLiked?: boolean;
  isSaved?: boolean;
  sound?: { id: string; title: string; artist?: string | null; coverUrl?: string | null } | null;
  soundId?: string | null;
  hashtags?: BackendHashtag[];
  productMatches?: BackendProductMatch[];
}

interface BackendComment {
  id: string;
  user: BackendUser;
  text: string;
  likeCount?: number;
  isLiked?: boolean;
  createdAt?: string;
  _count?: { replies?: number };
}

function mapUser(u: BackendUser): User {
  return {
    id: u.id,
    username: u.username,
    displayName: u.displayName ?? u.username,
    avatarUrl: u.avatarUrl ?? u.avatar ?? '',
    bio: u.bio ?? '',
    followersCount: Number(u.followerCount ?? 0),
    followingCount: Number(u.followingCount ?? 0),
    likesCount: Number(u.likeCount ?? 0),
    videosCount: Number(u.videoCount ?? 0),
    isVerified: u.isVerified ?? false,
    isFollowing: Boolean(u.isFollowing),
    isFollowedBy: Boolean(u.isFollowedBy),
    createdAt: u.createdAt ?? new Date().toISOString(),
  };
}

function unwrapHashtag(input: BackendHashtag) {
  return 'hashtag' in input ? input.hashtag : input;
}

function mapVideo(v: BackendVideo): Video {
  const sound = v.sound
    ? {
        id: v.sound.id,
        title: v.sound.title,
        artist: v.sound.artist ?? '',
        coverUrl: v.sound.coverUrl ?? '',
        audioUrl: '',
        duration: 0,
        usageCount: 0,
        isOriginal: false,
      }
    : null;

  return {
    id: v.id,
    user: mapUser(v.user),
    // Media is served through the authorization-aware ORKY endpoint. This also
    // keeps legacy objects usable after the MinIO bucket is made private.
    videoUrl: `/v1/media/videos/${encodeURIComponent(v.id)}`,
    thumbnailUrl: `/v1/media/thumbnails/${encodeURIComponent(v.id)}`,
    description: v.description ?? v.title ?? '',
    likesCount: Number(v.likeCount ?? 0),
    commentsCount: Number(v.commentCount ?? 0),
    sharesCount: Number(v.shareCount ?? 0),
    savesCount: Number(v.saveCount ?? 0),
    viewsCount: Number(v.viewCount ?? 0),
    duration: v.duration ?? 0,
    isLiked: Boolean(v.isLiked),
    isSaved: Boolean(v.isSaved),
    hashtags: (v.hashtags ?? []).map((input) => {
      const hashtag = unwrapHashtag(input);
      return {
        id: hashtag.id,
        name: hashtag.name,
        viewsCount: 0,
        videosCount: 0,
        isFollowing: false,
      };
    }),
    sound,
    location: null,
    createdAt: v.createdAt ?? new Date().toISOString(),
    allowComments: v.allowComment ?? true,
    allowDuet: v.allowDuet ?? true,
    allowStitch: v.allowStitch ?? true,
    sourceType: 'native',
    interactionMode: 'full',
    productMatches: (v.productMatches ?? []).map((match) => ({
      id: match.id,
      orchidyCatalogItemId: match.orchidyCatalogItemId,
      variantKey: match.variantKey ?? undefined,
      confidence: Number(match.confidence ?? 1),
      source: match.source ?? 'manual',
    })),
  };
}

function mapComment(c: BackendComment): Comment {
  return {
    id: c.id,
    user: mapUser(c.user ?? { id: '', username: 'user', displayName: 'User', avatarUrl: '' }),
    text: c.text ?? '',
    likesCount: Number(c.likeCount ?? 0),
    isLiked: Boolean(c.isLiked),
    repliesCount: Number(c._count?.replies ?? 0),
    replies: [],
    createdAt: c.createdAt ?? new Date().toISOString(),
  };
}

function mapFeed(raw: { videos: BackendVideo[]; page?: number; limit?: number }): FeedResponse {
  return {
    videos: (raw.videos ?? []).map(mapVideo),
    cursor: String(raw.page ?? 1),
    hasMore: (raw.videos ?? []).length >= (raw.limit ?? 10),
  };
}

export const feedService = {
  getFeed: async (params?: PaginationParams): Promise<FeedResponse> => {
    // The canonical recommendation service is the default. Scraped references are
    // opt-in research material and never silently replace /feed/for-you.
    if (await useScraper()) {
      const { scraperBridge } = await import('./scraperBridge');
      const videos = await scraperBridge.getVideos(params?.limit ?? 10);
      if (videos.length > 0) return { videos, cursor: 'scraper-1', hasMore: false };
    }
    if (USE_DEMO) {
      const { getDemoFeed } = await import('./demoFeed');
      return getDemoFeed(params?.limit);
    }
    const raw = await apiClient.get<{ videos: BackendVideo[]; page: number; limit: number }>(
      '/feed/for-you',
      { params: { page: params?.cursor ?? 1, limit: params?.limit ?? 10 } },
    );
    return mapFeed(raw);
  },

  getFollowingFeed: async (params?: PaginationParams): Promise<FeedResponse> => {
    // An external scraper has no ORKY follow graph, therefore it can never serve
    // the Following tab. Returning scraper videos here would be semantically false.
    if (USE_DEMO) {
      const { getDemoFeed } = await import('./demoFeed');
      return getDemoFeed(params?.limit);
    }
    const raw = await apiClient.get<{ videos: BackendVideo[]; page: number; limit: number }>(
      '/feed/following',
      { params: { page: params?.cursor ?? 1, limit: params?.limit ?? 10 } },
    );
    return mapFeed(raw);
  },

  /** Importe une référence externe (scraper) en vidéo ORKY native avec son
   *  produit approuvé. Retourne l'id de la vidéo native (idempotent). */
  async importExternalVideo(input: {
    externalVideoId: string;
    sourceUrl: string;
    title: string;
    duration: number;
    hashtags: string[];
    creatorUsername: string;
    creatorDisplayName: string;
    creatorAvatarUrl?: string;
    orchidyCatalogItemId?: string;
    variantKey?: string;
    confidence?: number;
  }): Promise<{ videoId: string }> {
    const raw = await apiClient.post<{ success: boolean; videoId: string }>('/videos/import-external', input);
    return { videoId: raw.videoId };
  },

  getVideoById: async (videoId: string): Promise<Video> => {
    if (videoId.startsWith('scraper-')) {
      const { scraperBridge } = await import('./scraperBridge');
      const videos = await scraperBridge.getVideos(50);
      const rawId = videoId.slice(8);
      const found = videos.find(v => v.id === videoId || v.id.endsWith(rawId));
      if (found) return found;
      throw new Error('Référence externe introuvable');
    }
    if (USE_DEMO) {
      const { getDemoFeed } = await import('./demoFeed');
      const feed = getDemoFeed(1);
      if (feed.videos.length > 0) return feed.videos[0];
      throw new Error('Vidéo introuvable');
    }
    const raw = await apiClient.get<{ video: BackendVideo }>(`/videos/${videoId}`);
    return mapVideo(raw.video);
  },

  performAction: async (videoId: string, action: FeedAction): Promise<void> => {
    if (USE_DEMO) return;
    if (videoId.startsWith('scraper-')) {
      throw new Error('Cette référence externe est en lecture seule. Importe-la dans ORKY avant toute interaction sociale.');
    }
    const paths: Record<string, string> = {
      like: `/videos/${videoId}/like`,
      save: `/videos/${videoId}/save`,
      share: `/videos/${videoId}/share`,
      follow: `/users/${videoId}/follow`,
      view: `/videos/${videoId}/view`,
    };
    if (action === 'report' || action === 'notInterested') return;
    const path = paths[action];
    if (!path) return;
    await apiClient.post(path);
  },

  getComments: async (
    videoId: string,
    params?: PaginationParams,
  ): Promise<{ comments: Comment[]; hasMore: boolean; cursor: string | null }> => {
    if (videoId.startsWith('scraper-')) {
      const { scraperBridge } = await import('./scraperBridge');
      const comments = await scraperBridge.getComments(videoId);
      return { comments, hasMore: false, cursor: null };
    }
    if (USE_DEMO) return { comments: [], hasMore: false, cursor: null };
    const page = Number(params?.cursor ?? 1);
    const limit = params?.limit ?? 20;
    const raw = await apiClient.get<{ comments: BackendComment[]; page: number; limit: number }>(`/videos/${videoId}/comments`, {
      params: { page, limit },
    });
    const comments = (raw.comments ?? []).map(mapComment);
    return {
      comments,
      hasMore: comments.length >= limit,
      cursor: comments.length >= limit ? String(page + 1) : null,
    };
  },

  getCommentReplies: async (commentId: string, params?: PaginationParams): Promise<Comment[]> => {
    if (commentId.startsWith('sc-')) return [];
    const page = Number(params?.cursor ?? 1);
    const limit = params?.limit ?? 50;
    const raw = await apiClient.get<{ replies: BackendComment[] }>(`/comments/${commentId}/replies`, {
      params: { page, limit },
    });
    return (raw.replies ?? []).map(mapComment);
  },

  postComment: async (videoId: string, text: string, parentId?: string): Promise<Comment> => {
    if (USE_DEMO || videoId.startsWith('scraper-')) {
      throw new Error('Les références externes et le mode démo sont en lecture seule.');
    }
    const raw = await apiClient.post<{ comment: BackendComment }>(`/videos/${videoId}/comments`, {
      text,
      parentId: parentId ?? null,
    });
    return mapComment(raw.comment);
  },

  toggleCommentLike: async (commentId: string): Promise<{ liked: boolean; likeCount: number }> => {
    if (commentId.startsWith('sc-')) throw new Error('Commentaire externe en lecture seule.');
    return apiClient.post(`/comments/${commentId}/like`);
  },

  getUserVideos: async (username: string, params?: PaginationParams): Promise<Video[]> => {
    const page = Number(params?.cursor ?? 1);
    const limit = params?.limit ?? 18;
    const raw = await apiClient.get<{ videos: BackendVideo[] }>(`/users/${encodeURIComponent(username)}/videos`, {
      params: { page, limit },
    });
    return (raw.videos ?? []).map(mapVideo);
  },

  searchVideos: async (query: string, params?: PaginationParams): Promise<FeedResponse> => {
    if (USE_DEMO) return { videos: [], cursor: null, hasMore: false };
    const raw = await apiClient.get<{ videos: BackendVideo[]; page: number; limit: number }>(
      '/search/videos',
      { params: { q: query, page: params?.cursor ?? 1, limit: params?.limit ?? 10 } },
    );
    return mapFeed(raw);
  },

  searchUsers: async (
    query: string,
    params?: PaginationParams,
  ): Promise<{ users: User[]; hasMore: boolean; cursor: string | null }> => {
    if (USE_DEMO) return { users: [], hasMore: false, cursor: null };
    const raw = await apiClient.get<{ users: BackendUser[] }>('/search/users', {
      params: { q: query, page: params?.cursor ?? 1, limit: params?.limit ?? 10 },
    });
    return { users: (raw.users ?? []).map(mapUser), hasMore: false, cursor: null };
  },

  searchHashtags: async (
    query: string,
    params?: PaginationParams,
  ): Promise<{ hashtags: Hashtag[]; hasMore: boolean; cursor: string | null }> => {
    if (USE_DEMO) return { hashtags: [], hasMore: false, cursor: null };
    const raw = await apiClient.get<{ hashtags: any[] }>('/search/hashtags', {
      params: { q: query, page: params?.cursor ?? 1, limit: params?.limit ?? 10 },
    });
    const hashtags: Hashtag[] = (raw.hashtags ?? []).map((h) => ({
      id: h.id,
      name: h.name,
      viewsCount: Number(h.viewCount ?? 0),
      videosCount: Number(h.videoCount ?? 0),
      isFollowing: false,
    }));
    return { hashtags, hasMore: false, cursor: null };
  },

  getTrendingHashtags: async (): Promise<Hashtag[]> => {
    if (USE_DEMO) return [];
    const raw = await apiClient.get<{ hashtags: any[] }>('/hashtags/trending/list', {
      params: { limit: 10 },
    });
    return (raw.hashtags ?? []).map((h) => ({
      id: h.id,
      name: h.name,
      viewsCount: Number(h.viewCount ?? 0),
      videosCount: Number(h.videoCount ?? 0),
      isFollowing: false,
    }));
  },

  getTrendingSounds: async (): Promise<Sound[]> => {
    if (USE_DEMO) return [];
    const raw = await apiClient.get<{ sounds: any[] }>('/sounds/trending/list', {
      params: { limit: 10 },
    });
    return (raw.sounds ?? []).map((s) => ({
      id: s.id,
      title: s.title,
      artist: s.artist ?? '',
      coverUrl: s.coverUrl ?? '',
      audioUrl: s.audioUrl ?? '',
      duration: Number(s.duration ?? 0),
      usageCount: Number(s.videoCount ?? 0),
      isOriginal: s.isOriginal ?? false,
    }));
  },
};
