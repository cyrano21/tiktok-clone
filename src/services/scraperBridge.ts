/** Pont de recherche entre ORKY et le service d'observation TikTok.
 *
 * IMPORTANT: ces éléments restent des références externes en lecture seule.
 * Ils ne deviennent pas des entités sociales ORKY tant qu'ils n'ont pas été
 * explicitement importés dans le modèle canonique.
 */

import type { Video, User, Comment } from '@/types';
import AsyncStorage from '@react-native-async-storage/async-storage';

const AUTH_TOKEN_KEY = '@auth_token';

async function authBearer(): Promise<string | null> {
  try {
    return await AsyncStorage.getItem(AUTH_TOKEN_KEY);
  } catch {
    return null;
  }
}

// Le navigateur parle uniquement au proxy same-origin. Le proxy Next connaît
// l'URL interne Docker et son secret; aucun hostname de conteneur n'est exposé.
const SCRAPER_API = process.env.NEXT_PUBLIC_SCRAPER_API_URL || '/api/scraper';

function scraperUrl(path: string): string {
  const cleanPath = path.replace(/^\/+/, '').replace(/^api\//, '');
  return SCRAPER_API.startsWith('/')
    ? `${SCRAPER_API.replace(/\/$/, '')}/${cleanPath}`
    : `${SCRAPER_API.replace(/\/$/, '')}/api/${cleanPath}`;
}

export interface ScraperProductMatch {
  /** Canonical published Orchidy id, never a supplier/drop-shipping id. */
  orchidyCatalogItemId: string;
  id?: string;
  variantKey?: string;
  confidence?: number;
  source?: string;
  /** 'suggested' = auto-match du catalogue, en attente d'approbation. */
  status?: 'suggested' | 'approved';
}

export interface ScraperVideo {
  id: string;
  title: string;
  views: number;
  likes: number;
  duration: number;
  commentCount: number;
  /** Optional provider metrics; never filled with estimates. */
  shares?: number;
  shareCount?: number;
  saves?: number;
  saveCount?: number;
  sound?: {
    id?: string;
    title?: string;
    artist?: string;
    coverUrl?: string;
  } | null;
  /** Optional explicit match from the observation service to a published item. */
  productMatches?: ScraperProductMatch[];
  orchidyCatalogItemId?: string;
  url: string;
  thumbnailUrl: string;
  hashtags?: string[];
  creatorUsername?: string;
  creatorDisplayName?: string;
  creatorAvatarUrl?: string;
  createdAt?: string;
  comments?: ScraperComment[];
}

interface ScraperComment {
  id: string;
  text: string;
  username: string;
  nickname: string;
  likes: number;
  replyCount: number;
  createdAt: string;
  avatarUrl?: string;
  replies?: any[];
}

interface ScraperStats {
  totalComments: number;
  totalVideos: number;
  uniqueUsers: number;
  spamCount: number;
  lastScraped: string;
}

let cachedVideos: Video[] | null = null;
let cachedAt = 0;
const cachedComments = new Map<string, ScraperComment[]>();
const CACHE_TTL_MS = 60_000;

async function isAvailable(): Promise<boolean> {
  try {
    const res = await fetch(scraperUrl('stats'), { signal: AbortSignal.timeout(2000) });
    return res.ok;
  } catch { return false; }
}

async function fetchScraperVideos(): Promise<ScraperVideo[]> {
  try {
    const res = await fetch(scraperUrl('videos'), { signal: AbortSignal.timeout(3000) });
    if (!res.ok) return [];
    const data = await res.json();
    return data.videos ?? [];
  } catch { return []; }
}

async function fetchScraperStats(): Promise<ScraperStats | null> {
  try {
    const res = await fetch(scraperUrl('stats'), { signal: AbortSignal.timeout(2000) });
    if (!res.ok) return null;
    return await res.json();
  } catch { return null; }
}

async function fetchComments(videoId: string): Promise<ScraperComment[]> {
  const realId = videoId.startsWith('scraper-') ? videoId.slice(8) : videoId;
  const res = await fetch(scraperUrl(`videos/${realId}/comments`), {
    signal: AbortSignal.timeout(10_000),
  });
  if (!res.ok) throw new Error(`Commentaires indisponibles (${res.status})`);
  const data = await res.json();
  return data.comments ?? [];
}

function hasNumericMetric(value: unknown): boolean {
  if (typeof value === 'number') return Number.isFinite(value);
  if (typeof value === 'string' && value.trim() !== '') return Number.isFinite(Number(value));
  return false;
}

function mapHashtags(hashtags: string[] | undefined): Video['hashtags'] {
  if (!hashtags || hashtags.length === 0) return [];
  return hashtags.map((name) => ({
    id: `h-scraper-${name}`,
    name,
    viewsCount: 0,
    videosCount: 0,
    isFollowing: false,
  }));
}

export function toOrkyVideo(sv: ScraperVideo): Video {
  const creatorFromUrl = sv.url.match(/\/@@?([^/]+)/)?.[1] || '';
  const creatorUsername = sv.creatorUsername || creatorFromUrl || 'source-externe';
  const creatorDisplayName = sv.creatorDisplayName || (creatorUsername === 'source-externe' ? 'Créateur externe' : creatorUsername);
  const creatorAvatarUrl = sv.creatorAvatarUrl || '';
  const dur = sv.duration > 0 ? sv.duration : 0;
  const explicitMatches = (sv.productMatches ?? [])
    .filter((match) => typeof match.orchidyCatalogItemId === 'string' && match.orchidyCatalogItemId.trim() !== '')
    .map((match, index) => ({
      id: match.id || `scraper-match-${sv.id}-${index}`,
      orchidyCatalogItemId: match.orchidyCatalogItemId,
      variantKey: match.variantKey,
      confidence: hasNumericMetric(match.confidence) ? Number(match.confidence) : 0,
      source: match.source || 'scraper_observation',
      status: match.status === 'suggested' || match.status === 'approved' ? match.status : undefined,
    }));
  const productMatches = explicitMatches.length > 0
    ? explicitMatches
    : (sv.orchidyCatalogItemId
      ? [{
          id: `scraper-match-${sv.id}`,
          orchidyCatalogItemId: sv.orchidyCatalogItemId,
          confidence: 0,
          source: 'scraper_observation',
        }]
      : []);

  return {
    id: `scraper-${sv.id}`,
    user: {
      id: `external:${creatorUsername}`,
      username: creatorUsername,
      displayName: creatorDisplayName,
      avatarUrl: creatorAvatarUrl,
      bio: '',
      followersCount: 0,
      followingCount: 0,
      likesCount: 0,
      videosCount: 0,
      isVerified: false,
      isFollowing: false,
      isFollowedBy: false,
      createdAt: sv.createdAt || new Date(0).toISOString(),
    },
    videoUrl: scraperUrl(`stream/${sv.id}`),
    // La miniature passe par le proxy scraper : les URLs TikTok signées expirent
    // en ~2 jours et sont rejetées depuis une IP différente. Le scraper re-fetch
    // la cover fraîchement et la sert depuis son cache local.
    thumbnailUrl: scraperUrl(`thumbnail/${sv.id}`),
    description: sv.title || '',
    likesCount: Number(sv.likes || 0),
    commentsCount: Number(sv.commentCount || 0),
    // Keep provider metrics when present; do not invent values for fields the
    // observation API did not return.
    sharesCount: Number(sv.shareCount ?? sv.shares ?? 0),
    savesCount: Number(sv.saveCount ?? sv.saves ?? 0),
    viewsCount: Number(sv.views || 0),
    metricAvailability: {
      likes: hasNumericMetric(sv.likes),
      comments: hasNumericMetric(sv.commentCount),
      shares: hasNumericMetric(sv.shareCount ?? sv.shares),
      saves: hasNumericMetric(sv.saveCount ?? sv.saves),
      views: hasNumericMetric(sv.views),
    },
    duration: Math.round(dur),
    isLiked: false,
    isSaved: false,
    hashtags: mapHashtags(sv.hashtags),
    sound: sv.sound?.title
      ? {
          id: sv.sound.id || `sound-${sv.id}`,
          title: sv.sound.title,
          artist: sv.sound.artist || '',
          coverUrl: sv.sound.coverUrl || sv.thumbnailUrl || '',
          audioUrl: '',
          duration: 0,
          usageCount: 0,
          isOriginal: false,
        }
      : null,
    location: null,
    createdAt: sv.createdAt || new Date(0).toISOString(),
    allowComments: true,
    allowDuet: false,
    allowStitch: false,
    sourceType: 'external_reference',
    interactionMode: 'read_only',
    externalPlatform: 'tiktok',
    externalUrl: sv.url,
    productMatches,
  };
}

function mapComment(sc: ScraperComment, index: number): Comment {
  const username = sc.username || 'source-externe';
  return {
    id: sc.id ? `sc-${sc.id}` : `sc-${index}`,
    user: {
      id: `external:${username}`,
      username,
      displayName: sc.nickname || (username === 'source-externe' ? 'Utilisateur externe' : username),
      avatarUrl: sc.avatarUrl || '',
      bio: '',
      followersCount: 0,
      followingCount: 0,
      likesCount: 0,
      videosCount: 0,
      isVerified: false,
      isFollowing: false,
      isFollowedBy: false,
      createdAt: sc.createdAt || new Date(0).toISOString(),
    },
    text: sc.text,
    likesCount: sc.likes || 0,
    isLiked: false,
    repliesCount: sc.replyCount || 0,
    replies: (sc.replies || []).map((r: any, ri: number) => mapComment(r, ri)),
    createdAt: sc.createdAt || new Date(0).toISOString(),
  };
}

function getCached(): Video[] | null {
  if (cachedVideos && Date.now() - cachedAt < CACHE_TTL_MS) return cachedVideos;
  return null;
}
function setCached(v: Video[]): void { cachedVideos = v; cachedAt = Date.now(); }

export const scraperBridge = {
  isAvailable,
  getStats: fetchScraperStats,

  async getVideos(limit = 20): Promise<Video[]> {
    const c = getCached();
    if (c) return c.slice(0, limit);

    const raw = await fetchScraperVideos();
    if (raw.length === 0) return [];

    // Cache the FULL catalog (not just the requested slice): Discover filters
    // the whole pool per category while the feed only takes its first N items.
    raw.forEach((video) => {
      if (Array.isArray(video.comments)) cachedComments.set(video.id, video.comments);
    });
    const videos = raw.map(toOrkyVideo);
    setCached(videos);
    return videos.slice(0, limit);
  },

  async getComments(videoId: string): Promise<Comment[]> {
    const realId = videoId.startsWith('scraper-') ? videoId.slice(8) : videoId;
    const embedded = cachedComments.get(realId);
    if (embedded) return embedded.map(mapComment);
    const raw = await fetchComments(realId);
    if (raw.length > 0) cachedComments.set(realId, raw);
    return raw.map(mapComment);
  },

  async refresh(): Promise<void> {
    // Purge le cache local (la régénération du catalogue est une action
    // opérationnelle du service scraper, déclenchée via refreshCatalog).
    cachedVideos = null;
    cachedAt = 0;
    cachedComments.clear();
  },

  /** Déclenche la régénération du catalogue (admin ORKY requis côté serveur). */
  async refreshCatalog(comments = 6): Promise<{ ok: boolean; message?: string; error?: string }> {
    try {
      const token = await authBearer();
      const headers: Record<string, string> = { 'content-type': 'application/json' };
      if (token) headers.authorization = `Bearer ${token}`;
      const res = await fetch(scraperUrl('admin/refresh'), {
        method: 'POST',
        headers,
        body: JSON.stringify({ confirm: true, comments }),
        signal: AbortSignal.timeout(15_000),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        return { ok: false, error: (data as any).error || `Régénération impossible (${res.status})` };
      }
      return { ok: true, message: (data as any).message };
    } catch {
      return { ok: false, error: 'Service de recherche externe indisponible.' };
    }
  },

  /** Approuve un produit Orchidy pour une vidéo externe (persisté par le
   *  service d'observation). Nécessite une session ORKY (proxy same-origin). */
  async approveProductMatch(
    videoId: string,
    input: { orchidyCatalogItemId: string; variantKey?: string; confidence?: number },
  ): Promise<boolean> {
    const realId = videoId.startsWith('scraper-') ? videoId.slice(8) : videoId;
    try {
      const token = await authBearer();
      const headers: Record<string, string> = { 'content-type': 'application/json' };
      if (token) headers.authorization = `Bearer ${token}`;
      const res = await fetch(scraperUrl(`videos/${realId}/product-matches`), {
        method: 'POST',
        headers,
        body: JSON.stringify({
          orchidyCatalogItemId: input.orchidyCatalogItemId,
          variantKey: input.variantKey ?? '',
          confidence: input.confidence ?? 1,
        }),
        signal: AbortSignal.timeout(10_000),
      });
      return res.ok;
    } catch {
      return false;
    }
  },

  /** Retire une approbation produit d'une vidéo externe. */
  async removeProductMatch(videoId: string, orchidyCatalogItemId: string): Promise<boolean> {
    const realId = videoId.startsWith('scraper-') ? videoId.slice(8) : videoId;
    try {
      const token = await authBearer();
      const headers: Record<string, string> = {};
      if (token) headers.authorization = `Bearer ${token}`;
      const res = await fetch(
        scraperUrl(`videos/${realId}/product-matches?item=${encodeURIComponent(orchidyCatalogItemId)}`),
        { method: 'DELETE', headers, signal: AbortSignal.timeout(10_000) },
      );
      return res.ok;
    } catch {
      return false;
    }
  },

  /** Statut de la régénération en cours / dernière exécution. */
  async getRefreshStatus(): Promise<{
    running: boolean;
    lastRun: string;
    lastStatus: string;
    message: string;
    autoRefreshEnabled: boolean;
    autoRefreshHourUtc: number;
  } | null> {
    try {
      const res = await fetch(scraperUrl('admin/refresh-status'), { signal: AbortSignal.timeout(3000) });
      if (!res.ok) return null;
      return await res.json();
    } catch { return null; }
  },
};
