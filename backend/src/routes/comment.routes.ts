import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { authMiddleware, optionalAuth } from '../middleware/auth';
import { prisma } from '../config/database';

async function blockedBetween(userId: string, otherUserId: string) {
  if (userId === otherUserId) return false;
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

export async function commentRoutes(app: FastifyInstance) {
  // The schema does not yet have CommentLike rows, so repeated likes could not be
  // made idempotent safely. Fail explicitly instead of corrupting likeCount.
  app.post('/:id/like', { preHandler: authMiddleware }, async (_req: FastifyRequest, reply: FastifyReply) => {
    return reply.status(501).send({
      error: 'COMMENT_LIKE_MODEL_REQUIRED',
      message: 'Comment likes require a per-user CommentLike relation before this endpoint can be enabled safely.',
    });
  });

  app.delete('/:id', { preHandler: authMiddleware }, async (req: FastifyRequest, reply: FastifyReply) => {
    const { id } = z.object({ id: z.string().uuid() }).parse(req.params);
    const userId = (req as any).userId as string;
    const comment = await prisma.comment.findUnique({
      where: { id },
      select: { userId: true, videoId: true, isRemoved: true },
    });
    if (!comment || comment.userId !== userId) {
      return reply.status(403).send({ error: 'FORBIDDEN', message: 'Not authorized' });
    }
    if (!comment.isRemoved) {
      await prisma.$transaction([
        prisma.comment.update({ where: { id }, data: { isRemoved: true } }),
        prisma.video.update({ where: { id: comment.videoId }, data: { commentCount: { decrement: 1 } } }),
      ]);
    }
    return reply.send({ message: 'Comment deleted' });
  });

  app.get('/:id/replies', { preHandler: optionalAuth }, async (req: FastifyRequest, reply: FastifyReply) => {
    const { id } = z.object({ id: z.string().uuid() }).parse(req.params);
    const viewerId = (req as any).userId as string | undefined;
    const { page, limit } = z.object({
      page: z.coerce.number().int().min(1).default(1),
      limit: z.coerce.number().int().min(1).max(100).default(20),
    }).parse(req.query);

    const parent = await prisma.comment.findFirst({
      where: { id, isRemoved: false },
      select: { id: true, userId: true },
    });
    if (!parent || (viewerId && await blockedBetween(viewerId, parent.userId))) {
      return reply.status(404).send({ error: 'NOT_FOUND', message: 'Comment not found' });
    }

    let excludedUserIds: string[] = [];
    if (viewerId) {
      const blocks = await prisma.userBlock.findMany({
        where: { OR: [{ blockerId: viewerId }, { blockedId: viewerId }] },
        select: { blockerId: true, blockedId: true },
      });
      excludedUserIds = blocks.map((block) => block.blockerId === viewerId ? block.blockedId : block.blockerId);
    }

    const replies = await prisma.comment.findMany({
      where: {
        parentId: id,
        isRemoved: false,
        userId: { notIn: excludedUserIds },
        user: {
          isBanned: false,
          OR: [{ suspendedUntil: null }, { suspendedUntil: { lte: new Date() } }],
        },
      },
      orderBy: { createdAt: 'asc' },
      skip: (page - 1) * limit,
      take: limit,
      include: {
        user: { select: { id: true, username: true, displayName: true, avatarUrl: true, isVerified: true } },
        _count: { select: { replies: true } },
      },
    });
    return reply.send({ replies, page, limit });
  });
}
