import { apiClient } from './api';

export interface LiveUser {
  id: string;
  username: string;
  displayName: string | null;
  avatarUrl: string | null;
  isVerified: boolean;
}

export interface LiveStreamSummary {
  id: string;
  userId: string;
  title: string;
  status: 'live' | 'ended' | string;
  viewerCount: number;
  likeCount: number;
  thumbnailUrl: string | null;
  startedAt: string;
  endedAt: string | null;
  user: LiveUser;
}

export interface LiveConnection {
  serverUrl: string;
  roomName: string;
  token: string;
  role: 'host' | 'viewer';
}

export interface LiveSession {
  stream: LiveStreamSummary;
  connection: LiveConnection;
}

export const liveService = {
  async list(page = 1, limit = 20): Promise<LiveStreamSummary[]> {
    const response = await apiClient.get<{ streams: LiveStreamSummary[] }>('/live', {
      params: { page, limit },
    });
    return response.streams ?? [];
  },

  async get(streamId: string): Promise<LiveStreamSummary> {
    const response = await apiClient.get<{ stream: LiveStreamSummary }>(`/live/${streamId}`);
    return response.stream;
  },

  async start(title: string): Promise<LiveSession> {
    return apiClient.post('/live/start', { title });
  },

  async join(streamId: string): Promise<LiveSession> {
    return apiClient.post(`/live/${streamId}/join`);
  },

  async end(streamId: string): Promise<void> {
    await apiClient.post(`/live/${streamId}/end`);
  },
};
