import { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { Prisma } from '@prisma/client';
import { prisma } from '../config/database';
import { optionalAuth } from '../middleware/auth';
import { aggregateProductFunnel, aggregateWatch } from '../services/analyticsAggregation';

/**
 * Télémétrie ORKY — Lot 2 (PLAN-ORCHIDS).
 *
 * Le client ORKY n'envoie jamais une requête par frame vidéo : il agrège des
 * événements par milestones (video_started, 25/50/75 %, video_completed…),
 * débounce + flush à la sortie de la vidéo, avec un eventId unique par événement
 * (idempotence) et un sessionId par session de lecture.
 *
 * POST /v1/telemetry/batch
 * Body : { sessionId, events: [{ eventId, type, ts?, videoId?, productId?, payload? }] }
 */
export const TELEMETRY_EVENT_TYPES = [
  'video_impression',
  'video_started',
  'video_25_percent',
  'video_50_percent',
  'video_75_percent',
  'video_completed',
  'video_replayed',
  'video_shared',
  'video_saved',
  'creator_followed',
  'product_impression',
  'product_clicked',
  'product_detail_viewed',
  'add_to_cart',
  'remove_from_cart',
  'checkout_handoff_created',
  'checkout_started',
  'checkout_cancelled',
  'checkout_paid',
] as const;

export type TelemetryEventType = (typeof TELEMETRY_EVENT_TYPES)[number];

const telemetryEventSchema = z.object({
  eventId: z.string().min(8).max(128),
  type: z.enum(TELEMETRY_EVENT_TYPES),
  ts: z.string().max(40).optional(),
  videoId: z.string().max(128).optional(),
  productId: z.string().max(128).optional(),
  payload: z.record(z.unknown()).optional(),
});

export const telemetryBatchSchema = z.object({
  sessionId: z.string().min(1).max(128),
  events: z.array(telemetryEventSchema).min(1).max(100),
});

export type TelemetryBatchInput = z.infer<typeof telemetryBatchSchema>;

/** Déduplique un lot par eventId (première occurrence conservée). */
export function dedupeEvents(events: TelemetryBatchInput['events']): TelemetryBatchInput['events'] {
  const seen = new Set<string>();
  const unique: TelemetryBatchInput['events'] = [];
  for (const event of events) {
    if (seen.has(event.eventId)) continue;
    seen.add(event.eventId);
    unique.push(event);
  }
  return unique;
}

export async function telemetryRoutes(app: FastifyInstance) {
  app.post('/batch', { preHandler: optionalAuth }, async (req: FastifyRequest, reply: FastifyReply) => {
    const parsed = telemetryBatchSchema.safeParse(req.body);
    if (!parsed.success) {
      return reply.status(400).send({
        error: 'INVALID_PAYLOAD',
        issues: parsed.error.issues.map((issue) => `${issue.path.join('.') || '$'}: ${issue.message}`),
      });
    }

    const { sessionId, events } = parsed.data;
    const userId = (req as { userId?: string }).userId;

    const unique = dedupeEvents(events);

    const existing = await prisma.analyticsEvent.findMany({
      where: { eventId: { in: unique.map((event) => event.eventId) } },
      select: { eventId: true },
    });
    const existingIds = new Set(existing.map((row) => row.eventId));
    const toInsert = unique.filter((event) => !existingIds.has(event.eventId));

    if (toInsert.length > 0) {
      await prisma.analyticsEvent.createMany({
        data: toInsert.map((event) => ({
          sessionId,
          userId: userId ?? null,
          eventId: event.eventId,
          type: event.type,
          videoId: event.videoId ?? null,
          productId: event.productId ?? null,
          payload: (event.payload ?? {}) as Prisma.InputJsonValue,
          createdAt: event.ts ? new Date(event.ts) : new Date(),
        })),
      });
    }

    return reply.send({ accepted: toInsert.length, duplicates: events.length - toInsert.length });
  });

  /**
   * GET /v1/telemetry/funnel?videoId=…[&productId=…]
   *
   * Signal COMMERCE agrégé (Lot 3) : entonnoir de lecture d'une vidéo et/ou
   * entonnoir produit, dérivés à la demande des AnalyticsEvent (90 jours).
   * Sert de « mémoire » par tendance/produit côté ORKY ; le signal est ensuite
   * joint au signal viral par la UI (commerceStats) avant envoi vers Pro.
   */
  app.get('/funnel', { preHandler: optionalAuth }, async (req: FastifyRequest, reply: FastifyReply) => {
    const query = req.query as { videoId?: string; productId?: string; windowDays?: string };
    const videoId = typeof query.videoId === 'string' ? query.videoId.trim().slice(0, 128) : '';
    const productId = typeof query.productId === 'string' ? query.productId.trim().slice(0, 128) : '';
    if (!videoId && !productId) {
      return reply.status(400).send({ error: 'videoId or productId is required' });
    }
    const parsedWindow = Number.parseInt(String(query.windowDays || ''), 10);
    const windowDays = Number.isFinite(parsedWindow) ? Math.min(365, Math.max(1, parsedWindow)) : undefined;

    try {
      const [video, product] = await Promise.all([
        videoId ? aggregateWatch(videoId, windowDays) : Promise.resolve(null),
        productId ? aggregateProductFunnel(productId, windowDays) : Promise.resolve(null),
      ]);
      const productHasActivity = product
        ? product.impressions + product.clicks + product.detailViews + product.addToCarts + product.checkoutHandoffs + product.checkoutsStarted + product.checkoutsCancelled + product.removeFromCarts + product.paid > 0
        : false;
      return reply.send({
        video: video && video.sessionsStarted > 0 ? video : null,
        product: product && productHasActivity ? product : null,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'unknown error';
      return reply.status(502).send({ error: 'AGGREGATION_FAILED', message });
    }
  });
}