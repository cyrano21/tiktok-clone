import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { authMiddleware } from '../middleware/auth';
import { prisma } from '../config/database';

export async function commentRoutes(app: FastifyInstance) {
  // Like a comment
  app.post('/:id/like', { preHandler: authMiddleware }, async (req: FastifyRequest, reply: FastifyReply) => {
    const { id } = req.params as any;
    const userId = (req as any).userId;
    const existing = await prisma.commentLike.findUnique({ where: { userId_commentId: { userId, commentId: id } } });
    if (existing) {
      await prisma.commentLike.delete({ where: { id: existing.id } });
      return reply.send({ liked: false });
    }
    await prisma.commentLike.create({ data: { userId, commentId: id } });
    return reply.send({ liked: true });
  });

  // Delete a comment
  app.delete('/:id', { preHandler: authMiddleware }, async (req: FastifyRequest, reply: FastifyReply) => {
    const { id } = req.params as any;
    const userId = (req as any).userId;
    const comment = await prisma.comment.findUnique({ where: { id } });
    if (!comment || comment.userId !== userId) {
      return reply.status(403).send({ error: 'FORBIDDEN', message: 'Not authorized' });
    }
    await prisma.comment.delete({ where: { id } });
    return reply.send({ message: 'Comment deleted' });
  });

  // Get replies to a comment
  app.get('/:id/replies', async (req: FastifyRequest, reply: FastifyReply) => {
    const { id } = req.params as any;
    const { page = '1', limit = '20' } = req.query as any;
    const offset = (parseInt(page) - 1) * parseInt(limit);
    const replies = await prisma.comment.findMany({
      where: { parentId: id },
      orderBy: { createdAt: 'asc' },
      skip: offset,
      take: parseInt(limit),
      include: {
        user: { select: { id: true, username: true, displayName: true, avatar: true, isVerified: true } },
        _count: { select: { likes: true } },
      },
    });
    return reply.send({ replies, page: parseInt(page), limit: parseInt(limit) });
  });
}
