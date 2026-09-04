/**
 * Télémétrie ORKY — Lot 2 (PLAN-ORCHIDS).
 *
 * Le client n'envoie JAMAIS une requête par frame vidéo :
 * - événements par milestones (started / 25 / 50 / 75 / completed / replayed) ;
 * - buffer + flush (taille >= 20 ou 5 s) ;
 * - flush à la sortie / perte de visibilité de la page ;
 * - un `eventId` unique par événement et un `sessionId` par session (idempotence,
 *   le backend déduplique) ;
 * - aucun appel réseau tant que le buffer n'est pas vidé.
 */
/** Miroir client des types validés par le backend (POST /v1/telemetry/batch). */
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

export interface TelemetryEventData {
  type: TelemetryEventType;
  videoId?: string;
  productId?: string;
  handoffId?: string;
  payload?: Record<string, unknown>;
}

export interface TelemetryEvent extends TelemetryEventData {
  eventId: string;
  ts: string;
}

export interface TelemetryBatch {
  sessionId: string;
  events: TelemetryEvent[];
}

function newId(prefix: string): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 12)}`;
}

function createSessionId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `session_${Date.now()}_${Math.random().toString(36).slice(2, 12)}`;
}

type Transport = (batch: TelemetryBatch) => Promise<unknown>;

async function defaultTransport(batch: TelemetryBatch): Promise<unknown> {
  // Import dynamique : évite tout cycle avec api.ts / authTokenStore.
  const { apiClient } = await import('./api');
  return apiClient.post('/telemetry/batch', batch);
}

let transport: Transport = defaultTransport;

/** Injectable pour les tests ; `null` restaure le transport HTTP réel. */
export function setTelemetryTransport(fake: Transport | null): void {
  transport = fake ?? defaultTransport;
}

const sessionId = createSessionId();
const buffer: TelemetryEvent[] = [];
const MAX_BATCH_SIZE = 20;
const FLUSH_INTERVAL_MS = 5000;
let flushTimer: ReturnType<typeof setTimeout> | null = null;
let exitListenersRegistered = false;

function scheduleFlush(): void {
  if (flushTimer) return;
  flushTimer = setTimeout(() => {
    flushTimer = null;
    void flushNow();
  }, FLUSH_INTERVAL_MS);
}

function registerExitFlush(): void {
  if (exitListenersRegistered || typeof window === 'undefined') return;
  exitListenersRegistered = true;
  const flush = () => void flushNow();
  window.addEventListener('pagehide', flush);
  window.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') flush();
  });
}

/** Bufferise un événement ; aucun réseau tant que le buffer n'est pas vidé. */
export function track(type: TelemetryEventType, data: Omit<TelemetryEventData, 'type'> = {}): void {
  buffer.push({
    eventId: newId('evt'),
    ts: new Date().toISOString(),
    type,
    videoId: data.videoId,
    productId: data.productId,
    handoffId: data.handoffId,
    payload: data.payload,
  });
  registerExitFlush();
  if (buffer.length >= MAX_BATCH_SIZE) {
    void flushNow();
  } else {
    scheduleFlush();
  }
}

/** Vide le buffer vers POST /v1/telemetry/batch (dédupliqué côté serveur par eventId). */
export async function flushNow(): Promise<{ accepted: number; duplicates: number } | null> {
  if (flushTimer) {
    clearTimeout(flushTimer);
    flushTimer = null;
  }
  if (buffer.length === 0) return null;
  const events = buffer.splice(0, buffer.length);
  try {
    const response = (await transport({ sessionId, events })) as
      | { data?: { accepted?: number; duplicates?: number } }
      | { accepted?: number; duplicates?: number }
      | undefined;
    const body =
      response && typeof response === 'object' && 'data' in response
        ? (response as { data?: { accepted?: number; duplicates?: number } }).data
        : (response as { accepted?: number; duplicates?: number } | undefined);
    return { accepted: body?.accepted ?? events.length, duplicates: body?.duplicates ?? 0 };
  } catch {
    // Échec réseau : on ne perd pas les événements, on les remet en tête de buffer
    // (le prochain flush retentera ; eventId inchangés → idempotence serveur).
    buffer.unshift(...events);
    return null;
  }
}

/** Réinitialise le buffer (tests uniquement). */
export function resetTelemetryForTests(): void {
  buffer.length = 0;
  if (flushTimer) {
    clearTimeout(flushTimer);
    flushTimer = null;
  }
}

export const WATCH_MILESTONES = [25, 50, 75] as const;

export interface WatchMilestoneEvent {
  type: TelemetryEventType;
  payload?: { watchPercentage: number };
}

/**
 * Traqueur de lecture vidéo (pur, testable sans DOM).
 * - `started` dès que la lecture dépasse ~2 % ;
 * - un seul événement par milestone (25/50/75) et un seul `completed` à 100 % ;
 * - boucle détectée (retour < 10 % après complétion) → `video_replayed` puis
 *   nouveaux milestones pour la boucle suivante.
 */
export function createWatchTracker(): { onProgress: (progress: number) => WatchMilestoneEvent[] } {
  let started = false;
  let completed = false;
  let lastProgress = 0;
  const firedMilestones = new Set<string>();

  return {
    onProgress(progress: number): WatchMilestoneEvent[] {
      const events: WatchMilestoneEvent[] = [];
      const p = Math.max(0, Math.min(1, progress));

      if (completed && p < 0.1 && lastProgress >= 0.9) {
        // Boucle de lecture (repeat) : on repart sur un nouveau cycle.
        completed = false;
        started = false;
        firedMilestones.clear();
        events.push({ type: 'video_replayed' });
      }
      lastProgress = p;

      if (p <= 0.02) return events;

      if (!started) {
        started = true;
        events.push({ type: 'video_started' });
      }
      for (const milestone of WATCH_MILESTONES) {
        const key = String(milestone);
        if (p * 100 >= milestone && !firedMilestones.has(key)) {
          firedMilestones.add(key);
          events.push({
            type: `video_${milestone}_percent` as TelemetryEventType,
            payload: { watchPercentage: Math.round(p * 100) },
          });
        }
      }
      if (p >= 1 && !completed) {
        completed = true;
        events.push({ type: 'video_completed', payload: { watchPercentage: 100 } });
      }
      return events;
    },
  };
}