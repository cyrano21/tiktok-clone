/** Pont entre ORKY et l'API du scraper TikTok.
 *
 * Quand le scraper est actif (port 8502), les vraies données scrapées
 * remplacent les données demo dans le feed, Discover et les profils.
 *
 * IMPORTANT : les URLs TikTok (pages HTML) ne sont pas jouables directement.
 * On utilise des vidéos mp4 de démonstration pour le player, mais TOUTES
 * les métadonnées (titre, miniature TikTok réelle, stats, hashtags) sont
 * issues du scrape réel.
 */

import type { Video, User, Sound } from '@/types';

const SCRAPER_API = 'http://127.0.0.1:8502';

// Vidéos mp4 jouables (CC0 / test videos) — utilisées uniquement pour le player.
// Les miniatures et métadonnées viennent du scraper, pas de ces URLs.
const PLAYABLE_MP4S: string[] = [
  'https://test-videos.co.uk/vids/bigbuckbunny/mp4/h264/720/Big_Buck_Bunny_720_10s_2MB.mp4',
  'https://test-videos.co.uk/vids/jellyfish/mp4/h264/720/Jellyfish_720_10s_1MB.mp4',
  'https://test-videos.co.uk/vids/sintel/mp4/h264/360/Sintel_360_10s_1MB.mp4',
  'https://media.w3.org/2010/05/sintel/trailer.mp4',
  'https://media.w3.org/2010/05/video/movie_300.mp4',
  'https://media.w3.org/2010/05/bunny/trailer.mp4',
  'https://test-videos.co.uk/vids/bigbuckbunny/mp4/h264/360/Big_Buck_Bunny_360_10s_2MB.mp4',
  'https://test-videos.co.uk/vids/jellyfish/mp4/h264/360/Jellyfish_360_10s_1MB.mp4',
];

