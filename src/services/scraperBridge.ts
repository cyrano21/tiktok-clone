/** Pont de recherche entre ORKY et le service d'observation TikTok.
 *
 * IMPORTANT: ces éléments restent des références externes en lecture seule.
 * Ils ne deviennent pas des entités sociales ORKY tant qu'ils n'ont pas été
 * explicitement importés dans le modèle canonique.
 */

import type { Video, User, Comment } from '@/types';

// Le navigateur parle uniquement au proxy same-origin. Le proxy Next connaît
// l'URL interne Docker et son secret; aucun hostname de conteneur n'est exposé.
const SCRAPER_API = process.env.NEXT_PUBLIC_SCRAPER_API_URL || '/api/scraper';

function scraperUrl(path: string): string {
  const cleanPath = path.replace(/^\/+/, '').replace(/^api\//, '');
  return SCRAPER_API.startsWith('/')
    ? `${SCRAPER_API.replace(/\/$/, '')}/${cleanPath}`
    : `${SCRAPER_API.replace(/\/$/, '')}/api/${cleanPath}`;
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

function toOrkyVideo(sv: ScraperVideo): Video {
  const creatorFromUrl = sv.url.match(/\/@@?([^/]+)/)?.[1] || '';
  const creatorUsername = sv.creatorUsername || creatorFromUrl || 'source-externe';
  const creatorDisplayName = sv.creatorDisplayName || (creatorUsername === 'source-externe' ? 'Créateur externe' : creatorUsername);
  const creatorAvatarUrl = sv.creatorAvatarUrl || '';
  const dur = sv.duration > 0 ? sv.duration : 0;

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
    thumbnailUrl: sv.thumbnailUrl || '',
    description: sv.title || '',
    likesCount: sv.likes,
    commentsCount: sv.commentCount,
    sharesCount: 0,
    savesCount: 0,
    viewsCount: sv.views,
    duration: Math.round(dur),
    isLiked: false,
    isSaved: false,
    hashtags: mapHashtags(sv.hashtags),
    sound: null,
    location: null,
    createdAt: sv.createdAt || new Date(0).toISOString(),
    allowComments: true,
    allowDuet: false,
    allowStitch: false,
    sourceType: 'external_reference',
    interactionMode: 'read_only',
    externalPlatform: 'tiktok',
    externalUrl: sv.url,
    productMatches: [],
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
    // Reload is intentionally not exposed by the public browser proxy. Data refresh
    // is an operational action performed by the internal scraper service.
    cachedVideos = null;
    cachedAt = 0;
    cachedComments.clear();
  },
};
