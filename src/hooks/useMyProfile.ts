import { useEffect, useState } from 'react';
import { profileService, ProfileUser, ProfileVideo } from '@/services/profileService';
import { useSessionStore } from '@/store/sessionStore';
import { useStudioStore } from '@/store/studioStore';

export interface ProfileView {
  user: ProfileUser;
  videos: ProfileVideo[];
  likesCount: number;
  live: boolean; // true when data comes from the real backend
}

/** Load the real profile; falls back to demo data when unauthenticated or offline. */
export function useMyProfile(): ProfileView {
  const session = useSessionStore((s) => s);
  const demoPosts = useStudioStore((s) => s.posts);

  const [view, setView] = useState<ProfileView>(() => ({
    user: {
      id: session.userId,
      username: session.username,
      displayName: session.displayName,
      avatarUrl: session.avatarUrl,
      bio: 'Creative content creator 🎬\nMaking videos that inspire ✨',
      isVerified: false,
      createdAt: new Date().toISOString(),
      followersCount: 14200,
      followingCount: 128,
      videosCount: demoPosts.length,
    },
    videos: demoPosts.slice(0, 9).map((p) => ({
      id: p.id,
      thumbnailUrl: p.thumbnailUrl,
      viewsCount: p.metrics.views,
      likesCount: p.metrics.likes,
    })),
    likesCount: 892000,
    live: false,
  }));

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const user = await profileService.getMyProfile();
        const [videos, likesCount] = await Promise.all([
          profileService.getMyVideos(user.username, 30),
          profileService.getLikesCount(user.username),
        ]);
        if (mounted) setView({ user, videos, likesCount, live: true });
      } catch {
        // keep demo fallback
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  return view;
}
