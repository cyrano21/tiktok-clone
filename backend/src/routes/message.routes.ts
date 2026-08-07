import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { authMiddleware } from '../middleware/auth';
import { prisma } from '../config/database';

async function getConversationForUser(conversationId: string, userId: string) {
  return prisma.conversation.findFirst({
    where: {
      id: conversationId,
      OR: [{ participant1Id: userId }, { participant2Id: userId }],
    },
    select: { id: true, participant1Id: true, participant2Id: true },
  });
}

async function usersAreBlocked(userId: string, otherUserId: string) {
  return Boolean(await prisma.userBlock.findFirst({
    where: {
      OR: [
        { blockerId: userId, blockedId: otherUserId },
        { blockerId: otherUserId, blockedId: userId },
      ],
    },
    select: { id: true },
  }));
}

export async function messageRoutes(app: FastifyInstance) {
  app.addHook('preHandler', authMiddleware);

  app.get('/conversations', async (req: FastifyRequest, reply: FastifyReply) => {
    const userId = (req as any).userId as string;
    const conversations = await prisma.conversation.findMany({
      where: { OR: [{ participant1Id: userId }, { participant2Id: userId }] },
      orderBy: { lastMessageAt: 'desc' },
      include: {
        participant1: { select: { id: true, username: true, displayName: true, avatarUrl: true } },
        participant2: { select: { id: true, username: true, displayName: true, avatarUrl: true } },
        messages: { orderBy: { createdAt: 'desc' }, take: 1 },
      },
    });
    return reply.send({ conversations });
  });

  app.get('/conversations/:id', async (req: FastifyRequest, reply: FastifyReply) => {
    const userId = (req as any).userId as string;
    const { id } = z.object({ id: z.string().uuid() }).parse(req.params);
    const { page, limit } = z.object({
      page: z.coerce.number().int().min(1).default(1),
      limit: z.coerce.number().int().min(1).max(100).default(50),
    }).parse(req.query);

    const conversation = await getConversationForUser(id, userId);
    if (!conversation) return reply.status(404).send({ error: 'NOT_FOUND', message: 'Conversation not found' });

    const messages = await prisma.message.findMany({
      where: { conversationId: id },
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
      include: { sender: { select: { id: true, username: true, displayName: true, avatarUrl: true } } },
    });
    return reply.send({ messages: messages.reverse(), page, limit });
  });

  app.post('/conversations/:id', async (req: FastifyRequest, reply: FastifyReply) => {
    const userId = (req as any).userId as string;
    const { id } = z.object({ id: z.string().uuid() }).parse(req.params);
    const body = z.object({
      text: z.string().trim().max(5000).optional(),
      type: z.enum(['text', 'image', 'video', 'audio']).default('text'),
    }).parse(req.body);
    if (body.type === 'text' && !body.text) {
      return reply.status(400).send({ error: 'BAD_REQUEST', message: 'Text message cannot be empty' });
    }

    const conversation = await getConversationForUser(id, userId);
    if (!conversation) return reply.status(404).send({ error: 'NOT_FOUND', message: 'Conversation not found' });

    const otherUserId = conversation.participant1Id === userId ? conversation.participant2Id : conversation.participant1Id;
    if (otherUserId !== userId && await usersAreBlocked(userId, otherUserId)) {
      return reply.status(403).send({ error: 'USER_BLOCKED', message: 'Messaging is disabled between these accounts' });
    }

    const message = await prisma.message.create({
      data: { conversationId: id, senderId: userId, content: body.text, type: body.type },
      include: { sender: { select: { id: true, username: true, displayName: true, avatarUrl: true } } },
    });
    await prisma.conversation.update({ where: { id }, data: { lastMessageAt: new Date() } });
    return reply.status(201).send({ message });
  });

  app.post('/conversations', async (req: FastifyRequest, reply: FastifyReply) => {
    const userId = (req as any).userId as string;
    const { participantIds } = z.object({ participantIds: z.array(z.string().uuid()).length(1) }).parse(req.body);
    const otherUserId = participantIds[0];
    if (otherUserId === userId) {
      return reply.status(400).send({ error: 'BAD_REQUEST', message: 'Cannot create a conversation with yourself' });
    }

    const otherUser = await prisma.user.findUnique({ where: { id: otherUserId }, select: { id: true, isBanned: true } });
    if (!otherUser || otherUser.isBanned) return reply.status(404).send({ error: 'NOT_FOUND', message: 'User not found' });
    if (await usersAreBlocked(userId, otherUserId)) {
      return reply.status(403).send({ error: 'USER_BLOCKED', message: 'Messaging is disabled between these accounts' });
    }

    const existing = await prisma.conversation.findFirst({
      where: {
        OR: [
          { participant1Id: userId, participant2Id: otherUserId },
          { participant1Id: otherUserId, participant2Id: userId },
        ],
      },
      include: {
        participant1: { select: { id: true, username: true, displayName: true, avatarUrl: true } },
        participant2: { select: { id: true, username: true, displayName: true, avatarUrl: true } },
      },
    });
    if (existing) return reply.send({ conversation: existing, existing: true });

    const [participant1Id, participant2Id] = [userId, otherUserId].sort();
    const conversation = await prisma.conversation.create({
      data: { participant1Id, participant2Id },
      include: {
        participant1: { select: { id: true, username: true, displayName: true, avatarUrl: true } },
        participant2: { select: { id: true, username: true, displayName: true, avatarUrl: true } },
      },
    });
    return reply.status(201).send({ conversation });
  });

  app.get('/ws', { websocket: true }, (socket) => {
    socket.on('message', (data) => {
      if (data.toString() === 'ping') socket.send('pong');
    });
  });
}
