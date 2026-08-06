import { apiClient } from './api';

export interface Plan {
  id: string;
  name: string;
  priceCents: number;
  priceLabel: string;
  features: string[];
}

export interface SubscriptionInfo {
  id: string;
  plan: string;
  status: string;
  priceCents: number;
  startedAt: string;
  renewsAt: string | null;
  canceledAt: string | null;
}

export interface PublishPlatform {
  id: string;
  name: string;
  icon: string;
  connected: boolean;
}

export interface PublishJob {
  id: string;
  platform: string;
  status: string;
  videoId: string | null;
  videoUrl: string | null;
  caption: string | null;
  scheduledAt: string | null;
  publishedAt: string | null;
  error: string | null;
  createdAt: string;
}

export const saasService = {
  // ---- Billing ----
  getPlans: async (): Promise<Plan[]> => {
    const raw = await apiClient.get<{ plans: Plan[] }>('/billing/plans');
    return raw.plans;
  },

  getCurrent: async (): Promise<{ plan: string; subscription: SubscriptionInfo | null }> => {
    return apiClient.get('/billing/current');
  },

  subscribe: async (plan: string): Promise<{ plan: string; message: string }> => {
    return apiClient.post('/billing/subscribe', { plan });
  },

  cancel: async (): Promise<{ message: string }> => {
    return apiClient.post('/billing/cancel');
  },

  // ---- Cross-posting ----
  getPlatforms: async (): Promise<PublishPlatform[]> => {
    const raw = await apiClient.get<{ platforms: PublishPlatform[] }>('/publish/platforms');
    return raw.platforms;
  },

  getJobs: async (): Promise<PublishJob[]> => {
    const raw = await apiClient.get<{ jobs: PublishJob[] }>('/publish');
    return raw.jobs;
  },

  schedule: async (params: {
    videoId?: string;
    videoUrl?: string;
    caption?: string;
    platforms: string[];
    scheduledAt?: string;
  }): Promise<PublishJob[]> => {
    const raw = await apiClient.post<{ jobs: PublishJob[] }>('/publish', params);
    return raw.jobs;
  },

  cancelJob: async (id: string): Promise<void> => {
    await apiClient.post(`/publish/${id}/cancel`);
  },
};
