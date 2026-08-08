/** Pont entre ORKY et l'API du scraper TikTok.
 *
 * Les vidéos sont streamées DIRECTEMENT par le scraper (cache local 24h,
 * puis yt-dlp si absent). L'API scraper (port 8502) sert tout.
 *
 * Données enrichies : hashtags réels du scraper, commentaires par vidéo,
 * miniatures TikTok CDN, stats réelles (likes, vues, durée).
 */

import type { Video, User, Comment } from '@/types';

// Prefer the same-origin Next proxy in production so browser clients never
// need to resolve an internal Docker service name. Local development can use
// the direct scraper API when explicitly configured.
const configuredScraperApi = process.env.NEXT_PUBLIC_SCRAPER_API_URL;
const SCRAPER_API = configuredScraperApi || (typeof window === 'undefined' ? 'http://127.0.0.1:8502' : '/api/scraper');

/** Construit une URL compatible avec le proxy same-origin (/api/scraper) ou l'API directe. */
function scraperUrl(path: string): string {
  const cleanPath = path.replace(/^\/+/, '').replace(/^api\//, '');
  return SCRAPER_API.startsWith('/')
    ? `${SCRAPER_API}/${cleanPath}`
    : `${SCRAPER_API}/api/${cleanPath}`;
}

interface ScraperVideo {
  id: string;
  title: string;
  views: number;
  likes: number;
  duration: number;
  commentCount: number;
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
    const res = await fetch(scraperUrl('stats'), { signal: AbortSignal.timeout(8_000) });
    return res.ok;
  } catch { return false; }
}

async function fetchScraperVideos(): Promise<ScraperVideo[]> {
  try {
    const res = await fetch(scraperUrl('videos'), { signal: AbortSignal.timeout(8_000) });
    if (!res.ok) return [];
    const data = await res.json();
    return data.videos ?? [];
  } catch { return []; }
}

async function fetchScraperStats(): Promise<ScraperStats | null> {
  try {
    const res = await fetch(scraperUrl('stats'), { signal: AbortSignal.timeout(8_000) });
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


function mapHashtags(hashtags: string[] | undefined): Video['hashtags'] {
  if (!hashtags || hashtags.length === 0) return [];
  return hashtags.map((name) => ({
    id: `h-scraper-${name}`,
    name,
    // The scraper does not expose aggregate hashtag counters. Never invent them.
    viewsCount: 0,
    videosCount: 0,
    isFollowing: false,
  }));
}

function toOrkyVideo(sv: ScraperVideo): Video {
  const creatorFromUrl = sv.url.match(/\/@@?([^/]+)/)?.[1] || '';
  const creatorUsername = sv.creatorUsername || creatorFromUrl || 'tiktok';
  const creatorDisplayName = sv.creatorDisplayName || creatorUsername;
  const creatorAvatarUrl = sv.creatorAvatarUrl || '';
  const dur = sv.duration > 0 ? sv.duration : 0;

  return {
    id: `scraper-${sv.id}`,
    user: {
      id: `scr-creator-${creatorUsername}`,
      username: creatorUsername,
      displayName: creatorDisplayName,
      avatarUrl: creatorAvatarUrl,
      bio: '',
      followersCount: 0,
      followingCount: 0,
      likesCount: sv.likes,
      videosCount: 0,
      isVerified: false,
      isFollowing: false,
      isFollowedBy: false,
      createdAt: sv.createdAt || new Date(0).toISOString(),
    },
    // 🎬 Stream/cache depuis l'API scraper
    videoUrl: scraperUrl(`stream/${sv.id}`),
    // 🖼️ Miniature TikTok RÉELLE
    thumbnailUrl: sv.thumbnailUrl || '',
    description: sv.title || 'Vidéo scrapée',
    likesCount: sv.likes, commentsCount: sv.commentCount,
    // The scraper does not expose share/save counters. Never fabricate them.
    sharesCount: 0, savesCount: 0,
    viewsCount: sv.views, duration: Math.round(dur),
    isLiked: false, isSaved: false,
    // 🏷️ Hashtags enrichis du scraper
    hashtags: mapHashtags(sv.hashtags),
    sound: null,
    location: null,
    createdAt: sv.createdAt || new Date(0).toISOString(),
    allowComments: true, allowDuet: true, allowStitch: true,
  };
}

function mapComment(sc: ScraperComment, index: number): Comment {
  return {
    id: sc.id || `sc-${index}`,
    user: {
      id: `scr-user-${sc.username}`,
      username: sc.username,
      displayName: sc.nickname || sc.username,
      avatarUrl: `https://i.pravatar.cc/200?u=${encodeURIComponent(sc.username)}`,
      bio: '',
      followersCount: 0,
      followingCount: 0,
      likesCount: sc.likes || 0,
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
    createdAt: sc.createdAt || new Date().toISOString(),
  };
}

// ── Cache ───────────────────────────────────────────────────────────────

function getCached(): Video[] | null {
  if (cachedVideos && Date.now()-cachedAt < CACHE_TTL_MS) return cachedVideos;
  return null;
}
function setCached(v: Video[]): void { cachedVideos = v; cachedAt = Date.now(); }

// ── Exports ─────────────────────────────────────────────────────────────

export const scraperBridge = {
  isAvailable,
  getStats: fetchScraperStats,

  async getVideos(limit = 20): Promise<Video[]> {
    const c = getCached();
    if (c) return c.slice(0, limit);

    const raw = await fetchScraperVideos();
    if (raw.length === 0) return [];

    const selected = raw.slice(0, limit);
    selected.forEach((video) => {
      if (Array.isArray(video.comments)) cachedComments.set(video.id, video.comments);
    });
    const videos = selected.map(toOrkyVideo);
    setCached(videos);
    return videos;
  },

  /** Récupère les vrais commentaires d'une vidéo scrapée. */
  async getComments(videoId: string): Promise<Comment[]> {
    const realId = videoId.startsWith('scraper-') ? videoId.slice(8) : videoId;
    const embedded = cachedComments.get(realId);
    if (embedded) return embedded.map(mapComment);
    const raw = await fetchComments(realId);
    if (raw.length > 0) cachedComments.set(realId, raw);
    return raw.map(mapComment);
  },

  async refresh(): Promise<void> {
    try { await fetch(scraperUrl('reload'), { signal: AbortSignal.timeout(2000) }); } catch {}
    cachedVideos = null;
    cachedAt = 0;
    cachedComments.clear();
  },
};
