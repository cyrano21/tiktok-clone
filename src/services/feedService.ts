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
import { getDemoFeed } from './demoFeed';

const USE_DEMO = true;

async function delay<T>(value: T, ms = 300): Promise<T> {
  return new Promise((resolve) => setTimeout(() => resolve(value), ms));
}

export const feedService = {
  getFeed: async (params?: PaginationParams): Promise<FeedResponse> => {
    if (USE_DEMO) return delay(getDemoFeed(params?.limit ?? 10));
    throw new Error('Backend not available');
  },

  getFollowingFeed: async (params?: PaginationParams): Promise<FeedResponse> => {
    if (USE_DEMO) return delay(getDemoFeed(params?.limit ?? 10));
    throw new Error('Backend not available');
  },

  getVideoById: async (_videoId: string): Promise<Video> => {
    if (USE_DEMO) return delay(getDemoFeed(1).videos[0]);
    throw new Error('Backend not available');
  },

  performAction: async (_videoId: string, _action: FeedAction): Promise<void> => {
    if (USE_DEMO) return;
    throw new Error('Backend not available');
  },

  getComments: async (
    _videoId: string,
    _params?: PaginationParams
  ): Promise<{ comments: Comment[]; hasMore: boolean; cursor: string | null }> => {
    if (USE_DEMO) return delay({ comments: [], hasMore: false, cursor: null });
    throw new Error('Backend not available');
  },

  postComment: async (_videoId: string, _text: string, _parentId?: string): Promise<Comment> => {
    throw new Error('Not implemented in demo mode');
  },

  searchVideos: async (_query: string, params?: PaginationParams): Promise<FeedResponse> => {
    if (USE_DEMO) return delay(getDemoFeed(params?.limit ?? 10));
    throw new Error('Backend not available');
  },

  searchUsers: async (
    _query: string,
    _params?: PaginationParams
  ): Promise<{ users: User[]; hasMore: boolean; cursor: string | null }> => {
    if (USE_DEMO) return delay({ users: [], hasMore: false, cursor: null });
    throw new Error('Backend not available');
  },

  searchHashtags: async (
    _query: string,
    _params?: PaginationParams
  ): Promise<{ hashtags: Hashtag[]; hasMore: boolean; cursor: string | null }> => {
    if (USE_DEMO) return delay({ hashtags: [], hasMore: false, cursor: null });
    throw new Error('Backend not available');
  },

  getTrendingHashtags: async (): Promise<Hashtag[]> => {
    if (USE_DEMO) return delay([]);
    throw new Error('Backend not available');
  },

  getTrendingSounds: async (): Promise<Sound[]> => {
    if (USE_DEMO) return delay([]);
    throw new Error('Backend not available');
  },
};
