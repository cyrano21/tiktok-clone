import { Readable } from 'stream';
import { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { authMiddleware } from '../middleware/auth';
import { prisma } from '../config/database';
import { deleteMediaObjects, ingestMedia } from '../services/video.service';
import { validateOrchidyCatalogItem } from './product-match.routes';

const MAX_REMOTE_BYTES = 100 * 1024 * 1024;

const importExternalSchema = z.object({
  externalVideoId: z.string().trim().min(1).max(128).regex(/^[A-Za-z0-9_-]+$/),
  sourceUrl: z.string().url().max(2000),
  title: z.string().trim().min(1).max(150),
  duration: z.number().min(0).max(3600).optional().default(0),
  hashtags: z.array(z.string().trim().min(1).max(64)).max(20).optional().default([]),
  creatorUsername: z.string().trim().max(100).optional().default(''),
  creatorDisplayName: z.string().trim().max(200).optional().default(''),
  creatorAvatarUrl: z.string().url().max(2000).optional(),
  orchidyCatalogItemId: z.string().trim().min(1).max(300).optional(),
  variantKey: z.string().trim().max(300).optional().default(''),
  confidence: z.number().min(0).max(1).optional().default(1),
}).strict();

function withTimeout<T>(promise: Promise<T>, milliseconds: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('Upstream timeout')), milliseconds);
    promise.then(
      (value) => { clearTimeout(timer); resolve(value); },
      (error) => { clearTimeout(timer); reject(error); },
    );
  });
}

function scraperInternalUrl(): string {
  return String(process.env.SCRAPER_API_INTERNAL_URL || 'http://127.0.0.1:8502').replace(/\/$/, '');
}

function scraperSecret(): string {
  return String(process.env.SCRAPER_INTERNAL_SECRET || '').trim();
}

async function fetchExternalVideo(videoId: string): Promise<{ stream: Readable; mimetype: string }> {
  const url = `${scraperInternalUrl()}/api/stream/${encodeURIComponent(videoId)}`;
  const headers: Record<string, string> = { accept: 'video/mp4' };
  if (scraperSecret()) headers['x-scraper-internal-secret'] = scraperSecret();
  const response = await withTimeout(fetch(url, { headers }), 45_000);
  if (!response.ok || !response.body) {
    const error = new Error(`External video unavailable (${response.status})`);
    (error as any).statusCode = 502;
    throw error;
  }
  const contentType = String(response.headers.get('content-type') || '').split(';')[0].trim().toLowerCase();
  if (contentType && !new Set(['video/mp4', 'video/webm', 'video/quicktime']).has(contentType)) {
    const error = new Error('External asset is not a supported video');
    (error as any).statusCode = 415;
    throw error;
  }
  const declared = Number(response.headers.get('content-length') || 0);
  if (Number.isFinite(declared) && declared > MAX_REMOTE_BYTES) {
    const error = new Error('External video exceeds the 100 MB limit');
    (error as any).statusCode = 413;
    throw error;
  }
  return {
    stream: Readable.fromWeb(response.body as any),
    mimetype: contentType || 'video/mp4',
  };
}

async function findImportedVideo(externalVideoId: string) {
  return prisma.video.findFirst({
    where: { externalPlatform: 'tiktok', externalContentId: externalVideoId },
    select: { id: true },
  });
}

/** Importe une référence externe (catalogue scraper) en vidéo ORKY native.
 *
 * La vidéo devient une entité de premier rang (média ingesté, hashtags,
 * produit associé actif) tout en conservant sa provenance (externalPlatform,
 * externalContentId, créateur d'origine) pour ne jamais la confondre avec un
 * upload natif. Idempotent : la provenance est unique globalement.
 */
export async function externalImportRoutes(app: FastifyInstance) {
  app.post('/import-external', { preHandler: authMiddleware }, async (req: FastifyRequest, reply: FastifyReply) => {
    const userId = (req as any).userId as string;
    const body = importExternalSchema.parse(req.body);

    if (body.orchidyCatalogItemId) {
      const validation = await validateOrchidyCatalogItem(body.orchidyCatalogItemId);
      if (!validation.ok) {
        return reply.status(422).send({
          error: validation.reason,
          message: 'Le produit Orchidy doit être publié et achetable avant l’import.',
        });
      }
    }

    const existing = await findImportedVideo(body.externalVideoId);
    if (existing) {
      return reply.send({ success: true, idempotent: true, videoId: existing.id });
    }

    const remote = await fetchExternalVideo(body.externalVideoId);
    const processed = await ingestMedia({
      stream: remote.stream,
      filename: `tiktok-${body.externalVideoId}.mp4`,
      mimetype: remote.mimetype,
    });

    try {
      const result = await prisma.$transaction(async (tx) => {
        const video = await tx.video.create({
          data: {
            userId,
            title: body.title,
            description: null,
            videoUrl: processed.videoUrl,
            thumbnailUrl: processed.thumbnailUrl,
            coverUrl: processed.thumbnailUrl,
            videoStorageKey: processed.videoKey,
            thumbnailStorageKey: processed.thumbnailKey,
            sourceType: 'ORKY_NATIVE',
            externalPlatform: 'tiktok',
            externalContentId: body.externalVideoId,
            externalUrl: body.sourceUrl,
            externalCreatorUsername: body.creatorUsername || null,
            externalCreatorDisplayName: body.creatorDisplayName || null,
            externalCreatorAvatarUrl: body.creatorAvatarUrl || null,
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

        await tx.user.update({
          where: { id: userId },
          data: { videoCount: { increment: 1 } },
        });

        for (const name of [...new Set(body.hashtags.map((tag) => tag.toLocaleLowerCase()))]) {
          const hashtag = await tx.hashtag.upsert({
            where: { name },
            create: { name, videoCount: 1 },
            update: { videoCount: { increment: 1 } },
            select: { id: true },
          });
          await tx.videoHashtag.create({ data: { videoId: video.id, hashtagId: hashtag.id } });
        }

        let productMatchId: string | null = null;
        if (body.orchidyCatalogItemId) {
          const match = await tx.videoProductMatch.create({
            data: {
              videoId: video.id,
              orchidyCatalogItemId: body.orchidyCatalogItemId,
              variantKey: body.variantKey,
              confidence: body.confidence,
              source: 'import',
              status: 'active',
            },
            select: { id: true },
          });
          productMatchId = match.id;
        }

        return { videoId: video.id, productMatchId };
      });
      return reply.status(201).send({ success: true, idempotent: false, ...result });
    } catch (error: any) {
      await deleteMediaObjects([processed.videoKey, processed.thumbnailKey]);
      if (error?.code === 'P2002') {
        const winner = await findImportedVideo(body.externalVideoId);
        if (winner) {
          return reply.send({ success: true, idempotent: true, videoId: winner.id });
        }
      }
      throw error;
    }
  });
}
