import { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { authMiddleware } from '../middleware/auth';
import { prisma } from '../config/database';
import {
  deleteMediaObjects,
  ingestComposition,
  type CompositionClip,
  type CompositionSource,
} from '../services/video.service';

const filterSchema = z.object({
  brightness: z.number().min(50).max(150).optional(),
  contrast: z.number().min(50).max(150).optional(),
  saturate: z.number().min(0).max(200).optional(),
  grayscale: z.number().min(0).max(100).optional(),
  sepia: z.number().min(0).max(100).optional(),
}).strict().default({});

const clipSchema = z.object({
  id: z.string().min(1).max(128),
  sourceField: z.string().regex(/^source_\d+$/),
  kind: z.enum(['video', 'image']),
  trimStart: z.number().min(0).max(600),
  trimEnd: z.number().min(0).max(600),
  imageDuration: z.number().min(0).max(15),
  overlayText: z.string().max(120).default(''),
  filters: filterSchema,
  transition: z.enum(['none', 'fade']).default('none'),
}).strict();

const compositionSchema = z.object({
  version: z.literal(1),
  clips: z.array(clipSchema).min(1).max(20),
}).strict();

const metadataSchema = z.object({
  title: z.string().trim().max(150).optional(),
  description: z.string().trim().max(5000).default(''),
  visibility: z.enum(['public', 'friends', 'private']).default('public'),
  allowDuet: z.boolean().default(true),
  allowStitch: z.boolean().default(true),
  allowComment: z.boolean().default(true),
});

function savedValue(values: Record<string, any>, name: string): string | undefined {
  const raw = values?.[name];
  const field = Array.isArray(raw) ? raw[raw.length - 1] : raw;
  if (!field || field.value === undefined || field.value === null) return undefined;
  return String(field.value);
}

function parseBoolean(value: string | undefined, fallback: boolean) {
  if (value === undefined) return fallback;
  return value === 'true' || value === '1';
}

function parseComposition(value: string | undefined) {
  if (!value) {
    const error = new Error('composition is required');
    (error as any).statusCode = 400;
    throw error;
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(value);
  } catch {
    const error = new Error('composition must be valid JSON');
    (error as any).statusCode = 400;
    throw error;
  }
  return compositionSchema.parse(parsed);
}

function extractHashtagNames(text: string) {
  const matches = text.matchAll(/#([\p{L}\p{N}_]{1,64})/gu);
  return [...new Set(Array.from(matches, (match) => match[1].toLocaleLowerCase()))].slice(0, 20);
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

export async function compositionRoutes(app: FastifyInstance) {
  app.post('/compose', {
    preHandler: authMiddleware,
    // The media service enforces 400 MB aggregate source bytes. This slightly
    // higher request cap leaves room for multipart boundaries and metadata.
    bodyLimit: 420 * 1024 * 1024,
  }, async (req: FastifyRequest, reply: FastifyReply) => {
    if (!req.isMultipart()) {
      return reply.status(415).send({ error: 'UNSUPPORTED_MEDIA_TYPE', message: 'Expected multipart/form-data' });
    }

    const { files, values } = await req.saveRequestFiles({
      limits: {
        fileSize: 100 * 1024 * 1024,
        files: 8,
        fields: 32,
        parts: 48,
      },
    });

    if (!files.length) {
      return reply.status(400).send({ error: 'MEDIA_REQUIRED', message: 'At least one composition source is required' });
    }

    const metadata = metadataSchema.parse({
      title: savedValue(values as Record<string, any>, 'title') || undefined,
      description: savedValue(values as Record<string, any>, 'description') ?? '',
      visibility: savedValue(values as Record<string, any>, 'visibility') || 'public',
      allowDuet: parseBoolean(savedValue(values as Record<string, any>, 'allowDuet'), true),
      allowStitch: parseBoolean(savedValue(values as Record<string, any>, 'allowStitch'), true),
      allowComment: parseBoolean(savedValue(values as Record<string, any>, 'allowComment'), true),
    });
    if (metadata.visibility !== 'public') return privateVisibilityNotReady(reply);

    const composition = parseComposition(savedValue(values as Record<string, any>, 'composition'));
    const duplicatedFields = new Set<string>();
    const seenFields = new Set<string>();
    for (const file of files) {
      if (seenFields.has(file.fieldname)) duplicatedFields.add(file.fieldname);
      seenFields.add(file.fieldname);
    }
    if (duplicatedFields.size > 0) {
      return reply.status(400).send({
        error: 'INVALID_COMPOSITION_SOURCE',
        message: 'Each source field must appear exactly once',
      });
    }

    const referencedFields = new Set(composition.clips.map((clip) => clip.sourceField));
    const sources: CompositionSource[] = files.map((file) => ({
      fieldName: file.fieldname,
      filePath: file.filepath,
      filename: file.filename,
      mimetype: file.mimetype,
    }));
    const uploadedFields = new Set(sources.map((source) => source.fieldName));
    for (const field of referencedFields) {
      if (!uploadedFields.has(field)) {
        return reply.status(400).send({
          error: 'INVALID_COMPOSITION_SOURCE',
          message: `Composition source ${field} is missing`,
        });
      }
    }
    for (const field of uploadedFields) {
      if (!referencedFields.has(field) || !/^source_\d+$/.test(field)) {
        return reply.status(400).send({
          error: 'INVALID_COMPOSITION_SOURCE',
          message: `Unexpected composition source ${field}`,
        });
      }
    }

    const processed = await ingestComposition({
      sources,
      clips: composition.clips as CompositionClip[],
    });

    const userId = (req as any).userId as string;
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
        user: {
          select: {
            id: true,
            username: true,
            displayName: true,
            avatarUrl: true,
            isVerified: true,
            followerCount: true,
            followingCount: true,
            likeCount: true,
            videoCount: true,
          },
        },
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
      processing: {
        sourceSizeBytes: processed.sourceSizeBytes,
        normalized: true,
        composition: true,
        clips: composition.clips.length,
        format: 'video/mp4',
      },
    });
  });
}
