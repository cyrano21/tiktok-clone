/**
 * Signal commerce (PLAN-ORCHIDS Lot 3) — helpers purs, sans dépendance réseau.
 *
 * L'entonnoir agrégé côté backend (GET /v1/telemetry/funnel) est transformé en
 * champ `commerceStats` joint au signal viral avant envoi vers Orchidy Pro.
 * Toute fonction ici est déterministe et testable isolément.
 */

export interface CommerceStats {
  videoId?: string;
  watchSessions?: number;
  watchCompletionRate?: number;
  aggregatedAt?: string;
}

export interface FunnelAggregate {
  videoId: string;
  sessionsStarted: number;
  sessionsCompleted: number;
  watchCompletionRate: number | null;
  milestones: Record<string, number>;
}

/** Extrait l'identifiant vidéo ORKY d'un signal (les signaux scraper sont `trend-…`). */
export function videoIdFromSignal(id: string): string | null {
  if (!id) return null;
  const candidate = id.startsWith('trend-') ? id.slice('trend-'.length) : id;
  return /^[A-Za-z0-9_-]{1,128}$/.test(candidate) ? candidate : null;
}

/**
 * Mappe un agrégat d'entonnoir vers le champ commerceStats envoyé à Pro.
 * Retourne undefined quand il n'y a encore aucune donnée — Pro ne reçoit
 * alors que le signal viral (champ optionnel du schéma V1, rétro-compatible).
 */
export function toCommerceStats(funnel: FunnelAggregate | null | undefined): CommerceStats | undefined {
  if (!funnel || !funnel.videoId || !(funnel.sessionsStarted > 0)) return undefined;
  return {
    videoId: funnel.videoId,
    watchSessions: funnel.sessionsStarted,
    watchCompletionRate:
      typeof funnel.watchCompletionRate === 'number' && Number.isFinite(funnel.watchCompletionRate)
        ? Math.max(0, Math.min(1, funnel.watchCompletionRate))
        : undefined,
    aggregatedAt: new Date().toISOString(),
  };
}