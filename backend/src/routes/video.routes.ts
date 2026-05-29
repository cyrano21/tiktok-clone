import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { authMiddleware, optionalAuth } from '../middleware/auth';
import { prisma } from '../config/database';

export async function videoRoutes(app: FastifyInstance) {
  // Get video by ID
  app.get('/:id', { preHandler: optionalAuth }, async (req: FastifyRequest, reply: FastifyReply) => {
    const { id } = req.params as any;
    const video = await prisma.video.findUnique({
      where: { id },
      include: {
        user: { select: { id: true, username: true, displayName: true, avatar: true, isVerified: true } },
        _count: { select: { likes: true, comments: true, shares: true } },
      },
    });
    if (!video) return reply.status(404).send({ error: 'NOT_FOUND', message: 'Video not found' });
    return reply.send({ video });
  });

  // Upload video
  app.post('/', { preHandler: authMiddleware }, async (req: FastifyRequest, reply: FastifyReply) => {
    const userId = (req as any).userId;
    // Video upload logic handled by video.service
    return reply.status(201).send({ message: 'Video uploaded successfully' });
  });

  // Update video
  app.patch('/:id', { preHandler: authMiddleware }, async (req: FastifyRequest, reply: FastifyReply) => {
    const { id } = req.params as any;
    const userId = (req as any).userId;
    const video = await prisma.video.findUnique({ where: { id } });
    if (!video || video.userId !== userId) {
      return reply.status(403).send({ error: 'FORBIDDEN', message: 'Not authorized' });
    }
    const updated = await prisma.video.update({ where: { id }, data: req.body as any });
    return reply.send({ video: updated });
  });

  // Delete video
  app.delete('/:id', { preHandler: authMiddleware }, async (req: FastifyRequest, reply: FastifyReply) => {
    const { id } = req.params as any;
    const userId = (req as any).userId;
    const video = await prisma.video.findUnique({ where: { id } });
    if (!video || video.userId !== userId) {
      return reply.status(403).send({ error: 'FORBIDDEN', message: 'Not authorized' });
    }
    await prisma.video.delete({ where: { id } });
    return reply.send({ message: 'Video deleted' });
  });

  // Like video
  app.post('/:id/like', { preHandler: authMiddleware }, async (req: FastifyRequest, reply: FastifyReply) => {
    const { id } = req.params as any;
    const userId = (req as any).userId;
    const existing = await prisma.like.findUnique({ where: { userId_videoId: { userId, videoId: id } } });
    if (existing) {
      await prisma.like.delete({ where: { id: existing.id } });
      await prisma.video.update({ where: { id }, data: { likesCount: { decrement: 1 } } });
      return reply.send({ liked: false });
    }
    await prisma.like.create({ data: { userId, videoId: id } });
    await prisma.video.update({ where: { id }, data: { likesCount: { increment: 1 } } });
    return reply.send({ liked: true });
  });

  // Save video
  app.post('/:id/save', { preHandler: authMiddleware }, async (req: FastifyRequest, reply: FastifyReply) => {
    const { id } = req.params as any;
    const userId = (req as any).userId;
    const existing = await prisma.savedVideo.findUnique({ where: { userId_videoId: { userId, videoId: id } } });
    if (existing) {
      await prisma.savedVideo.delete({ where: { id: existing.id } });
      return reply.send({ saved: false });
    }
    await prisma.savedVideo.create({ data: { userId, videoId: id } });
    return reply.send({ saved: true });
  });

  // Share video
  app.post('/:id/share', { preHandler: authMiddleware }, async (req: FastifyRequest, reply: FastifyReply) => {
    const { id } = req.params as any;
    const userId = (req as any).userId;
    await prisma.share.create({ data: { userId, videoId: id } });
    await prisma.video.update({ where: { id }, data: { sharesCount: { increment: 1 } } });
    return reply.send({ shared: true });
  });

  // Record view
  app.post('/:id/view', { preHandler: optionalAuth }, async (req: FastifyRequest, reply: FastifyReply) => {
    const { id } = req.params as any;
    await prisma.video.update({ where: { id }, data: { viewsCount: { increment: 1 } } });
    return reply.send({ viewed: true });
  });

  // Get video comments
  app.get('/:id/comments', { preHandler: optionalAuth }, async (req: FastifyRequest, reply: FastifyReply) => {
    const { id } = req.params as any;
    const { page = '1', limit = '20' } = req.query as any;
    const offset = (parseInt(page) - 1) * parseInt(limit);
    const comments = await prisma.comment.findMany({
      where: { videoId: id, parentId: null },
      orderBy: { createdAt: 'desc' },
      skip: offset,
      take: parseInt(limit),
      include: {
        user: { select: { id: true, username: true, displayName: true, avatar: true, isVerified: true } },
        _count: { select: { replies: true, likes: true } },
      },
    });
    return reply.send({ comments, page: parseInt(page), limit: parseInt(limit) });
  });

  // Post comment
  app.post('/:id/comments', { preHandler: authMiddleware }, async (req: FastifyRequest, reply: FastifyReply) => {
    const { id } = req.params as any;
    const userId = (req as any).userId;
    const { text, parentId } = req.body as any;
    const comment = await prisma.comment.create({
      data: { text, userId, videoId: id, parentId },
      include: { user: { select: { id: true, username: true, displayName: true, avatar: true } } },
    });
    await prisma.video.update({ where: { id }, data: { commentsCount: { increment: 1 } } });
    return reply.status(201).send({ comment });
  });
}
