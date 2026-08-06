import { apiClient } from './api';

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
}

/** Throws when unauthenticated — caller keeps the demo fallback. */
export const profileService = {
  async getMyProfile(): Promise<ProfileUser> {
    const raw = await apiClient.get<{ user: BackendUser }>('/auth/me');
    return mapUser(raw.user);
  },

  async getMyVideos(username: string, limit = 30): Promise<ProfileVideo[]> {
    const raw = await apiClient.get<{ videos: BackendVideo[] }>(`/users/${username}/videos`, {
      params: { page: 1, limit },
    });
    return (raw.videos ?? []).map(mapVideo);
  },

  async getLikesCount(username: string): Promise<number> {
    const raw = await apiClient.get<{ videos: BackendVideo[] }>(`/users/${username}/videos`, {
      params: { page: 1, limit: 100 },
    });
    return (raw.videos ?? []).reduce((sum, v) => sum + Number(v.likeCount ?? 0), 0);
  },
};
