import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { authMiddleware, optionalAuth } from '../middleware/auth';
import { prisma } from '../config/database';

export async function liveRoutes(app: FastifyInstance) {
  // Start live stream
  app.post('/start', { preHandler: authMiddleware }, async (req: FastifyRequest, reply: FastifyReply) => {
    const userId = (req as any).userId;
    const { title, description } = req.body as any;
    const stream = await prisma.liveStream.create({
      data: { userId, title, status: 'live', streamKey: require('uuid').v4() },
    });
    return reply.status(201).send({ stream });
  });

  // End live stream
  app.post('/:id/end', { preHandler: authMiddleware }, async (req: FastifyRequest, reply: FastifyReply) => {
    const { id } = req.params as any;
    const userId = (req as any).userId;
    const stream = await prisma.liveStream.findUnique({ where: { id } });
    if (!stream || stream.userId !== userId) {
      return reply.status(403).send({ error: 'FORBIDDEN', message: 'Not authorized' });
    }
    await prisma.liveStream.update({ where: { id }, data: { status: 'ended', endedAt: new Date() } });
    return reply.send({ message: 'Stream ended' });
  });

  // Get live stream details
  app.get('/:id', { preHandler: optionalAuth }, async (req: FastifyRequest, reply: FastifyReply) => {
    const { id } = req.params as any;
    const stream = await prisma.liveStream.findUnique({
      where: { id },
      include: {
        user: { select: { id: true, username: true, displayName: true, avatarUrl: true, isVerified: true } },
      },
    });
    if (!stream) return reply.status(404).send({ error: 'NOT_FOUND', message: 'Stream not found' });
    return reply.send({ stream });
  });

  // Get active streams
  app.get('/', { preHandler: optionalAuth }, async (req: FastifyRequest, reply: FastifyReply) => {
    const { page = '1', limit = '20' } = req.query as any;
    const offset = (parseInt(page) - 1) * parseInt(limit);
    const streams = await prisma.liveStream.findMany({
      where: { status: 'live' },
      orderBy: { viewerCount: 'desc' },
      skip: offset,
      take: parseInt(limit),
      include: {
        user: { select: { id: true, username: true, displayName: true, avatarUrl: true, isVerified: true } },
      },
    });
    return reply.send({ streams, page: parseInt(page), limit: parseInt(limit) });
  });

  // WebSocket for live stream chat
  app.get('/:id/ws', { websocket: true }, (socket, req) => {
    const { id } = req.params as any;
    socket.on('message', (data) => {
      const parsed = JSON.parse(data.toString());
      // Broadcast chat message to all viewers
    });
    socket.on('close', () => {
      // Decrement viewer count
    });
  });
}
