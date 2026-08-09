import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { authMiddleware, optionalAuth } from '../middleware/auth';
import { prisma } from '../config/database';
import { NotificationService } from '../services/notification.service';
import { RecommendationService } from '../services/recommendation.service';
import {
  deleteMediaObjects,
  deleteMediaUrls,
  ingestMedia,
  type MediaFilterSettings,
} from '../services/video.service';

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

const uploadMetadataSchema = z.object({
  title: z.string().trim().max(150).optional(),
  description: z.string().trim().max(5000).default(''),
  visibility: z.enum(['public', 'friends', 'private']).default('public'),
  allowDuet: z.boolean().default(true),
  allowStitch: z.boolean().default(true),
  allowComment: z.boolean().default(true),
  trimStart: z.number().min(0).max(600).default(0),
  trimEnd: z.number().min(0).max(600).default(0),
  overlayText: z.string().trim().max(120).default(''),
  filters: z.object({
    brightness: z.number().min(50).max(150).optional(),
    contrast: z.number().min(50).max(150).optional(),
    saturate: z.number().min(0).max(200).optional(),
    grayscale: z.number().min(0).max(100).optional(),
  }).default({}),
});

function multipartField(fields: Record<string, any>, name: string): string | undefined {
  const raw = fields?.[name];
  const field = Array.isArray(raw) ? raw[raw.length - 1] : raw;
  if (!field || field.type === 'file') return undefined;
  if (field.value === undefined || field.value === null) return undefined;
  return String(field.value);
}

function parseBoolean(value: string | undefined, fallback: boolean) {
  if (value === undefined) return fallback;
  return value === 'true' || value === '1';
}

function parseUploadMetadata(fields: Record<string, any>) {
  let filters: MediaFilterSettings = {};
  const filtersRaw = multipartField(fields, 'filters');
  if (filtersRaw) {
    try {
      filters = JSON.parse(filtersRaw) as MediaFilterSettings;
    } catch {
      const error = new Error('filters must be valid JSON');
      (error as any).statusCode = 400;
      throw error;
    }
  }

  return uploadMetadataSchema.parse({
    title: multipartField(fields, 'title') || undefined,
    description: multipartField(fields, 'description') ?? '',
    visibility: multipartField(fields, 'visibility') || 'public',
    allowDuet: parseBoolean(multipartField(fields, 'allowDuet'), true),
    allowStitch: parseBoolean(multipartField(fields, 'allowStitch'), true),
    allowComment: parseBoolean(multipartField(fields, 'allowComment'), true),
    trimStart: Number(multipartField(fields, 'trimStart') || 0),
    trimEnd: Number(multipartField(fields, 'trimEnd') || 0),
    overlayText: multipartField(fields, 'overlayText') ?? '',
    filters,
  });
}

