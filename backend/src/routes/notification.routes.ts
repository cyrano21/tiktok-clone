import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { authMiddleware } from '../middleware/auth';
import { NotificationService } from '../services/notification.service';

export async function notificationRoutes(app: FastifyInstance) {
  app.addHook('preHandler', authMiddleware);

  // Get notifications
  app.get('/', async (req: FastifyRequest, reply: FastifyReply) => {
    const userId = (req as any).userId;
    const { page = '1', limit = '20' } = req.query as any;
    const result = await NotificationService.getForUser(userId, parseInt(page), parseInt(limit));
    return reply.send(result);
  });

  // Get unread count
  app.get('/unread-count', async (req: FastifyRequest, reply: FastifyReply) => {
    const userId = (req as any).userId;
    const count = await NotificationService.getUnreadCount(userId);
    return reply.send({ count });
  });

  // Mark notification as read
  app.patch('/:id/read', async (req: FastifyRequest, reply: FastifyReply) => {
    const userId = (req as any).userId;
    const { id } = req.params as any;
    await NotificationService.markAsRead(userId, id);
    return reply.send({ message: 'Marked as read' });
  });

  // Mark all as read
  app.patch('/read-all', async (req: FastifyRequest, reply: FastifyReply) => {
    const userId = (req as any).userId;
    await NotificationService.markAllAsRead(userId);
    return reply.send({ message: 'All notifications marked as read' });
  });

  // WebSocket for real-time notifications
  app.get('/ws', { websocket: true }, (socket, req) => {
    const userId = (req as any).userId;
    // Subscribe to user's notification channel
    socket.on('close', () => {
      // Cleanup subscription
    });
  });
}
