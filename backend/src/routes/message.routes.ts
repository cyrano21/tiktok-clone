import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { authMiddleware } from '../middleware/auth';
import { prisma } from '../config/database';

export async function messageRoutes(app: FastifyInstance) {
  app.addHook('preHandler', authMiddleware);

  // Get conversations
  app.get('/conversations', async (req: FastifyRequest, reply: FastifyReply) => {
    const userId = (req as any).userId;
    const conversations = await prisma.conversation.findMany({
      where: { participants: { some: { userId } } },
      orderBy: { updatedAt: 'desc' },
      include: {
        participants: {
          include: { user: { select: { id: true, username: true, displayName: true, avatar: true } } },
        },
        messages: { orderBy: { createdAt: 'desc' }, take: 1 },
      },
    });
    return reply.send({ conversations });
  });

  // Get messages in a conversation
  app.get('/conversations/:id', async (req: FastifyRequest, reply: FastifyReply) => {
    const { id } = req.params as any;
    const { page = '1', limit = '50' } = req.query as any;
    const offset = (parseInt(page) - 1) * parseInt(limit);
    const messages = await prisma.message.findMany({
      where: { conversationId: id },
      orderBy: { createdAt: 'desc' },
      skip: offset,
      take: parseInt(limit),
      include: { sender: { select: { id: true, username: true, displayName: true, avatar: true } } },
    });
    return reply.send({ messages: messages.reverse(), page: parseInt(page), limit: parseInt(limit) });
  });

  // Send message
  app.post('/conversations/:id', async (req: FastifyRequest, reply: FastifyReply) => {
    const { id } = req.params as any;
    const userId = (req as any).userId;
    const { text, type = 'text' } = req.body as any;
    const message = await prisma.message.create({
      data: { conversationId: id, senderId: userId, text, type },
      include: { sender: { select: { id: true, username: true, displayName: true, avatar: true } } },
    });
    await prisma.conversation.update({ where: { id }, data: { updatedAt: new Date() } });
    return reply.status(201).send({ message });
  });

  // Create conversation
  app.post('/conversations', async (req: FastifyRequest, reply: FastifyReply) => {
    const userId = (req as any).userId;
    const { participantIds } = req.body as any;
    const allParticipants = [userId, ...participantIds];
    const conversation = await prisma.conversation.create({
      data: {
        participants: { create: allParticipants.map((id: string) => ({ userId: id })) },
      },
      include: {
        participants: {
          include: { user: { select: { id: true, username: true, displayName: true, avatar: true } } },
        },
      },
    });
    return reply.status(201).send({ conversation });
  });

  // WebSocket for real-time messaging
  app.get('/ws', { websocket: true }, (socket, req) => {
    const userId = (req as any).userId;
    socket.on('message', (data) => {
      // Handle real-time message delivery
      const parsed = JSON.parse(data.toString());
      // Broadcast to conversation participants
    });
    socket.on('close', () => {
      // Cleanup
    });
  });
}
