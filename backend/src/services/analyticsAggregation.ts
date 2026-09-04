import { prisma } from '../config/database';

/**
 * Agrégation de la télémétrie ORKY — Lot 3 (PLAN-ORCHIDS).
 *
 * Transforme les AnalyticsEvent (Lot 2) en signal COMMERCE agrégé :
 * - entonnoir de lecture vidéo (sessions démarrées / complétées, taux de
 *   complétion moyen, répartitions des milestones) par vidéo ;
 * - entonnoir produit (impressions → clics → paniers → checkout → payé) par
 *   produit.
 *
 * Le calcul est 100 % déterministe (aucune LLM) et se fait à la demande :
 * aucune table d'agrégat — les AnalyticsEvent restent la source de vérité.
 * La complétion d'une session est le milestone maximal atteint
 * (video_completed = 1.0, 75 % = 0.75, …) — un comptage exact d'événements
 * ne biaise pas la moyenne.
 */

export interface WatchMilestoneCounts {
  started: number;
  p25: number;
  p50: number;
  p75: number;
  completed: number;
  replayed: number;
}

export interface WatchAggregate {
  videoId: string;
  sessionsStarted: number;
  sessionsCompleted: number;
  /** Moyenne des complétions par session (0..1), null si aucune session. */
  watchCompletionRate: number | null;
  milestones: WatchMilestoneCounts;
}

export interface ProductFunnelAggregate {
  productId: string;
  impressions: number;
  clicks: number;
  detailViews: number;
  addToCarts: number;
  removeFromCarts: number;
  checkoutHandoffs: number;
  checkoutsStarted: number;
  checkoutsCancelled: number;
  paid: number;
}

const MILESTONE_FRACTION: Record<string, number> = {
  video_started: 0,
  video_25_percent: 0.25,
  video_50_percent: 0.5,
  video_75_percent: 0.75,
  video_completed: 1,
};

export type WatchEventRow = { sessionId: string; type: string };

/** Agrégat pur de l'entonnoir de lecture — aucune IO, testable directement. */
export function foldWatchAggregate(videoId: string, rows: WatchEventRow[]): WatchAggregate {
  const perSession = new Map<string, number>();
  const milestones: WatchMilestoneCounts = {
    started: 0,
    p25: 0,
    p50: 0,
    p75: 0,
    completed: 0,
    replayed: 0,
  };

  for (const row of rows) {
    const fraction = MILESTONE_FRACTION[row.type];
    if (fraction !== undefined) {
      const previous = perSession.get(row.sessionId) ?? -1;
      if (fraction > previous) perSession.set(row.sessionId, fraction);
    }
    if (row.type === 'video_started') milestones.started += 1;
    else if (row.type === 'video_25_percent') milestones.p25 += 1;
    else if (row.type === 'video_50_percent') milestones.p50 += 1;
    else if (row.type === 'video_75_percent') milestones.p75 += 1;
    else if (row.type === 'video_completed') milestones.completed += 1;
    else if (row.type === 'video_replayed') milestones.replayed += 1;
  }

  const sessionsStarted = perSession.size;
  const sessionsCompleted = [...perSession.values()].filter((value) => value >= 1).length;
  const watchCompletionRate =
    sessionsStarted > 0
      ? Math.round(([...perSession.values()].reduce((sum, value) => sum + value, 0) / sessionsStarted) * 1000) / 1000
      : null;

  return {
    videoId,
    sessionsStarted,
    sessionsCompleted,
    watchCompletionRate,
    milestones,
  };
}

type ProductFunnelCountKey = keyof Omit<ProductFunnelAggregate, 'productId'>;

const TYPE_TO_FUNNEL_KEY: Record<string, ProductFunnelCountKey> = {
  product_impression: 'impressions',
  product_clicked: 'clicks',
  product_detail_viewed: 'detailViews',
  add_to_cart: 'addToCarts',
  remove_from_cart: 'removeFromCarts',
  checkout_handoff_created: 'checkoutHandoffs',
  checkout_started: 'checkoutsStarted',
  checkout_cancelled: 'checkoutsCancelled',
  checkout_paid: 'paid',
};

export type ProductFunnelRow = { type: string };

function emptyProductFunnel(productId: string): ProductFunnelAggregate {
  return {
    productId,
    impressions: 0,
    clicks: 0,
    detailViews: 0,
    addToCarts: 0,
    removeFromCarts: 0,
    checkoutHandoffs: 0,
    checkoutsStarted: 0,
    checkoutsCancelled: 0,
    paid: 0,
  };
}

/** Agrégat pur à partir de comptages par type d'événement — aucune IO, testable. */
export function foldProductFunnelCounts(productId: string, counts: Record<string, number>): ProductFunnelAggregate {
  const funnel = emptyProductFunnel(productId);
  for (const [type, count] of Object.entries(counts)) {
    const target = TYPE_TO_FUNNEL_KEY[type];
    if (target && count > 0) funnel[target] = Math.round(count);
  }
  return funnel;
}

/** Agrégat pur de l'entonnoir produit (lignes) — délègue au fold par comptage. */
export function foldProductFunnel(productId: string, rows: ProductFunnelRow[]): ProductFunnelAggregate {
  const counts: Record<string, number> = {};
  for (const row of rows) counts[row.type] = (counts[row.type] || 0) + 1;
  return foldProductFunnelCounts(productId, counts);
}

/** Fenêtre de lecture par défaut des agrégats (90 jours). */
export const AGGREGATION_WINDOW_DAYS = 90;

/** Interroge la DB et plie l'entonnoir de lecture d'une vidéo. */
export async function aggregateWatch(videoId: string, windowDays = AGGREGATION_WINDOW_DAYS): Promise<WatchAggregate> {
  const since = new Date(Date.now() - windowDays * 24 * 60 * 60 * 1000);
  const rows = await prisma.analyticsEvent.findMany({
    where: {
      videoId,
      type: { in: ['video_started', 'video_25_percent', 'video_50_percent', 'video_75_percent', 'video_completed', 'video_replayed'] },
      createdAt: { gte: since },
    },
    select: { sessionId: true, type: true },
  });
  return foldWatchAggregate(videoId, rows);
}

/** Interroge la DB et plie l'entonnoir commerce d'un produit. */
export async function aggregateProductFunnel(productId: string, windowDays = AGGREGATION_WINDOW_DAYS): Promise<ProductFunnelAggregate> {
  const since = new Date(Date.now() - windowDays * 24 * 60 * 60 * 1000);
  const grouped = await prisma.analyticsEvent.groupBy({
    by: ['type'],
    where: {
      productId,
      type: {
        in: [
          'product_impression',
          'product_clicked',
          'product_detail_viewed',
          'add_to_cart',
          'remove_from_cart',
          'checkout_handoff_created',
          'checkout_started',
          'checkout_cancelled',
          'checkout_paid',
        ],
      },
      createdAt: { gte: since },
    },
    _count: { _all: true },
  });

  const counts: Record<string, number> = {};
  for (const entry of grouped) counts[entry.type] = entry._count._all;
  return foldProductFunnelCounts(productId, counts);
}
