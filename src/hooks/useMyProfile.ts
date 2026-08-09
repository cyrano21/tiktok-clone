import { useEffect, useState } from 'react';
import { profileService, ProfileUser, ProfileVideo } from '@/services/profileService';
import { useSessionStore } from '@/store/sessionStore';

export interface ProfileView {
  user: ProfileUser;
  videos: ProfileVideo[];
  likesCount: number;
  likedVideos: ProfileVideo[];
  live: boolean;
  loading: boolean;
  error: string | null;
}

function fallbackProfile(session: ReturnType<typeof useSessionStore.getState>, videos: ProfileVideo[]): ProfileView {
  return {
    user: {
      id: session.userId || 'guest',
      username: session.username || 'guest',
      displayName: session.displayName || 'Guest',
      avatarUrl: session.avatarUrl || null,
      bio: null,
      isVerified: false,
      createdAt: '',
      followersCount: 0,
      followingCount: 0,
      videosCount: videos.length,
    },
    videos,
    likesCount: 0,
    likedVideos: [],
    live: false,
    loading: false,
    error: null,
  };
}

/** Loads the real account once authentication is available and refreshes on user changes. */
export function useMyProfile(): ProfileView {
  const session = useSessionStore();
  const [view, setView] = useState<ProfileView>(() => fallbackProfile(session, []));

  useEffect(() => {
    let mounted = true;

    // Guests have no token yet: show the guest shell instead of a 401 error.
    if (!session.authenticated) {
      setView(fallbackProfile(session, []));
      return () => {
        mounted = false;
      };
    }

    setView((current) => ({ ...current, loading: true, error: null }));
    (async () => {
      try {
        // Attempt the real API; in demo mode profileService returns local data immediately.
        const user = await profileService.getMyProfile();
        const [videos, likedVideosResult, likesCount] = await Promise.all([
          profileService.getMyVideos(user.username, 30),
          profileService.getLikedVideos(user.username, 30),
          profileService.getLikesCount(user.username),
        ]);
        if (mounted) setView({ user, videos, likedVideos: likedVideosResult, likesCount, live: true, loading: false, error: null });
      } catch {
        if (mounted) setView({ ...fallbackProfile(session, []), error: 'Impossible de charger le profil. Réessaie.' });
      }
    })();

    return () => {
      mounted = false;
    };
  }, [session.authenticated, session.userId, session.username, session.displayName, session.avatarUrl]);

  return view;
}
