import { useFeedStore } from '../../src/store/feedStore';
import { feedService } from '../../src/services/feedService';

describe('feedStore', () => {
  beforeEach(() => {
    jest.spyOn(feedService, 'performAction').mockResolvedValue(undefined);
    jest.spyOn(feedService, 'getFeed').mockResolvedValue({ videos: [], cursor: null, hasMore: false });
    useFeedStore.setState({
      videos: [],
      currentIndex: 0,
      loadingState: 'idle',
      error: null,
      hasMore: true,
      cursor: null,
    });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('should initialize with default values', () => {
    const state = useFeedStore.getState();
    expect(state.videos).toEqual([]);
    expect(state.currentIndex).toBe(0);
    expect(state.loadingState).toBe('idle');
    expect(state.hasMore).toBe(true);
  });

  it('should set current index', () => {
    useFeedStore.getState().setCurrentIndex(5);
    expect(useFeedStore.getState().currentIndex).toBe(5);
  });

  it('should toggle like on a video', () => {
    const mockVideo = {
      id: 'v1',
      user: { id: 'u1', username: 'user1', displayName: 'User 1', avatarUrl: '', isVerified: false, followerCount: 100, followingCount: 50, videoCount: 10, likeCount: 500, bio: '', isPrivate: false, isFollowing: false, created_at: '' },
      title: '', description: 'Test', videoUrl: '', thumbnailUrl: '', duration: 15, width: 1080, height: 1920, visibility: 'public' as const, allowDuet: true, allowStitch: true, allowComment: true,
      viewsCount: 1000, likesCount: 50, commentsCount: 10, sharesCount: 20, savesCount: 5, isLiked: false, isSaved: false,
      hashtags: [], mentions: [], engagementScore: 0.5, createdAt: new Date().toISOString(),
    };

    useFeedStore.setState({ videos: [mockVideo] });

    useFeedStore.getState().toggleLike('v1');
    const video = useFeedStore.getState().videos[0];
    expect(video.isLiked).toBe(true);
    expect(video.likesCount).toBe(51);

    useFeedStore.getState().toggleLike('v1');
    const video2 = useFeedStore.getState().videos[0];
    expect(video2.isLiked).toBe(false);
    expect(video2.likesCount).toBe(50);
  });
});
