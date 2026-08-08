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

function isReadOnly(video: Video | undefined) {
  return video?.interactionMode === 'read_only' || video?.sourceType === 'external_reference';
}

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
      void get().loadMore();
    }
  },

  performAction: async (videoId: string, action: FeedAction) => {
    await feedService.performAction(videoId, action);
  },

  toggleLike: (videoId: string) => {
    const before = get().videos.find((video) => video.id === videoId);
    if (!before || isReadOnly(before)) return;
    set((state) => ({
      videos: state.videos.map((video) =>
        video.id === videoId
          ? {
              ...video,
              isLiked: !video.isLiked,
              likesCount: Math.max(0, video.isLiked ? video.likesCount - 1 : video.likesCount + 1),
            }
          : video,
      ),
    }));
    void get().performAction(videoId, 'like').catch(() => {
      set((state) => ({
        videos: state.videos.map((video) =>
          video.id === videoId
            ? { ...video, isLiked: before.isLiked, likesCount: before.likesCount }
            : video,
        ),
      }));
    });
  },

  toggleSave: (videoId: string) => {
    const before = get().videos.find((video) => video.id === videoId);
    if (!before || isReadOnly(before)) return;
    set((state) => ({
      videos: state.videos.map((video) =>
        video.id === videoId
          ? {
              ...video,
              isSaved: !video.isSaved,
              savesCount: Math.max(0, video.isSaved ? video.savesCount - 1 : video.savesCount + 1),
            }
          : video,
      ),
    }));
    void get().performAction(videoId, 'save').catch(() => {
      set((state) => ({
        videos: state.videos.map((video) =>
          video.id === videoId
            ? { ...video, isSaved: before.isSaved, savesCount: before.savesCount }
            : video,
        ),
      }));
    });
  },

  toggleFollow: (userId: string) => {
    const related = get().videos.find((video) => video.user.id === userId);
    if (!related || isReadOnly(related)) return;
    const beforeFollowing = related.user.isFollowing;
    const beforeFollowers = related.user.followersCount;
    set((state) => ({
      videos: state.videos.map((video) =>
        video.user.id === userId
          ? {
              ...video,
              user: {
                ...video.user,
                isFollowing: !video.user.isFollowing,
                followersCount: Math.max(0, video.user.isFollowing
                  ? video.user.followersCount - 1
                  : video.user.followersCount + 1),
              },
            }
          : video,
      ),
    }));
    void get().performAction(userId, 'follow').catch(() => {
      set((state) => ({
        videos: state.videos.map((video) =>
          video.user.id === userId
            ? {
                ...video,
                user: { ...video.user, isFollowing: beforeFollowing, followersCount: beforeFollowers },
              }
            : video,
        ),
      }));
    });
  },
}));
