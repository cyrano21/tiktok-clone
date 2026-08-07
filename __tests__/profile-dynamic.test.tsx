import React from 'react';
import { act, render, screen, waitFor } from '@testing-library/react';
import { useMyProfile } from '../src/hooks/useMyProfile';
import { profileService } from '../src/services/profileService';
import { useSessionStore } from '../src/store/sessionStore';

function ProfileProbe() {
  const profile = useMyProfile();
  return <output>{`${profile.user.username}|${profile.user.followersCount}|${profile.live ? 'live' : 'fallback'}`}</output>;
}

describe('dynamic account profile', () => {
  beforeEach(() => {
    useSessionStore.setState({
      userId: 'me',
      username: 'mon_compte',
      displayName: 'Mon Compte',
      avatarUrl: '',
      isSeller: true,
      sellerId: 'seller-urban',
      hydrated: true,
      authenticated: true,
    });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('refreshes the profile when the active session user changes', async () => {
    jest.spyOn(profileService, 'getMyProfile')
      .mockResolvedValueOnce({
        id: 'user-1', username: 'alice', displayName: 'Alice', avatarUrl: null,
        bio: 'Hello', isVerified: false, createdAt: '2026-01-01',
        followersCount: 12, followingCount: 4, videosCount: 1,
      })
      .mockResolvedValueOnce({
        id: 'user-2', username: 'bob', displayName: 'Bob', avatarUrl: null,
        bio: 'Bonjour', isVerified: false, createdAt: '2026-01-02',
        followersCount: 98, followingCount: 7, videosCount: 3,
      });
    jest.spyOn(profileService, 'getMyVideos').mockResolvedValue([]);
    jest.spyOn(profileService, 'getLikedVideos').mockResolvedValue([]);
    jest.spyOn(profileService, 'getLikesCount').mockResolvedValue(0);

    render(<ProfileProbe />);
    await waitFor(() => expect(screen.getByText('alice|12|live')).toBeTruthy());

    act(() => {
      useSessionStore.getState().setUser({
        id: 'user-2', username: 'bob', email: null, displayName: 'Bob', avatarUrl: null,
      });
    });

    await waitFor(() => expect(screen.getByText('bob|98|live')).toBeTruthy());
    expect(profileService.getMyProfile).toHaveBeenCalledTimes(2);
  });

  it('does not invent follower or like totals in fallback mode', async () => {
    jest.spyOn(profileService, 'getMyProfile').mockRejectedValue(new Error('offline'));
    act(() => useSessionStore.setState({ authenticated: false }));
    render(<ProfileProbe />);

    await waitFor(() => expect(screen.getByText('mon_compte|0|fallback')).toBeTruthy());
  });
});
