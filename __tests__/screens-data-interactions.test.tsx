import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { NavigationProvider } from '../src/navigation/NavigationContext';
import { ProfileScreen } from '../src/screens/ProfileScreen';
import { ExploreScreen } from '../src/screens/ExploreScreen';
import { useMyProfile } from '../src/hooks/useMyProfile';
import { discoverService } from '../src/services/discoverService';

jest.mock('../src/hooks/useMyProfile', () => ({
  useMyProfile: jest.fn(),
}));

jest.mock('../src/services/discoverService', () => ({
  discoverService: { getVideos: jest.fn() },
}));

const mockedUseMyProfile = useMyProfile as jest.MockedFunction<typeof useMyProfile>;
const mockedGetDiscoverVideos = discoverService.getVideos as jest.MockedFunction<typeof discoverService.getVideos>;

describe('content controls', () => {
  beforeEach(() => {
    mockedUseMyProfile.mockReturnValue({
      user: {
        id: 'user-1', username: 'creator', displayName: 'Creator', avatarUrl: null,
        bio: 'Bio', isVerified: false, createdAt: '2026-01-01',
        followersCount: 10, followingCount: 2, videosCount: 1,
      },
      videos: [{ id: 'own-video', thumbnailUrl: 'https://example.com/own.jpg', viewsCount: 1000, likesCount: 10 }],
      likedVideos: [{ id: 'liked-video', thumbnailUrl: 'https://example.com/liked.jpg', viewsCount: 2000, likesCount: 20 }],
      likesCount: 10,
      live: true,
      loading: false,
    });
    mockedGetDiscoverVideos.mockImplementation(async (category) => category === 'music'
      ? [{ id: 'music-video', title: 'New sound', thumbnailUrl: 'https://example.com/music.jpg', viewsCount: '2K', categories: [] }]
      : [
        { id: 'all-video', title: 'Dance Challenge', thumbnailUrl: 'https://example.com/all.jpg', viewsCount: '1K', categories: [] },
        { id: 'comedy-video', title: 'Comedy Skit', thumbnailUrl: 'https://example.com/comedy.jpg', viewsCount: '3K', categories: [] },
      ]);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('switches the profile grid from own videos to liked videos', () => {
    render(<NavigationProvider><ProfileScreen /></NavigationProvider>);

    expect(screen.getByTestId('profile-video-own-video')).toBeTruthy();
    expect(screen.queryByTestId('profile-video-liked-video')).toBeNull();

    fireEvent.click(screen.getByText('♥ Liked'));

    expect(screen.getByTestId('profile-video-liked-video')).toBeTruthy();
    expect(screen.queryByTestId('profile-video-own-video')).toBeNull();
  });

  it('reloads Discover cards from the backend when a category is selected', async () => {
    render(<NavigationProvider><ExploreScreen /></NavigationProvider>);

    await waitFor(() => expect(screen.getByTestId('discover-video-all-video')).toBeTruthy());
    expect(screen.getByTestId('discover-video-comedy-video')).toBeTruthy();

    fireEvent.click(screen.getByText('Music'));

    await waitFor(() => expect(screen.getByTestId('discover-video-music-video')).toBeTruthy());
    expect(screen.queryByTestId('discover-video-comedy-video')).toBeNull();
    expect(mockedGetDiscoverVideos).toHaveBeenLastCalledWith('music');
  });
});
