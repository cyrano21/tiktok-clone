import { create } from 'zustand';
import { Video, LoadingState, FeedAction } from '@/types';
import { feedService } from '@/services/feedService';

interface FeedState {
  videos: Video[];
  currentIndex: number;
  loadingState: LoadingState;
  error: string | null;
  cursor: string | null;
  hasMore: boolean;
}

interface FeedActions {
  loadFeed: () => Promise<void>;
  refreshFeed: () => Promise<void>;
  loadMore: () => Promise<void>;
  setCurrentIndex: (index: number) => void;
  performAction: (videoId: string, action: FeedAction) => Promise<void>;
  toggleLike: (videoId: string) => void;
  toggleSave: (videoId: string) => void;
  toggleFollow: (userId: string) => void;
}

type FeedStore = FeedState & FeedActions;

export const useFeedStore = create<FeedStore>((set, get) => ({
  videos: [],
  currentIndex: 0,
  loadingState: 'idle',
  error: null,
  cursor: null,
  hasMore: true,

  loadFeed: async () => {
    const { loadingState } = get();
    if (loadingState === 'loading') return;

    set({ loadingState: 'loading', error: null });
    try {
      const response = await feedService.getFeed({ limit: 10 });
      set({
        videos: response.videos,
        cursor: response.cursor,
        hasMore: response.hasMore,
        loadingState: 'idle',
      });
    } catch (error) {
      set({
        loadingState: 'error',
        error: error instanceof Error ? error.message : 'Failed to load feed',
      });
    }
  },

  refreshFeed: async () => {
    set({ loadingState: 'refreshing', error: null });
    try {
      const response = await feedService.getFeed({ limit: 10 });
      set({
        videos: response.videos,
        cursor: response.cursor,
        hasMore: response.hasMore,
        loadingState: 'idle',
        currentIndex: 0,
      });
    } catch (error) {
      set({
        loadingState: 'error',
        error: error instanceof Error ? error.message : 'Failed to refresh feed',
      });
    }
  },

  loadMore: async () => {
    const { loadingState, hasMore, cursor } = get();
    if (loadingState === 'loadingMore' || !hasMore) return;

    set({ loadingState: 'loadingMore' });
    try {
      const response = await feedService.getFeed({ cursor: cursor ?? undefined, limit: 10 });
      set((state) => ({
        videos: [...state.videos, ...response.videos],
        cursor: response.cursor,
        hasMore: response.hasMore,
        loadingState: 'idle',
      }));
    } catch (error) {
      set({
        loadingState: 'error',
        error: error instanceof Error ? error.message : 'Failed to load more',
      });
    }
  },

  setCurrentIndex: (index: number) => {
    set({ currentIndex: index });
    const { videos } = get();
    if (index >= videos.length - 3) {
      get().loadMore();
    }
  },

  performAction: async (videoId: string, action: FeedAction) => {
    try {
      await feedService.performAction(videoId, action);
    } catch (error) {
      console.error(`Failed to perform action ${action}:`, error);
    }
  },

  toggleLike: (videoId: string) => {
    set((state) => ({
      videos: state.videos.map((video) =>
        video.id === videoId
          ? {
              ...video,
              isLiked: !video.isLiked,
              likesCount: video.isLiked ? video.likesCount - 1 : video.likesCount + 1,
            }
          : video
      ),
    }));
    get().performAction(videoId, 'like');
  },

  toggleSave: (videoId: string) => {
    set((state) => ({
      videos: state.videos.map((video) =>
        video.id === videoId
          ? {
              ...video,
              isSaved: !video.isSaved,
              savesCount: video.isSaved ? video.savesCount - 1 : video.savesCount + 1,
            }
          : video
      ),
    }));
    get().performAction(videoId, 'save');
  },

  toggleFollow: (userId: string) => {
    set((state) => ({
      videos: state.videos.map((video) =>
        video.user.id === userId
          ? {
              ...video,
              user: {
                ...video.user,
                isFollowing: !video.user.isFollowing,
                followersCount: video.user.isFollowing
                  ? video.user.followersCount - 1
                  : video.user.followersCount + 1,
              },
            }
          : video
      ),
    }));
    get().performAction(userId, 'follow');
  },
}));