function extractHashtagNames(text: string) {
  const matches = text.matchAll(/#([\p{L}\p{N}_]{1,64})/gu);
  return [...new Set(Array.from(matches, (match) => match[1].toLocaleLowerCase()))].slice(0, 20);
}

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

async function viewerState(viewerId: string | undefined, videoId: string, creatorId: string) {
  if (!viewerId) return { isLiked: false, isSaved: false, isFollowing: false, isFollowedBy: false };
  const [like, save, following, followedBy] = await Promise.all([
    prisma.like.findUnique({ where: { userId_videoId: { userId: viewerId, videoId } }, select: { id: true } }),
    prisma.save.findUnique({ where: { userId_videoId: { userId: viewerId, videoId } }, select: { id: true } }),
    prisma.follow.findUnique({ where: { followerId_followingId: { followerId: viewerId, followingId: creatorId } }, select: { id: true } }),
    prisma.follow.findUnique({ where: { followerId_followingId: { followerId: creatorId, followingId: viewerId } }, select: { id: true } }),
  ]);
  return { isLiked: Boolean(like), isSaved: Boolean(save), isFollowing: Boolean(following), isFollowedBy: Boolean(followedBy) };
}

function canonicalMedia(video: any) {
  return {
    ...video,
    videoUrl: `/v1/media/videos/${video.id}`,
    thumbnailUrl: video.thumbnailUrl ? `/v1/media/thumbnails/${video.id}` : null,
    coverUrl: video.thumbnailUrl ? `/v1/media/thumbnails/${video.id}` : null,
  };
}

function privateVisibilityNotReady(reply: FastifyReply) {
  return reply.status(409).send({
    error: 'PRIVATE_MEDIA_DELIVERY_NOT_READY',
    message: 'Les publications friends/private restent désactivées tant que la lecture média authentifiée par URL signée n’est pas disponible.',
  });
}

export async function videoRoutes(app: FastifyInstance) {
  app.get('/:id', { preHandler: optionalAuth }, async (req: FastifyRequest, reply: FastifyReply) => {
    const { id } = z.object({ id: z.string().uuid() }).parse(req.params);
    const viewerId = (req as any).userId as string | undefined;
    const video = await prisma.video.findFirst({
      where: {
        id,
        sourceType: 'ORKY_NATIVE',
        OR: [{ visibility: 'public' }, ...(viewerId ? [{ userId: viewerId }] : [])],
        user: {
          isBanned: false,
          OR: [{ suspendedUntil: null }, { suspendedUntil: { lte: new Date() } }],
        },
      },
      include: {
        user: { select: { id: true, username: true, displayName: true, avatarUrl: true, isVerified: true, followerCount: true, followingCount: true, likeCount: true, videoCount: true } },
        hashtags: { include: { hashtag: true } },
        sound: true,
        productMatches: { where: { status: 'active' }, orderBy: [{ confidence: 'desc' }, { createdAt: 'asc' }], take: 5 },
        _count: { select: { likes: true, comments: true, shares: true, saves: true } },
      },
    });
    if (!video) return reply.status(404).send({ error: 'NOT_FOUND', message: 'Video not found' });
    if (viewerId && viewerId !== video.userId && await isBlocked(viewerId, video.userId)) {
      return reply.status(404).send({ error: 'NOT_FOUND', message: 'Video not found' });
    }
    const state = await viewerState(viewerId, video.id, video.userId);
    return reply.send({
      video: canonicalMedia({
        ...video,
        ...state,
        user: { ...video.user, isFollowing: state.isFollowing, isFollowedBy: state.isFollowedBy },
        hashtags: video.hashtags.map((link) => link.hashtag),
      }),
    });
  });

  app.post('/', { preHandler: authMiddleware }, async (req: FastifyRequest, reply: FastifyReply) => {
    if (!req.isMultipart()) {
      return reply.status(415).send({ error: 'UNSUPPORTED_MEDIA_TYPE', message: 'Expected multipart/form-data' });
    }

    const userId = (req as any).userId as string;
    const upload = await req.file();
    if (!upload) return reply.status(400).send({ error: 'MEDIA_REQUIRED', message: 'A media file is required' });

    const metadata = parseUploadMetadata(upload.fields as Record<string, any>);
    if (metadata.visibility !== 'public') return privateVisibilityNotReady(reply);

    const processed = await ingestMedia({
      stream: upload.file,
      filename: upload.filename,
      mimetype: upload.mimetype,
      trimStart: metadata.trimStart,
      trimEnd: metadata.trimEnd,
      overlayText: metadata.overlayText,
      filters: metadata.filters,
    });

    if (upload.file.truncated) {
      await deleteMediaObjects([processed.videoKey, processed.thumbnailKey]);
      return reply.status(413).send({ error: 'MEDIA_TOO_LARGE', message: 'Media exceeds the upload limit' });
    }

    const hashtagNames = extractHashtagNames(metadata.description);
    const title = metadata.title || metadata.description.slice(0, 150) || null;
    let createdVideoId: string;

    try {
      createdVideoId = await prisma.$transaction(async (tx) => {
        const video = await tx.video.create({
          data: {
            userId,
            title,
            description: metadata.description || null,
            videoUrl: processed.videoUrl,
            thumbnailUrl: processed.thumbnailUrl,
            coverUrl: processed.thumbnailUrl,
            videoStorageKey: processed.videoKey,
            thumbnailStorageKey: processed.thumbnailKey,
            sourceType: 'ORKY_NATIVE',
            duration: processed.duration,
            width: processed.width,
            height: processed.height,
            visibility: 'public',
            allowDuet: metadata.allowDuet,
            allowStitch: metadata.allowStitch,
            allowComment: metadata.allowComment,
          },
          select: { id: true },
        });

        await tx.user.update({ where: { id: userId }, data: { videoCount: { increment: 1 } } });
        for (const name of hashtagNames) {
          const hashtag = await tx.hashtag.upsert({
            where: { name },
            create: { name, videoCount: 1 },
            update: { videoCount: { increment: 1 } },
            select: { id: true },
          });
          await tx.videoHashtag.create({ data: { videoId: video.id, hashtagId: hashtag.id } });
        }
        return video.id;
      });
    } catch (error) {
      await deleteMediaObjects([processed.videoKey, processed.thumbnailKey]);
      throw error;
    }

    const video = await prisma.video.findUniqueOrThrow({
      where: { id: createdVideoId },
      include: {
        user: { select: { id: true, username: true, displayName: true, avatarUrl: true, isVerified: true, followerCount: true, followingCount: true, likeCount: true, videoCount: true } },
        hashtags: { include: { hashtag: true } },
        sound: true,
        productMatches: { where: { status: 'active' }, take: 5 },
        _count: { select: { likes: true, comments: true, shares: true, saves: true } },
      },
    });

    return reply.status(201).send({
      video: canonicalMedia({
        ...video,
        isLiked: false,
        isSaved: false,
        user: { ...video.user, isFollowing: false, isFollowedBy: false },
        hashtags: video.hashtags.map((link) => link.hashtag),
      }),
      processing: { sourceSizeBytes: processed.sourceSizeBytes, normalized: true, format: 'video/mp4' },
    });
  });

  app.patch('/:id', { preHandler: authMiddleware }, async (req: FastifyRequest, reply: FastifyReply) => {
    const { id } = z.object({ id: z.string().uuid() }).parse(req.params);
    const userId = (req as any).userId as string;
    const video = await prisma.video.findUnique({ where: { id }, select: { userId: true } });
    if (!video || video.userId !== userId) return reply.status(403).send({ error: 'FORBIDDEN', message: 'Not authorized' });
    const data = updateVideoSchema.parse(req.body);
    if (data.visibility && data.visibility !== 'public') return privateVisibilityNotReady(reply);
    const updated = await prisma.video.update({ where: { id }, data });
    return reply.send({ video: canonicalMedia(updated) });
  });

  app.delete('/:id', { preHandler: authMiddleware }, async (req: FastifyRequest, reply: FastifyReply) => {
    const { id } = z.object({ id: z.string().uuid() }).parse(req.params);
    const userId = (req as any).userId as string;
    const video = await prisma.video.findUnique({
      where: { id },
      select: {
        userId: true,
        videoUrl: true,
        thumbnailUrl: true,
        videoStorageKey: true,
        thumbnailStorageKey: true,
        hashtags: { select: { hashtagId: true } },
      },
    });
    if (!video || video.userId !== userId) return reply.status(403).send({ error: 'FORBIDDEN', message: 'Not authorized' });

    await prisma.$transaction(async (tx) => {
      await tx.video.delete({ where: { id } });
      await tx.user.updateMany({ where: { id: userId, videoCount: { gt: 0 } }, data: { videoCount: { decrement: 1 } } });
      for (const link of video.hashtags) {
        const hashtag = await tx.hashtag.findUnique({ where: { id: link.hashtagId }, select: { videoCount: true } });
        if (hashtag && hashtag.videoCount > 0n) {
          await tx.hashtag.update({ where: { id: link.hashtagId }, data: { videoCount: { decrement: 1 } } });
        }
      }
    });

    await deleteMediaObjects([video.videoStorageKey, video.thumbnailStorageKey]);
    await deleteMediaUrls([
      video.videoStorageKey ? null : video.videoUrl,
      video.thumbnailStorageKey ? null : video.thumbnailUrl,
    ]);
    return reply.send({ message: 'Video deleted' });
  });

  app.post('/:id/like', { preHandler: authMiddleware }, async (req: FastifyRequest, reply: FastifyReply) => {
    const { id } = z.object({ id: z.string().uuid() }).parse(req.params);
    const userId = (req as any).userId as string;
    const video = await prisma.video.findUnique({ where: { id }, select: { userId: true, visibility: true, sourceType: true, likeCount: true } });
    if (!video || video.visibility !== 'public' || video.sourceType !== 'ORKY_NATIVE' || await isBlocked(userId, video.userId)) {
      return reply.status(404).send({ error: 'NOT_FOUND', message: 'Video not found' });
    }

    const existing = await prisma.like.findUnique({ where: { userId_videoId: { userId, videoId: id } } });
    if (existing) {
      await prisma.$transaction(async (tx) => {
        await tx.like.delete({ where: { id: existing.id } });
        if (video.likeCount > 0n) await tx.video.update({ where: { id }, data: { likeCount: { decrement: 1 } } });
      });
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
    const video = await prisma.video.findUnique({ where: { id }, select: { userId: true, visibility: true, sourceType: true, saveCount: true } });
    if (!video || video.visibility !== 'public' || video.sourceType !== 'ORKY_NATIVE' || await isBlocked(userId, video.userId)) {
      return reply.status(404).send({ error: 'NOT_FOUND', message: 'Video not found' });
    }

    const existing = await prisma.save.findUnique({ where: { userId_videoId: { userId, videoId: id } } });
    if (existing) {
      await prisma.$transaction(async (tx) => {
        await tx.save.delete({ where: { id: existing.id } });
        if (video.saveCount > 0n) await tx.video.update({ where: { id }, data: { saveCount: { decrement: 1 } } });
      });
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
    const video = await prisma.video.findUnique({ where: { id }, select: { userId: true, visibility: true, sourceType: true } });
    if (!video || video.visibility !== 'public' || video.sourceType !== 'ORKY_NATIVE' || await isBlocked(userId, video.userId)) {
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
    const video = await prisma.video.findUnique({ where: { id }, select: { userId: true, visibility: true, sourceType: true } });
    if (!video || video.visibility !== 'public' || video.sourceType !== 'ORKY_NATIVE') return reply.status(404).send({ error: 'NOT_FOUND', message: 'Video not found' });
    if (userId && await isBlocked(userId, video.userId)) return reply.status(404).send({ error: 'NOT_FOUND', message: 'Video not found' });

    await prisma.$transaction([
      prisma.videoView.create({ data: { userId: userId ?? null, videoId: id, watchDuration: body.watchDuration, watchPercentage: body.watchPercentage, fromSource: body.fromSource } }),
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
    const viewerId = (req as any).userId as string | undefined;
    const { page, limit } = z.object({ page: z.coerce.number().int().min(1).default(1), limit: z.coerce.number().int().min(1).max(100).default(20) }).parse(req.query);

    const source = await prisma.video.findUnique({ where: { id }, select: { visibility: true, sourceType: true } });
    if (!source || source.visibility !== 'public' || source.sourceType !== 'ORKY_NATIVE') {
      return reply.status(404).send({ error: 'NOT_FOUND', message: 'Video not found' });
    }

    let excludedUserIds: string[] = [];
    if (viewerId) {
      const blocks = await prisma.userBlock.findMany({ where: { OR: [{ blockerId: viewerId }, { blockedId: viewerId }] }, select: { blockerId: true, blockedId: true } });
      excludedUserIds = blocks.map((block) => block.blockerId === viewerId ? block.blockedId : block.blockerId);
    }

    const comments = await prisma.comment.findMany({
      where: {
        videoId: id,
        parentId: null,
        isRemoved: false,
        userId: { notIn: excludedUserIds },
        user: { isBanned: false, OR: [{ suspendedUntil: null }, { suspendedUntil: { lte: new Date() } }] },
      },
      orderBy: [{ isPinned: 'desc' }, { createdAt: 'desc' }],
      skip: (page - 1) * limit,
      take: limit,
      include: {
        user: { select: { id: true, username: true, displayName: true, avatarUrl: true, isVerified: true } },
        _count: { select: { replies: true } },
        ...(viewerId ? { likes: { where: { userId: viewerId }, select: { id: true } } } : {}),
      },
    });

    return reply.send({ comments: comments.map((comment: any) => ({ ...comment, isLiked: Array.isArray(comment.likes) ? comment.likes.length > 0 : false, likes: undefined })), page, limit });
  });

  app.post('/:id/comments', { preHandler: authMiddleware }, async (req: FastifyRequest, reply: FastifyReply) => {
    const { id } = z.object({ id: z.string().uuid() }).parse(req.params);
    const userId = (req as any).userId as string;
    const body = z.object({ text: z.string().trim().min(1).max(2000), parentId: z.string().uuid().nullable().optional() }).parse(req.body);

    const video = await prisma.video.findUnique({ where: { id }, select: { userId: true, visibility: true, allowComment: true, sourceType: true } });
    if (!video || video.visibility !== 'public' || video.sourceType !== 'ORKY_NATIVE' || !video.allowComment || await isBlocked(userId, video.userId)) {
      return reply.status(403).send({ error: 'COMMENTS_DISABLED', message: 'Comments are unavailable for this video' });
    }
    if (body.parentId) {
      const parent = await prisma.comment.findFirst({ where: { id: body.parentId, videoId: id, isRemoved: false }, select: { id: true } });
      if (!parent) return reply.status(400).send({ error: 'BAD_REQUEST', message: 'Invalid parent comment' });
    }

    const comment = await prisma.$transaction(async (tx) => {
      const created = await tx.comment.create({
        data: { text: body.text, userId, videoId: id, parentId: body.parentId ?? null },
        include: { user: { select: { id: true, username: true, displayName: true, avatarUrl: true } } },
      });
      await tx.video.update({ where: { id }, data: { commentCount: { increment: 1 } } });
      return created;
    });
    await RecommendationService.recordInteraction(userId, id, 'comment', 4);
    await NotificationService.notifyComment(video.userId, userId, id, body.text);
    return reply.status(201).send({ comment: { ...comment, isLiked: false } });
  });
}
