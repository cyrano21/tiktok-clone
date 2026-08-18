import { timingSafeEqual } from 'crypto';
import { Readable } from 'stream';
import { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { authMiddleware } from '../middleware/auth';
import { prisma } from '../config/database';
import { deleteMediaObjects, ingestMedia } from '../services/video.service';
import { validateOrchidyCatalogItem } from './product-match.routes';

const MAX_REMOTE_BYTES = 100 * 1024 * 1024;
const ALLOWED_GENERATED_MEDIA_HOSTS = new Set(['res.cloudinary.com']);

const importSchema = z.object({
  sourceUrl: z.string().url().max(2000),
  externalContentId: z.string().trim().min(8).max(200),
  sourceSignalId: z.string().trim().max(240).optional(),
  orchidyCatalogItemId: z.string().trim().min(1).max(300),
  title: z.string().trim().max(150).optional(),
  description: z.string().trim().max(5000).optional().default(''),
}).strict();

function configuredImportSecret(): string {
  return String(process.env.ORKY_COMMERCE_IMPORT_SECRET || '').trim();
}

function constantTimeSecretMatch(expected: string, provided: string): boolean {
  if (!expected || !provided) return false;
  const left = Buffer.from(expected, 'utf8');
  const right = Buffer.from(provided, 'utf8');
  return left.length === right.length && timingSafeEqual(left, right);
}

function requireInternalImportSecret(req: FastifyRequest, reply: FastifyReply) {
  const expected = configuredImportSecret();
  if (!expected || (process.env.NODE_ENV === 'production' && expected.length < 32)) {
    return reply.status(503).send({ error: 'COMMERCE_IMPORT_NOT_CONFIGURED' });
  }
  const provided = String(req.headers['x-orky-commerce-import-secret'] || '').trim();
  if (!constantTimeSecretMatch(expected, provided)) {
    return reply.status(403).send({ error: 'COMMERCE_IMPORT_FORBIDDEN' });
  }
  return null;
}

function validateGeneratedMediaUrl(raw: string): URL {
  const url = new URL(raw);
  if (url.protocol !== 'https:' || !ALLOWED_GENERATED_MEDIA_HOSTS.has(url.hostname.toLowerCase())) {
    const error = new Error('Generated media must use the trusted Cloudinary host');
    (error as any).statusCode = 422;
    throw error;
  }
  return url;
}

function withTimeout<T>(promise: Promise<T>, milliseconds: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('Upstream timeout')), milliseconds);
    promise.then(
      (value) => { clearTimeout(timer); resolve(value); },
      (error) => { clearTimeout(timer); reject(error); },
    );
  });
}

async function fetchGeneratedVideo(url: URL): Promise<{ stream: Readable; mimetype: string }> {
  const response = await withTimeout(fetch(url, {
    redirect: 'manual',
  }), 20_000);
  if (response.status >= 300 && response.status < 400) {
    const error = new Error('Generated media redirects are not accepted');
    (error as any).statusCode = 422;
    throw error;
  }
  if (!response.ok || !response.body) {
    const error = new Error(`Generated media unavailable (${response.status})`);
    (error as any).statusCode = 502;
    throw error;
  }
  const contentType = String(response.headers.get('content-type') || '').split(';')[0].trim().toLowerCase();
  if (!new Set(['video/mp4', 'video/webm', 'video/quicktime']).has(contentType)) {
    const error = new Error('Generated asset is not a supported video');
    (error as any).statusCode = 415;
    throw error;
  }
  const declared = Number(response.headers.get('content-length') || 0);
  if (Number.isFinite(declared) && declared > MAX_REMOTE_BYTES) {
    const error = new Error('Generated video exceeds the 100 MB limit');
    (error as any).statusCode = 413;
    throw error;
  }
  return {
    stream: Readable.fromWeb(response.body as any),
    mimetype: contentType,
  };
}

export async function commerceImportRoutes(app: FastifyInstance) {
  app.post('/generated-video', { preHandler: authMiddleware }, async (req: FastifyRequest, reply: FastifyReply) => {
    const secretError = requireInternalImportSecret(req, reply);
    if (secretError) return secretError;

    const userId = (req as any).userId as string;
    const body = importSchema.parse(req.body);
    const sourceUrl = validateGeneratedMediaUrl(body.sourceUrl);

    const catalog = await validateOrchidyCatalogItem(body.orchidyCatalogItemId);
    if (!catalog.ok) {
      return reply.status(422).send({
        error: catalog.reason,
        message: 'Le produit Orchidy doit être publié et achetable avant la publication vidéo.',
      });
    }

    const existing = await prisma.video.findFirst({
      where: {
        userId,
        externalPlatform: 'orchidy-pro-generated',
        externalContentId: body.externalContentId,
      },
      select: { id: true },
    });
    if (existing) {
      const match = await prisma.videoProductMatch.upsert({
        where: {
          videoId_orchidyCatalogItemId_variantKey: {
            videoId: existing.id,
            orchidyCatalogItemId: body.orchidyCatalogItemId,
            variantKey: '',
          },
        },
        create: {
          videoId: existing.id,
          orchidyCatalogItemId: body.orchidyCatalogItemId,
          variantKey: '',
          confidence: 1,
          source: 'import',
          status: 'active',
        },
        update: { confidence: 1, source: 'import', status: 'active' },
      });
      return reply.send({ success: true, idempotent: true, videoId: existing.id, productMatchId: match.id });
    }

    const remote = await fetchGeneratedVideo(sourceUrl);
    const processed = await ingestMedia({
      stream: remote.stream,
      filename: `orchidy-pro-${body.externalContentId}.mp4`,
      mimetype: remote.mimetype,
    });

    try {
      const result = await prisma.$transaction(async (tx) => {
        const video = await tx.video.create({
          data: {
            userId,
            title: body.title || body.description.slice(0, 150) || 'Vidéo produit',
            description: body.description || null,
            videoUrl: processed.videoUrl,
            thumbnailUrl: processed.thumbnailUrl,
            coverUrl: processed.thumbnailUrl,
            videoStorageKey: processed.videoKey,
            thumbnailStorageKey: processed.thumbnailKey,
            sourceType: 'ORKY_NATIVE',
            externalPlatform: 'orchidy-pro-generated',
            externalContentId: body.externalContentId,
            externalUrl: sourceUrl.toString(),
            duration: processed.duration,
            width: processed.width,
            height: processed.height,
            visibility: 'public',
            allowDuet: true,
            allowStitch: true,
            allowComment: true,
          },
          select: { id: true },
        });
        const match = await tx.videoProductMatch.create({
          data: {
            videoId: video.id,
            orchidyCatalogItemId: body.orchidyCatalogItemId,
            variantKey: '',
            confidence: 1,
            source: 'import',
            status: 'active',
          },
          select: { id: true },
        });
        await tx.user.update({
          where: { id: userId },
          data: { videoCount: { increment: 1 } },
        });
        return { videoId: video.id, productMatchId: match.id };
      });
      return reply.status(201).send({ success: true, idempotent: false, ...result });
    } catch (error: any) {
      await deleteMediaObjects([processed.videoKey, processed.thumbnailKey]);
      // A concurrent identical import may win the unique provenance constraint.
      if (error?.code === 'P2002') {
        const winner = await prisma.video.findFirst({
          where: {
            userId,
            externalPlatform: 'orchidy-pro-generated',
            externalContentId: body.externalContentId,
          },
          select: { id: true },
        });
        if (winner) {
          return reply.send({ success: true, idempotent: true, videoId: winner.id });
        }
      }
      throw error;
    }
  });
}
