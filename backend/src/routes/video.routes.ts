import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { authMiddleware, optionalAuth } from '../middleware/auth';
import { prisma } from '../config/database';
import { NotificationService } from '../services/notification.service';
import { RecommendationService } from '../services/recommendation.service';

const updateVideoSchema = z.object({
  title: z.string().trim().max(150).nullable().optional(),
  description: z.string().trim().max(5000).nullable().optional(),
  visibility: z.enum(['public', 'friends', 'private']).optional(),
  allowDuet: z.boolean().optional(),
  allowStitch: z.boolean().optional(),
  allowComment: z.boolean().optional(),
  locationLat: z.number().min(-90).max(90).nullable().optional(),
  locationLng: z.number().min(-180).max(180).nullable().optional(),
  locationName: z.string().trim().max(200).nullable().optional(),
}).strict();

async function isBlocked(userId: string, otherUserId: string) {
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

export async function videoRoutes(app: FastifyInstance) {
  app.get('/:id', { preHandler: optionalAuth }, async (req: FastifyRequest, reply: FastifyReply) => {
    const { id } = z.object({ id: z.string().uuid() }).parse(req.params);
    const viewerId = (req as any).userId as string | undefined;
    const video = await prisma.video.findFirst({
      where: {
        id,
        OR: [{ visibility: 'public' }, ...(viewerId ? [{ userId: viewerId }] : [])],
        user: {
          isBanned: false,
          OR: [{ suspendedUntil: null }, { suspendedUntil: { lte: new Date() } }],
        },
      },
      include: {
        user: { select: { id: true, username: true, displayName: true, avatarUrl: true, isVerified: true } },
        _count: { select: { likes: true, comments: true, shares: true, saves: true } },
      },
    });
    if (!video) return reply.status(404).send({ error: 'NOT_FOUND', message: 'Video not found' });
    if (viewerId && viewerId !== video.userId && await isBlocked(viewerId, video.userId)) {
      return reply.status(404).send({ error: 'NOT_FOUND', message: 'Video not found' });
    }
    return reply.send({ video });
  });

  // Upload is deliberately not faked: the media pipeline must persist a real object
  // before a Video row is created. A dedicated S3 upload flow is implemented separately.
  app.post('/', { preHandler: authMiddleware }, async (_req: FastifyRequest, reply: FastifyReply) => {
    return reply.status(501).send({
      error: 'UPLOAD_PIPELINE_REQUIRED',
      message: 'Use the media upload pipeline; this endpoint no longer reports false success.',
    });
  });

  app.patch('/:id', { preHandler: authMiddleware }, async (req: FastifyRequest, reply: FastifyReply) => {
    const { id } = z.object({ id: z.string().uuid() }).parse(req.params);
    const userId = (req as any).userId as string;
    const video = await prisma.video.findUnique({ where: { id }, select: { userId: true } });
    if (!video || video.userId !== userId) {
      return reply.status(403).send({ error: 'FORBIDDEN', message: 'Not authorized' });
    }
    const data = updateVideoSchema.parse(req.body);
    const updated = await prisma.video.update({ where: { id }, data });
    return reply.send({ video: updated });
  });

  app.delete('/:id', { preHandler: authMiddleware }, async (req: FastifyRequest, reply: FastifyReply) => {
    const { id } = z.object({ id: z.string().uuid() }).parse(req.params);
    const userId = (req as any).userId as string;
    const video = await prisma.video.findUnique({ where: { id }, select: { userId: true } });
    if (!video || video.userId !== userId) {
      return reply.status(403).send({ error: 'FORBIDDEN', message: 'Not authorized' });
    }
    await prisma.video.delete({ where: { id } });
    return reply.send({ message: 'Video deleted' });
  });

  app.post('/:id/like', { preHandler: authMiddleware }, async (req: FastifyRequest, reply: FastifyReply) => {
    const { id } = z.object({ id: z.string().uuid() }).parse(req.params);
    const userId = (req as any).userId as string;
    const video = await prisma.video.findUnique({ where: { id }, select: { userId: true, visibility: true } });
    if (!video || video.visibility !== 'public' || await isBlocked(userId, video.userId)) {
      return reply.status(404).send({ error: 'NOT_FOUND', message: 'Video not found' });
    }

    const existing = await prisma.like.findUnique({ where: { userId_videoId: { userId, videoId: id } } });
    if (existing) {
      await prisma.$transaction([
        prisma.like.delete({ where: { id: existing.id } }),
        prisma.video.update({ where: { id }, data: { likeCount: { decrement: 1 } } }),
      ]);
      await RecommendationService.recordInteraction(userId, id, 'unlike', -2);
      return reply.send({ liked: false });
    }

    await prisma.$transaction([
      prisma.like.create({ data: { userId, videoId: id } }),
      prisma.video.update({ where: { id }, data: { likeCount: { increment: 1 } } }),
    ]);
    await RecommendationService.recordInteraction(userId, id, 'like', 3);
    await NotificationService.notifyLike(video.userId, userId, id);
    return reply.send({ liked: true });
  });

  app.post('/:id/save', { preHandler: authMiddleware }, async (req: FastifyRequest, reply: FastifyReply) => {
    const { id } = z.object({ id: z.string().uuid() }).parse(req.params);
    const userId = (req as any).userId as string;
    const video = await prisma.video.findUnique({ where: { id }, select: { userId: true, visibility: true } });
    if (!video || video.visibility !== 'public' || await isBlocked(userId, video.userId)) {
      return reply.status(404).send({ error: 'NOT_FOUND', message: 'Video not found' });
    }

    const existing = await prisma.save.findUnique({ where: { userId_videoId: { userId, videoId: id } } });
    if (existing) {
      await prisma.$transaction([
        prisma.save.delete({ where: { id: existing.id } }),
        prisma.video.update({ where: { id }, data: { saveCount: { decrement: 1 } } }),
      ]);
      await RecommendationService.recordInteraction(userId, id, 'unsave', -3);
      return reply.send({ saved: false });
    }

    await prisma.$transaction([
      prisma.save.create({ data: { userId, videoId: id } }),
      prisma.video.update({ where: { id }, data: { saveCount: { increment: 1 } } }),
    ]);
    await RecommendationService.recordInteraction(userId, id, 'save', 5);
    return reply.send({ saved: true });
  });

  app.post('/:id/share', { preHandler: authMiddleware }, async (req: FastifyRequest, reply: FastifyReply) => {
    const { id } = z.object({ id: z.string().uuid() }).parse(req.params);
    const userId = (req as any).userId as string;
    const { platform } = z.object({ platform: z.string().trim().max(40).default('in_app') }).parse(req.body ?? {});
    const video = await prisma.video.findUnique({ where: { id }, select: { userId: true, visibility: true } });
    if (!video || video.visibility !== 'public' || await isBlocked(userId, video.userId)) {
      return reply.status(404).send({ error: 'NOT_FOUND', message: 'Video not found' });
    }
    await prisma.$transaction([
      prisma.share.create({ data: { userId, videoId: id, platform } }),
      prisma.video.update({ where: { id }, data: { shareCount: { increment: 1 } } }),
    ]);
    await RecommendationService.recordInteraction(userId, id, 'share', 6);
    return reply.send({ shared: true });
  });

  app.post('/:id/view', { preHandler: optionalAuth }, async (req: FastifyRequest, reply: FastifyReply) => {
    const { id } = z.object({ id: z.string().uuid() }).parse(req.params);
    const userId = (req as any).userId as string | undefined;
    const body = z.object({
      watchDuration: z.coerce.number().min(0).max(60 * 60).default(0),
      watchPercentage: z.coerce.number().min(0).max(100).default(0),
      fromSource: z.string().trim().max(50).default('in_app'),
    }).parse(req.body ?? {});
    const video = await prisma.video.findUnique({ where: { id }, select: { userId: true, visibility: true } });
    if (!video || video.visibility !== 'public') return reply.status(404).send({ error: 'NOT_FOUND', message: 'Video not found' });
    if (userId && await isBlocked(userId, video.userId)) {
      return reply.status(404).send({ error: 'NOT_FOUND', message: 'Video not found' });
    }

    await prisma.$transaction([
      prisma.videoView.create({
        data: {
          userId: userId ?? null,
          videoId: id,
          watchDuration: body.watchDuration,
          watchPercentage: body.watchPercentage,
          fromSource: body.fromSource,
        },
      }),
      prisma.video.update({ where: { id }, data: { viewCount: { increment: 1 } } }),
    ]);
    if (userId) {
      const completionWeight = Math.max(0.25, Math.min(4, body.watchPercentage / 25));
      await RecommendationService.recordInteraction(userId, id, 'view', completionWeight);
    }
    return reply.send({ viewed: true });
  });

  app.get('/:id/comments', { preHandler: optionalAuth }, async (req: FastifyRequest, reply: FastifyReply) => {
    const { id } = z.object({ id: z.string().uuid() }).parse(req.params);
    const { page, limit } = z.object({
      page: z.coerce.number().int().min(1).default(1),
      limit: z.coerce.number().int().min(1).max(100).default(20),
    }).parse(req.query);
    const comments = await prisma.comment.findMany({
      where: { videoId: id, parentId: null, isRemoved: false },
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
      include: {
        user: { select: { id: true, username: true, displayName: true, avatarUrl: true, isVerified: true } },
        _count: { select: { replies: true } },
      },
    });
    return reply.send({ comments, page, limit });
  });

  app.post('/:id/comments', { preHandler: authMiddleware }, async (req: FastifyRequest, reply: FastifyReply) => {
    const { id } = z.object({ id: z.string().uuid() }).parse(req.params);
    const userId = (req as any).userId as string;
    const body = z.object({
      text: z.string().trim().min(1).max(2000),
      parentId: z.string().uuid().nullable().optional(),
    }).parse(req.body);

    const video = await prisma.video.findUnique({ where: { id }, select: { userId: true, visibility: true, allowComment: true } });
    if (!video || video.visibility !== 'public' || !video.allowComment || await isBlocked(userId, video.userId)) {
      return reply.status(403).send({ error: 'COMMENTS_DISABLED', message: 'Comments are unavailable for this video' });
    }
    if (body.parentId) {
      const parent = await prisma.comment.findFirst({ where: { id: body.parentId, videoId: id, isRemoved: false }, select: { id: true } });
      if (!parent) return reply.status(400).send({ error: 'BAD_REQUEST', message: 'Invalid parent comment' });
    }

    const comment = await prisma.comment.create({
      data: { text: body.text, userId, videoId: id, parentId: body.parentId ?? null },
      include: { user: { select: { id: true, username: true, displayName: true, avatarUrl: true } } },
    });
    await prisma.video.update({ where: { id }, data: { commentCount: { increment: 1 } } });
    await RecommendationService.recordInteraction(userId, id, 'comment', 4);
    await NotificationService.notifyComment(video.userId, userId, id, body.text);
    return reply.status(201).send({ comment });
  });
}
