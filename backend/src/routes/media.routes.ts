import { GetObjectCommand } from '@aws-sdk/client-s3';
import { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { optionalAuth } from '../middleware/auth';
import { prisma } from '../config/database';
import { S3_BUCKET, s3Client } from '../config/s3';
import { objectKeyFromPublicUrl } from '../services/video.service';

async function isFriend(viewerId: string, ownerId: string) {
  const [viewerFollowsOwner, ownerFollowsViewer] = await Promise.all([
    prisma.follow.findUnique({
      where: { followerId_followingId: { followerId: viewerId, followingId: ownerId } },
      select: { id: true },
    }),
    prisma.follow.findUnique({
      where: { followerId_followingId: { followerId: ownerId, followingId: viewerId } },
      select: { id: true },
    }),
  ]);
  return Boolean(viewerFollowsOwner && ownerFollowsViewer);
}

async function canView(visibility: string, ownerId: string, viewerId?: string) {
  if (visibility === 'public') return true;
  if (!viewerId) return false;
  if (viewerId === ownerId) return true;
  if (visibility === 'friends') return isFriend(viewerId, ownerId);
  return false;
}

function mediaKey(storedKey: string | null | undefined, legacyUrl: string | null | undefined) {
  const direct = String(storedKey || '').trim();
  if (direct && !direct.includes('..') && !direct.startsWith('/')) return direct;
  return objectKeyFromPublicUrl(legacyUrl);
}

async function streamObject(input: {
  req: FastifyRequest;
  reply: FastifyReply;
  key: string;
  cachePublic: boolean;
  fallbackContentType: string;
}) {
  const range = typeof input.req.headers.range === 'string' ? input.req.headers.range : undefined;
  const object = await s3Client.send(new GetObjectCommand({
    Bucket: S3_BUCKET,
    Key: input.key,
    ...(range ? { Range: range } : {}),
  }));
  if (!object.Body) return input.reply.status(404).send({ error: 'NOT_FOUND', message: 'Media object not found' });

  input.reply.header('Content-Type', object.ContentType || input.fallbackContentType);
  input.reply.header('Accept-Ranges', 'bytes');
  input.reply.header('Cache-Control', input.cachePublic ? 'public, max-age=3600' : 'private, no-store');
  input.reply.header('X-Content-Type-Options', 'nosniff');
  if (object.ContentLength !== undefined) input.reply.header('Content-Length', String(object.ContentLength));
  if (object.ContentRange) input.reply.header('Content-Range', object.ContentRange);
  if (object.ETag) input.reply.header('ETag', object.ETag);
  if (range && object.ContentRange) input.reply.status(206);
  return input.reply.send(object.Body as any);
}

async function loadVideo(id: string) {
  return prisma.video.findFirst({
    where: {
      id,
      user: {
        isBanned: false,
        OR: [{ suspendedUntil: null }, { suspendedUntil: { lte: new Date() } }],
      },
    },
    select: {
      id: true,
      userId: true,
      visibility: true,
      videoUrl: true,
      thumbnailUrl: true,
      videoStorageKey: true,
      thumbnailStorageKey: true,
    },
  });
}

export async function mediaRoutes(app: FastifyInstance) {
  app.get('/videos/:id', { preHandler: optionalAuth }, async (req: FastifyRequest, reply: FastifyReply) => {
    const { id } = z.object({ id: z.string().uuid() }).parse(req.params);
    const viewerId = (req as any).userId as string | undefined;
    const video = await loadVideo(id);
    if (!video || !(await canView(video.visibility, video.userId, viewerId))) {
      return reply.status(404).send({ error: 'NOT_FOUND', message: 'Video not found' });
    }
    const key = mediaKey(video.videoStorageKey, video.videoUrl);
    if (!key) return reply.status(404).send({ error: 'MEDIA_NOT_FOUND', message: 'Video object unavailable' });
    return streamObject({ req, reply, key, cachePublic: video.visibility === 'public', fallbackContentType: 'video/mp4' });
  });

  app.get('/thumbnails/:id', { preHandler: optionalAuth }, async (req: FastifyRequest, reply: FastifyReply) => {
    const { id } = z.object({ id: z.string().uuid() }).parse(req.params);
    const viewerId = (req as any).userId as string | undefined;
    const video = await loadVideo(id);
    if (!video || !(await canView(video.visibility, video.userId, viewerId))) {
      return reply.status(404).send({ error: 'NOT_FOUND', message: 'Video not found' });
    }
    const key = mediaKey(video.thumbnailStorageKey, video.thumbnailUrl);
    if (!key) return reply.status(404).send({ error: 'MEDIA_NOT_FOUND', message: 'Thumbnail object unavailable' });
    return streamObject({ req, reply, key, cachePublic: video.visibility === 'public', fallbackContentType: 'image/jpeg' });
  });
}
