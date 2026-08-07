import { apiClient } from './api';

// Demo mode is ON — uses local demo data (no backend required).
const USE_DEMO = true;

export interface ProfileUser {
  id: string;
  username: string;
  displayName: string | null;
  avatarUrl: string | null;
  bio: string | null;
  isVerified: boolean;
  createdAt: string;
  followersCount: number;
  followingCount: number;
  videosCount: number;
}

export interface ProfileVideo {
  id: string;
  thumbnailUrl: string;
  viewsCount: number;
  likesCount: number;
}

interface BackendUser {
  id: string;
  username: string;
  displayName: string | null;
  avatarUrl?: string | null;
  bio?: string | null;
  isVerified?: boolean;
  likeCount?: number | string;
  createdAt?: string;
  _count?: { followers?: number; following?: number; videos?: number };
}

interface BackendVideo {
  id: string;
  thumbnailUrl?: string | null;
  coverUrl?: string | null;
  videoUrl?: string;
  viewCount?: number | string;
  likeCount?: number | string;
}

function mapUser(u: BackendUser): ProfileUser {
  return {
    id: u.id,
    username: u.username,
    displayName: u.displayName ?? u.username,
    avatarUrl: u.avatarUrl ?? null,
    bio: u.bio ?? null,
    isVerified: u.isVerified ?? false,
    createdAt: u.createdAt ?? new Date().toISOString(),
    followersCount: Number(u._count?.followers ?? 0),
    followingCount: Number(u._count?.following ?? 0),
    videosCount: Number(u._count?.videos ?? 0),
  };
}

function mapVideo(v: BackendVideo): ProfileVideo {
  return {
    id: v.id,
    thumbnailUrl: v.thumbnailUrl ?? v.coverUrl ?? `https://picsum.photos/seed/prof-${v.id}/200/300`,
    viewsCount: Number(v.viewCount ?? 0),
    likesCount: Number(v.likeCount ?? 0),
  };
}  /** Uses backend data only; callers render explicit loading/error states. */

// --- Demo data generators -------------------------------------------------------

function generateProfileUser(): ProfileUser {
  return {
    id: 'demo-user',
    username: 'orky_user',
    displayName: 'Orky Creator',
    avatarUrl: 'https://i.pravatar.cc/200?img=47',
    bio: 'Créateur ORKY • Lifestyle & Music 🎵',
    isVerified: true,
    createdAt: new Date(Date.now() - 180 * 86_400_000).toISOString(),
    followersCount: 12800,
    followingCount: 342,
    videosCount: 45,
  };
}

function generateProfileVideos(seed: number, count: number): ProfileVideo[] {
  return Array.from({ length: count }, (_, i) => ({
    id: `profile-video-${seed}-${i}`,
    thumbnailUrl: `https://picsum.photos/seed/pv${seed + i}/200/300`,
    viewsCount: Math.floor(Math.random() * 50000 + 500),
    likesCount: Math.floor(Math.random() * 8000 + 100),
  }));
}

export const profileService = {
  async getMyProfile(): Promise<ProfileUser> {
    if (USE_DEMO) return generateProfileUser();
    const raw = await apiClient.get<{ user: BackendUser }>('/auth/me');
    return mapUser(raw.user);
  },

  async getMyVideos(username: string, limit = 30): Promise<ProfileVideo[]> {
    if (USE_DEMO) return generateProfileVideos(0, Math.min(limit, 12));
    const raw = await apiClient.get<{ videos: BackendVideo[] }>(`/users/${username}/videos`, {
      params: { page: 1, limit },
    });
    return (raw.videos ?? []).map(mapVideo);
  },

  async getLikedVideos(username: string, limit = 30): Promise<ProfileVideo[]> {
    if (USE_DEMO) return generateProfileVideos(100, Math.min(limit, 9));
    const raw = await apiClient.get<{ videos: BackendVideo[] }>(`/users/${encodeURIComponent(username)}/likes`, {
      params: { page: 1, limit },
    });
    return (raw.videos ?? []).map(mapVideo);
  },

  async getLikesCount(username: string): Promise<number> {
    if (USE_DEMO) return 2847;
    const raw = await apiClient.get<{ user?: { likeCount?: number | string } }>(`/users/${encodeURIComponent(username)}`);
    if (raw.user?.likeCount !== undefined) return Number(raw.user.likeCount);
    return Number(raw.user?.likeCount ?? 0);
  },
};
