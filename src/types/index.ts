export interface User {
  id: string;
  username: string;
  displayName: string;
  avatarUrl: string;
  bio: string;
  followersCount: number;
  followingCount: number;
  likesCount: number;
  videosCount: number;
  isVerified: boolean;
  isFollowing: boolean;
  isFollowedBy: boolean;
  createdAt: string;
}

export interface VideoProductMatch {
  id: string;
  orchidyCatalogItemId: string;
  variantKey?: string;
  confidence: number;
  source: string;
}

export interface Video {
  id: string;
  user: User;
  videoUrl: string;
  thumbnailUrl: string;
  description: string;
  likesCount: number;
  commentsCount: number;
  sharesCount: number;
  savesCount: number;
  viewsCount: number;
  duration: number;
  isLiked: boolean;
  isSaved: boolean;
  hashtags: Hashtag[];
  sound: Sound | null;
  location: Location | null;
  createdAt: string;
  allowComments: boolean;
  allowDuet: boolean;
  allowStitch: boolean;
  /** Legacy demo-only product pointer. Real commerce uses productMatches. */
  productId?: string;
  productMatches?: VideoProductMatch[];
  sourceType?: 'native' | 'external_reference';
  interactionMode?: 'full' | 'read_only';
  externalPlatform?: string;
  externalUrl?: string;
}

export interface Hashtag {
  id: string;
  name: string;
  viewsCount: number;
  videosCount: number;
  isFollowing: boolean;
}

export interface Sound {
  id: string;
  title: string;
  artist: string;
  coverUrl: string;
  audioUrl: string;
  duration: number;
  usageCount: number;
  isOriginal: boolean;
}

export interface Location {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  address: string;
}

export interface Comment {
  id: string;
  user: User;
  text: string;
  likesCount: number;
  isLiked: boolean;
  repliesCount: number;
  replies: Comment[];
  createdAt: string;
}

export interface FeedResponse {
  videos: Video[];
  cursor: string | null;
  hasMore: boolean;
}

export interface AuthResponse {
  accessToken: string;
  refreshToken: string;
  user: User;
  expiresIn: number;
}

export interface PaginationParams {
  cursor?: string;
  limit?: number;
}

export type LoadingState = 'idle' | 'loading' | 'refreshing' | 'loadingMore' | 'error';

export type FeedAction = 'like' | 'comment' | 'share' | 'save' | 'follow' | 'report' | 'notInterested';

export type SharePlatform =
  | 'whatsapp'
  | 'instagram'
  | 'facebook'
  | 'twitter'
  | 'telegram'
  | 'copyLink'
  | 'message'
  | 'other';
