/** Pont entre ORKY et l'API du scraper TikTok.
 *
 * Quand le scraper est actif (port 8502), les vraies données scrapées
 * remplacent les données demo dans le feed, Discover et les profils.
 */

import type { Video, User } from '@/types';

const SCRAPER_API = 'http://127.0.0.1:8502';

interface ScraperVideo {
  id: string;
  title: string;
  views: number;
  likes: number;
  duration: number;
  commentCount: number;
  url: string;
  thumbnailUrl: string;
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
const CACHE_TTL_MS = 30_000; // 30 secondes

/** Vérifie si l'API scraper est accessible. */
async function isAvailable(): Promise<boolean> {
  try {
    const res = await fetch(`${SCRAPER_API}/api/stats`, { signal: AbortSignal.timeout(2000) });
    return res.ok;
  } catch {
    return false;
  }
}

/** Récupère les vidéos scrapées, avec cache court. */
async function fetchScraperVideos(): Promise<ScraperVideo[]> {
  const now = Date.now();
  if (cachedVideos && now - cachedAt < CACHE_TTL_MS) return [];

  try {
    const res = await fetch(`${SCRAPER_API}/api/videos`, { signal: AbortSignal.timeout(3000) });
    if (!res.ok) return [];
    const data = await res.json();
    return data.videos ?? [];
  } catch {
    return [];
  }
}

/** Récupère les stats du scraper. */
async function fetchScraperStats(): Promise<ScraperStats | null> {
  try {
    const res = await fetch(`${SCRAPER_API}/api/stats`, { signal: AbortSignal.timeout(2000) });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

/** Convertit une vidéo scraper en Video ORKY. */
function toOrkyVideo(sv: ScraperVideo, index: number): Video {
  const creatorIndex = index % 5;
  const creators = [
    { id: 'scraper-u-0', username: 'scraped_tiktok', displayName: 'TikTok Scrapé', avatarUrl: 'https://i.pravatar.cc/200?img=1', isVerified: false },
    { id: 'scraper-u-1', username: 'trend_video', displayName: 'Trend Video', avatarUrl: 'https://i.pravatar.cc/200?img=2', isVerified: true },
    { id: 'scraper-u-2', username: 'viral_feed', displayName: 'Viral Feed', avatarUrl: 'https://i.pravatar.cc/200?img=3', isVerified: false },
    { id: 'scraper-u-3', username: 'content_fr', displayName: 'Content FR', avatarUrl: 'https://i.pravatar.cc/200?img=4', isVerified: true },
    { id: 'scraper-u-4', username: 'top_creators', displayName: 'Top Creators', avatarUrl: 'https://i.pravatar.cc/200?img=5', isVerified: false },
  ];
  const creator = creators[creatorIndex];

  const user: User = {
    id: creator.id,
    username: creator.username,
    displayName: creator.displayName,
    avatarUrl: creator.avatarUrl,
    bio: '',
    followersCount: Math.floor(Math.random() * 50000 + 1000),
    followingCount: Math.floor(Math.random() * 500 + 50),
    likesCount: Math.floor(Math.random() * 100000 + 5000),
    videosCount: Math.floor(Math.random() * 200 + 10),
    isVerified: creator.isVerified,
    isFollowing: false,
    isFollowedBy: false,
    createdAt: new Date(Date.now() - Math.random() * 365 * 86400000).toISOString(),
  };

  const hashtags = (sv.title || '')
    .split(' ')
    .filter(w => w.startsWith('#'))
    .map((name, i) => ({
      id: `h-${name.slice(1)}`,
      name: name.slice(1),
      viewsCount: Math.floor(Math.random() * 50000000),
      videosCount: Math.floor(Math.random() * 500000),
      isFollowing: false,
    }));

  return {
    id: `scraper-${sv.id}`,
    user,
    videoUrl: sv.url,
    thumbnailUrl: sv.thumbnailUrl,
    description: sv.title || 'Vidéo scrapée',
    likesCount: sv.likes,
    commentsCount: sv.commentCount,
    sharesCount: Math.floor(sv.likes * 0.3),
    savesCount: Math.floor(sv.likes * 0.15),
    viewsCount: sv.views,
    duration: sv.duration || 30,
    isLiked: false,
    isSaved: false,
    hashtags,
    sound: null,
    location: null,
    createdAt: new Date().toISOString(),
    allowComments: true,
    allowDuet: true,
    allowStitch: true,
  };
}

/** Cache local des vidéos converties. */
function getCachedOrkyVideos(): Video[] | null {
  if (cachedVideos && Date.now() - cachedAt < CACHE_TTL_MS) return cachedVideos;
  return null;
}

function setCachedOrkyVideos(videos: Video[]): void {
  cachedVideos = videos;
  cachedAt = Date.now();
}

export const scraperBridge = {
  isAvailable,

  /** Récupère les stats du scraper (pour l'UI). */
  getStats: fetchScraperStats,

  /** Récupère les vidéos scrapées converties au format ORKY Video[]. */
  async getVideos(limit = 20): Promise<Video[]> {
    const cached = getCachedOrkyVideos();
    if (cached) return cached.slice(0, limit);

    const raw = await fetchScraperVideos();
    if (raw.length === 0) return [];

    const videos = raw.slice(0, limit).map(toOrkyVideo);
    setCachedOrkyVideos(videos);
    return videos;
  },

  /** Rafraîchit le cache (appelé après un scrape). */
  async refresh(): Promise<void> {
    try {
      await fetch(`${SCRAPER_API}/api/reload`, { signal: AbortSignal.timeout(2000) });
    } catch { /* ignore */ }
    cachedVideos = null;
    cachedAt = 0;
  },
};
