import { apiClient } from './api';

// Demo identity data is explicit opt-in only. Missing configuration uses the real API.
const USE_DEMO = process.env.NEXT_PUBLIC_USE_DEMO === 'true';

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
    createdAt: u.createdAt ?? new Date(0).toISOString(),
    followersCount: Number(u._count?.followers ?? 0),
    followingCount: Number(u._count?.following ?? 0),
    videosCount: Number(u._count?.videos ?? 0),
  };
}

function mapVideo(v: BackendVideo): ProfileVideo {
  return {
    id: v.id,
    // Always route canonical ORKY media through the private-bucket gateway.
    thumbnailUrl: `/v1/media/thumbnails/${encodeURIComponent(v.id)}`,
    viewsCount: Number(v.viewCount ?? 0),
    likesCount: Number(v.likeCount ?? 0),
  };
}

function demoProfileUser(): ProfileUser {
  return {
    id: 'demo-user', username: 'orky_demo', displayName: 'Compte de démonstration', avatarUrl: null,
    bio: 'Données de démonstration explicites', isVerified: false, createdAt: new Date(0).toISOString(),
    followersCount: 0, followingCount: 0, videosCount: 0,
  };
}

export const profileService = {
  async getMyProfile(): Promise<ProfileUser> {
    if (USE_DEMO) return demoProfileUser();
    const raw = await apiClient.get<{ user: BackendUser }>('/auth/me');
    return mapUser(raw.user);
  },

  async getMyVideos(username: string, limit = 30): Promise<ProfileVideo[]> {
    if (USE_DEMO) return [];
    const raw = await apiClient.get<{ videos: BackendVideo[] }>(`/users/${encodeURIComponent(username)}/videos`, { params: { page: 1, limit } });
    return (raw.videos ?? []).map(mapVideo);
  },

  async getLikedVideos(username: string, limit = 30): Promise<ProfileVideo[]> {
    if (USE_DEMO) return [];
    const raw = await apiClient.get<{ videos: BackendVideo[] }>(`/users/${encodeURIComponent(username)}/likes`, { params: { page: 1, limit } });
    return (raw.videos ?? []).map(mapVideo);
  },

  async getLikesCount(username: string): Promise<number> {
    if (USE_DEMO) return 0;
    const raw = await apiClient.get<{ user?: { likeCount?: number | string } }>(`/users/${encodeURIComponent(username)}`);
    return Number(raw.user?.likeCount ?? 0);
  },
};