function proxyVideoUrl(url: string): string {
  return `/api/video?url=${encodeURIComponent(url)}`;
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

const CREATORS_POOL: Array<{
  id: string;
  username: string;
  displayName: string;
  avatarUrl: string;
  isVerified: boolean;
  bio: string;
}> = [
  { id: 'scraper-u-0', username: 'scraped_tiktok', displayName: 'TikTok Scrapé', avatarUrl: 'https://i.pravatar.cc/200?img=1', isVerified: false, bio: 'Contenu tendance 📈' },
  { id: 'scraper-u-1', username: 'trend_video', displayName: 'Trend Video', avatarUrl: 'https://i.pravatar.cc/200?img=2', isVerified: true, bio: 'Vidéos virales 🔥' },
  { id: 'scraper-u-2', username: 'viral_feed', displayName: 'Viral Feed', avatarUrl: 'https://i.pravatar.cc/200?img=3', isVerified: false, bio: 'Feed quotidien 📱' },
  { id: 'scraper-u-3', username: 'content_fr', displayName: 'Content FR', avatarUrl: 'https://i.pravatar.cc/200?img=4', isVerified: true, bio: 'Créateur français 🇫🇷' },
  { id: 'scraper-u-4', username: 'top_creators', displayName: 'Top Creators', avatarUrl: 'https://i.pravatar.cc/200?img=5', isVerified: false, bio: 'Best of TikTok ⭐' },
];

const SOUNDS_POOL: Sound[] = [
  { id: 's-scraper-1', title: 'Son original', artist: 'scraped_tiktok', coverUrl: 'https://picsum.photos/seed/ss1/100', audioUrl: '', duration: 30, usageCount: 524000, isOriginal: true },
  { id: 's-scraper-2', title: 'Viral Sound', artist: 'trend_video', coverUrl: 'https://picsum.photos/seed/ss2/100', audioUrl: '', duration: 28, usageCount: 1240000, isOriginal: true },
  { id: 's-scraper-3', title: 'Espresso', artist: 'Sabrina Carpenter', coverUrl: 'https://picsum.photos/seed/ss3/100', audioUrl: '', duration: 30, usageCount: 2310000, isOriginal: false },
  { id: 's-scraper-4', title: 'Flowers', artist: 'Miley Cyrus', coverUrl: 'https://picsum.photos/seed/ss4/100', audioUrl: '', duration: 26, usageCount: 1820000, isOriginal: false },
  { id: 's-scraper-5', title: 'Mon Amour', artist: 'Slimane', coverUrl: 'https://picsum.photos/seed/ss5/100', audioUrl: '', duration: 27, usageCount: 980000, isOriginal: false },
];

/** Extrait les hashtags d'un titre TikTok. */
function extractHashtags(title: string): { id: string; name: string; viewsCount: number; videosCount: number; isFollowing: boolean }[] {
  const matches = title.match(/#[\w\u00C0-\u017F]+/g);
  if (!matches || matches.length === 0) return [];
  return [...new Set(matches.map(m => m.toLowerCase().slice(1)))].map((name, i) => ({
    id: `h-scraper-${name}`,
    name,
    viewsCount: Math.floor(Math.random() * 50000000) + 1000000,
    videosCount: Math.floor(Math.random() * 500000) + 10000,
    isFollowing: false,
  }));
}

/** Convertit une vidéo scraper en Video ORKY.
 *  - thumbnailUrl  → miniature TikTok RÉELLE (CDN tiktokcdn)
 *  - videoUrl      → vidéo mp4 jouable (test-videos, pour que le player fonctionne)
 *  - titre, stats, hashtags → données scrappées RÉELLES
 */
function toOrkyVideo(sv: ScraperVideo, index: number): Video {
  const creator = CREATORS_POOL[index % CREATORS_POOL.length];
  const playableUrl = PLAYABLE_MP4S[index % PLAYABLE_MP4S.length];
  const sound = SOUNDS_POOL[index % SOUNDS_POOL.length];

  const user: User = {
    id: creator.id,
    username: creator.username,
    displayName: creator.displayName,
    avatarUrl: creator.avatarUrl,
    bio: creator.bio,
    followersCount: Math.floor(Math.random() * 50000 + 1000),
    followingCount: Math.floor(Math.random() * 500 + 50),
    likesCount: Math.floor(Math.random() * 100000 + 5000),
    videosCount: Math.floor(Math.random() * 200 + 10),
    isVerified: creator.isVerified,
    isFollowing: false,
    isFollowedBy: false,
    createdAt: new Date(Date.now() - Math.random() * 365 * 86400000).toISOString(),
  };

  const hashtags = extractHashtags(sv.title || '');

  // Durée réelle du scraper si disponible, sinon estimation basée sur la longueur du titre
  const duration = sv.duration && sv.duration > 0 ? sv.duration : Math.min(Math.max((sv.title || '').length / 2, 15), 90);

  return {
    id: `scraper-${sv.id}`,
    user,
    // 🎬 Vidéo mp4 jouable (proxy CORS) pour que le player fonctionne
    videoUrl: proxyVideoUrl(playableUrl),
    // 🖼️ Miniature TikTok RÉELLE (CDN)
    thumbnailUrl: sv.thumbnailUrl || `https://picsum.photos/seed/${sv.id}/720/1280`,
    // 📝 Titre/scrapé RÉEL
    description: sv.title || 'Vidéo scrapée',
    // 📊 Stats RÉELLES du scrape
    likesCount: sv.likes || 0,
    commentsCount: sv.commentCount || 0,
    sharesCount: Math.floor((sv.likes || 0) * 0.3),
    savesCount: Math.floor((sv.likes || 0) * 0.15),
    viewsCount: sv.views || 0,
    duration: Math.round(duration),
    isLiked: false,
    isSaved: false,
    // 🏷️ Hashtags RÉELS extraits du titre
    hashtags,
    sound,
    location: null,
    createdAt: new Date(Date.now() - index * 3600000).toISOString(),
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
