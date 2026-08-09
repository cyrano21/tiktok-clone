import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { authMiddleware, optionalAuth } from '../middleware/auth';
import { prisma } from '../config/database';

async function blockedBetween(userId: string, otherUserId: string) {
  if (userId === otherUserId) return false;
  return Boolean(await prisma.userBlock.findFirst({
    where: { OR: [{ blockerId: userId, blockedId: otherUserId }, { blockerId: otherUserId, blockedId: userId }] },
    select: { id: true },
  }));
}

export async function commentRoutes(app: FastifyInstance) {
  app.post('/:id/like', { preHandler: authMiddleware }, async (req: FastifyRequest, reply: FastifyReply) => {
    const { id } = z.object({ id: z.string().uuid() }).parse(req.params);
    const userId = (req as any).userId as string;
    const comment = await prisma.comment.findFirst({
      where: {
        id,
        isRemoved: false,
        user: { isBanned: false, OR: [{ suspendedUntil: null }, { suspendedUntil: { lte: new Date() } }] },
      },
      select: { id: true, userId: true },
    });
    if (!comment || await blockedBetween(userId, comment.userId)) {
      return reply.status(404).send({ error: 'NOT_FOUND', message: 'Comment not found' });
    }

    const result = await prisma.$transaction(async (tx) => {
      const existing = await tx.commentLike.findUnique({ where: { userId_commentId: { userId, commentId: id } }, select: { id: true } });
      let liked: boolean;
      if (existing) {
        await tx.commentLike.delete({ where: { id: existing.id } });
        liked = false;
      } else {
        await tx.commentLike.create({ data: { userId, commentId: id } });
        liked = true;
      }
      const likeCount = await tx.commentLike.count({ where: { commentId: id } });
      await tx.comment.update({ where: { id }, data: { likeCount } });
      return { liked, likeCount };
    });
    return reply.send(result);
  });

  app.delete('/:id', { preHandler: authMiddleware }, async (req: FastifyRequest, reply: FastifyReply) => {
    const { id } = z.object({ id: z.string().uuid() }).parse(req.params);
    const userId = (req as any).userId as string;
    const comment = await prisma.comment.findUnique({ where: { id }, select: { userId: true, videoId: true, isRemoved: true } });
    if (!comment || comment.userId !== userId) {
      return reply.status(403).send({ error: 'FORBIDDEN', message: 'Not authorized' });
    }
    if (!comment.isRemoved) {
      await prisma.$transaction(async (tx) => {
        // updateMany's isRemoved guard makes concurrent delete retries idempotent.
        const changed = await tx.comment.updateMany({ where: { id, isRemoved: false }, data: { isRemoved: true } });
        if (changed.count > 0) {
          await tx.video.updateMany({
            where: { id: comment.videoId, commentCount: { gt: 0 } },
            data: { commentCount: { decrement: 1 } },
          });
        }
      });
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

    const parent = await prisma.comment.findFirst({ where: { id, isRemoved: false }, select: { id: true, userId: true } });
    if (!parent || (viewerId && await blockedBetween(viewerId, parent.userId))) {
      return reply.status(404).send({ error: 'NOT_FOUND', message: 'Comment not found' });
    }

    let excludedUserIds: string[] = [];
    if (viewerId) {
      const blocks = await prisma.userBlock.findMany({ where: { OR: [{ blockerId: viewerId }, { blockedId: viewerId }] }, select: { blockerId: true, blockedId: true } });
      excludedUserIds = blocks.map((block) => block.blockerId === viewerId ? block.blockedId : block.blockerId);
    }

    const replies = await prisma.comment.findMany({
      where: {
        parentId: id,
        isRemoved: false,
        userId: { notIn: excludedUserIds },
        user: { isBanned: false, OR: [{ suspendedUntil: null }, { suspendedUntil: { lte: new Date() } }] },
      },
      orderBy: { createdAt: 'asc' },
      skip: (page - 1) * limit,
      take: limit,
      include: {
        user: { select: { id: true, username: true, displayName: true, avatarUrl: true, isVerified: true } },
        _count: { select: { replies: true } },
        ...(viewerId ? { likes: { where: { userId: viewerId }, select: { id: true } } } : {}),
      },
    });

    return reply.send({
      replies: replies.map((replyItem: any) => ({
        ...replyItem,
        isLiked: Array.isArray(replyItem.likes) ? replyItem.likes.length > 0 : false,
        likes: undefined,
      })),
      page,
      limit,
    });
  });
}
