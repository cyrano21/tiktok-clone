jest.mock('@/services/feedService', () => ({
  feedService: {
    getFeed: jest.fn(),
    performAction: jest.fn(),
  },
}));

import { feedService } from '@/services/feedService';
import { useFeedStore } from '@/store/feedStore';

const nativeVideo = {
  id: '11111111-1111-4111-8111-111111111111',
  user: { id: '22222222-2222-4222-8222-222222222222', username: 'alice', displayName: 'Alice', avatarUrl: '', bio: '', followersCount: 10, followingCount: 0, likesCount: 0, videosCount: 1, isVerified: false, isFollowing: false, isFollowedBy: false, createdAt: new Date(0).toISOString() },
  videoUrl: '/v1/media/videos/11111111-1111-4111-8111-111111111111', thumbnailUrl: '', description: '', likesCount: 5, commentsCount: 0, sharesCount: 0, savesCount: 2, viewsCount: 10, duration: 5, isLiked: false, isSaved: false, hashtags: [], sound: null, location: null, createdAt: new Date(0).toISOString(), allowComments: true, allowDuet: true, allowStitch: true, sourceType: 'native', interactionMode: 'full',
} as any;

const externalVideo = {
  ...nativeVideo,
  id: 'scraper-123',
  user: { ...nativeVideo.user, id: 'external:alice' },
  sourceType: 'external_reference',
  interactionMode: 'read_only',
} as any;

describe('feed reality hardening', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    useFeedStore.setState({ videos: [], currentIndex: 0, loadingState: 'idle', error: null, cursor: null, hasMore: false });
  });

  it('leaves external references completely untouched (no local toggle, no social API)', () => {
    useFeedStore.setState({ videos: [externalVideo] });
    useFeedStore.getState().toggleLike(externalVideo.id);
    useFeedStore.getState().toggleSave(externalVideo.id);
    useFeedStore.getState().toggleFollow(externalVideo.user.id);

    const video = useFeedStore.getState().videos[0];
    // External references are strictly read-only: not even an optimistic local
    // toggle is allowed, and no ORKY social API is ever called.
    expect(video.isLiked).toBe(false);
    expect(video.likesCount).toBe(5);
    expect(video.isSaved).toBe(false);
    expect(video.savesCount).toBe(2);
    expect(video.user.isFollowing).toBe(false);
    expect(feedService.performAction).not.toHaveBeenCalled();
  });

  it('rolls an optimistic like back when the backend rejects it', async () => {
    (feedService.performAction as jest.Mock).mockRejectedValueOnce(new Error('network'));
    useFeedStore.setState({ videos: [nativeVideo] });
    useFeedStore.getState().toggleLike(nativeVideo.id);

    expect(useFeedStore.getState().videos[0].isLiked).toBe(true);
    expect(useFeedStore.getState().videos[0].likesCount).toBe(6);
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(useFeedStore.getState().videos[0].isLiked).toBe(false);
    expect(useFeedStore.getState().videos[0].likesCount).toBe(5);
  });
});
