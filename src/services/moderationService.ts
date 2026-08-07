import { apiClient } from './api';

export type ModerationTargetType = 'user' | 'video' | 'comment' | 'message' | 'live';
export type ReportCategory =
  | 'spam'
  | 'harassment'
  | 'hate'
  | 'violence'
  | 'sexual_content'
  | 'minor_safety'
  | 'self_harm'
  | 'illegal'
  | 'copyright'
  | 'impersonation'
  | 'privacy'
  | 'misinformation'
  | 'other';

export const moderationService = {
  report: async (params: {
    targetType: ModerationTargetType;
    targetId: string;
    category: ReportCategory;
    reason?: string;
  }) => {
    return apiClient.post('/moderation/reports', params);
  },

  blockUser: async (userId: string) => {
    return apiClient.post(`/moderation/blocks/${userId}`);
  },

  unblockUser: async (userId: string) => {
    return apiClient.delete(`/moderation/blocks/${userId}`);
  },

  getBlocks: async () => {
    return apiClient.get('/moderation/blocks');
  },

  getMyReports: async () => {
    return apiClient.get('/moderation/reports/mine');
  },

  appeal: async (moderationActionId: string, reason: string) => {
    return apiClient.post('/moderation/appeals', { moderationActionId, reason });
  },
};
