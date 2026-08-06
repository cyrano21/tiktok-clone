import { apiClient } from './api';

export interface BackendNotification {
  id: string;
  type: string;
  title: string;
  body: string;
  isRead: boolean;
  createdAt: string;
  data?: { actorId?: string; resourceId?: string; resourceType?: string };
  actor?: {
    id: string;
    username: string;
    displayName?: string | null;
    avatarUrl?: string | null;
  } | null;
}

export interface NotificationItem {
  id: string;
  type: 'like' | 'comment' | 'follow' | 'mention';
  username: string;
  avatarUrl: string;
  text: string;
  timestamp: string;
  thumbnailUrl?: string;
  isFollowing?: boolean;
}

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return "à l'instant";
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}j`;
  return new Date(iso).toLocaleDateString('fr-FR');
}

function typeOf(type: string): NotificationItem['type'] {
  const t = type.toUpperCase();
  if (t.includes('LIKE')) return 'like';
  if (t.includes('COMMENT')) return 'comment';
  if (t.includes('FOLLOW') || t.includes('FAN')) return 'follow';
  if (t.includes('MENTION')) return 'mention';
  return 'mention';
}

function toItem(n: BackendNotification): NotificationItem {
  const actorName = n.actor?.username ?? 'un utilisateur';
  const avatarUrl = n.actor?.avatarUrl ?? 'https://i.pravatar.cc/100?img=5';
  const type = typeOf(n.type);

  const texts: Record<NotificationItem['type'], string> = {
    like: 'a aimé votre vidéo',
    comment: `a commenté : "${n.body.slice(0, 60)}"`,
    follow: 'a commencé à vous suivre',
    mention: 'vous a mentionné dans un commentaire',
  };

  return {
    id: n.id,
    type,
    username: actorName,
    avatarUrl,
    text: texts[type],
    timestamp: relativeTime(n.createdAt),
    thumbnailUrl: n.data?.resourceType === 'video' ? 'https://picsum.photos/seed/n/100/140' : undefined,
  };
}

export const notificationService = {
  async getNotifications(limit = 20): Promise<NotificationItem[]> {
    const raw = await apiClient.get<{ notifications: BackendNotification[] }>('/notifications', {
      params: { page: 1, limit },
    });
    return (raw.notifications ?? []).map(toItem);
  },

  async getUnreadCount(): Promise<number> {
    try {
      const raw = await apiClient.get<{ count: number }>('/notifications/unread-count');
      return raw.count ?? 0;
    } catch {
      return 0;
    }
  },

  async markAllAsRead(): Promise<void> {
    await apiClient.patch('/notifications/read-all').catch(() => {});
  },

  async markAsRead(id: string): Promise<void> {
    await apiClient.patch(`/notifications/${id}/read`).catch(() => {});
  },
};
