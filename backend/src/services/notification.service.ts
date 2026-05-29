import { prisma } from '../config/database';
import { redis } from '../config/redis';

export class NotificationService {
  static async create(params: {
    userId: string;
    type: string;
    title: string;
    body: string;
    actorId?: string;
    resourceId?: string;
    resourceType?: string;
  }) {
    const notification = await prisma.notification.create({
      data: {
        userId: params.userId,
        type: params.type,
        title: params.title,
        body: params.body,
        actorId: params.actorId,
        resourceId: params.resourceId,
        resourceType: params.resourceType,
      },
    });

    // Publish to real-time channel
    await redis.publish(`notifications:${params.userId}`, JSON.stringify(notification));

    // Increment unread count
    await redis.incr(`unread_notifications:${params.userId}`);

    return notification;
  }

  static async getForUser(userId: string, page: number = 1, limit: number = 20) {
    const offset = (page - 1) * limit;

    const [notifications, total] = await Promise.all([
      prisma.notification.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        skip: offset,
        take: limit,
        include: {
          actor: { select: { id: true, username: true, displayName: true, avatar: true } },
        },
      }),
      prisma.notification.count({ where: { userId } }),
    ]);

    return { notifications, total, page, limit };
  }

  static async markAsRead(userId: string, notificationId: string) {
    await prisma.notification.update({
      where: { id: notificationId, userId },
      data: { readAt: new Date() },
    });

    // Decrement unread count
    const count = await redis.decr(`unread_notifications:${userId}`);
    if (count < 0) await redis.set(`unread_notifications:${userId}`, '0');
  }

  static async markAllAsRead(userId: string) {
    await prisma.notification.updateMany({
      where: { userId, readAt: null },
      data: { readAt: new Date() },
    });

    await redis.set(`unread_notifications:${userId}`, '0');
  }

  static async getUnreadCount(userId: string): Promise<number> {
    const count = await redis.get(`unread_notifications:${userId}`);
    return parseInt(count || '0', 10);
  }

  // Notification type helpers
  static async notifyLike(videoOwnerId: string, actorId: string, videoId: string) {
    if (videoOwnerId === actorId) return;
    await this.create({
      userId: videoOwnerId,
      type: 'LIKE',
      title: 'New like',
      body: 'Someone liked your video',
      actorId,
      resourceId: videoId,
      resourceType: 'video',
    });
  }

  static async notifyComment(videoOwnerId: string, actorId: string, videoId: string, commentText: string) {
    if (videoOwnerId === actorId) return;
    await this.create({
      userId: videoOwnerId,
      type: 'COMMENT',
      title: 'New comment',
      body: commentText.substring(0, 100),
      actorId,
      resourceId: videoId,
      resourceType: 'video',
    });
  }

  static async notifyFollow(userId: string, actorId: string) {
    if (userId === actorId) return;
    await this.create({
      userId,
      type: 'FOLLOW',
      title: 'New follower',
      body: 'Someone started following you',
      actorId,
      resourceId: actorId,
      resourceType: 'user',
    });
  }
}
