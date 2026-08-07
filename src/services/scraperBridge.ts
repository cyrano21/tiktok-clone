/** Pont entre ORKY et l'API du scraper TikTok.
 *
 * Les vidéos sont streamées DIRECTEMENT par le scraper (cache local 24h,
 * puis yt-dlp si absent). L'API scraper (port 8502) sert tout.
 *
 * Données enrichies : hashtags réels du scraper, commentaires par vidéo,
 * miniatures TikTok CDN, stats réelles (likes, vues, durée).
 */

import type { Video, User, Sound, Comment } from '@/types';

// En prod : NEXT_PUBLIC_SCRAPER_API_URL=http://scraper-api:8502 (nom du service Docker)
// En local : pas besoin de variable, fallback sur 127.0.0.1:8502
const SCRAPER_API = process.env.NEXT_PUBLIC_SCRAPER_API_URL || 'http://127.0.0.1:8502';

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
const CACHE_TTL_MS = 60_000;

async function isAvailable(): Promise<boolean> {
  try {
    const res = await fetch(`${SCRAPER_API}/api/stats`, { signal: AbortSignal.timeout(2000) });
    return res.ok;
  } catch { return false; }
}

async function fetchScraperVideos(): Promise<ScraperVideo[]> {
  try {
    const res = await fetch(`${SCRAPER_API}/api/videos`, { signal: AbortSignal.timeout(3000) });
    if (!res.ok) return [];
    const data = await res.json();
    return data.videos ?? [];
  } catch { return []; }
}

async function fetchScraperStats(): Promise<ScraperStats | null> {
  try {
    const res = await fetch(`${SCRAPER_API}/api/stats`, { signal: AbortSignal.timeout(2000) });
    if (!res.ok) return null;
    return await res.json();
  } catch { return null; }
}

async function fetchComments(videoId: string): Promise<ScraperComment[]> {
  try {
    const realId = videoId.startsWith('scraper-') ? videoId.slice(8) : videoId;
    const res = await fetch(`${SCRAPER_API}/api/videos/${realId}/comments`, {
      signal: AbortSignal.timeout(3000),
    });
    if (!res.ok) return [];
    const data = await res.json();
    return data.comments ?? [];
  } catch { return []; }
}

// ── Pools ───────────────────────────────────────────────────────────────

const CREATORS: Array<{id:string;username:string;displayName:string;avatarUrl:string;isVerified:boolean;bio:string}> = [
  { id:'u0', username:'scraped_tiktok', displayName:'TikTok Scrapé', avatarUrl:'https://i.pravatar.cc/200?img=1', isVerified:false, bio:'Contenu tendance 📈' },
  { id:'u1', username:'trend_video', displayName:'Trend Video', avatarUrl:'https://i.pravatar.cc/200?img=2', isVerified:true, bio:'Vidéos virales 🔥' },
  { id:'u2', username:'viral_feed', displayName:'Viral Feed', avatarUrl:'https://i.pravatar.cc/200?img=3', isVerified:false, bio:'Feed quotidien 📱' },
  { id:'u3', username:'content_fr', displayName:'Content FR', avatarUrl:'https://i.pravatar.cc/200?img=4', isVerified:true, bio:'Créateur français 🇫🇷' },
  { id:'u4', username:'top_creators', displayName:'Top Creators', avatarUrl:'https://i.pravatar.cc/200?img=5', isVerified:false, bio:'Best of TikTok ⭐' },
];

const SOUNDS: Sound[] = [
  { id:'s1', title:'Son original', artist:'scraped_tiktok', coverUrl:'https://picsum.photos/seed/ss1/100', audioUrl:'', duration:30, usageCount:524000, isOriginal:true },
  { id:'s2', title:'Viral Sound', artist:'trend_video', coverUrl:'https://picsum.photos/seed/ss2/100', audioUrl:'', duration:28, usageCount:1240000, isOriginal:true },
  { id:'s3', title:'Espresso', artist:'Sabrina Carpenter', coverUrl:'https://picsum.photos/seed/ss3/100', audioUrl:'', duration:30, usageCount:2310000, isOriginal:false },
  { id:'s4', title:'Flowers', artist:'Miley Cyrus', coverUrl:'https://picsum.photos/seed/ss4/100', audioUrl:'', duration:26, usageCount:1820000, isOriginal:false },
  { id:'s5', title:'Mon Amour', artist:'Slimane', coverUrl:'https://picsum.photos/seed/ss5/100', audioUrl:'', duration:27, usageCount:980000, isOriginal:false },
];

function mapHashtags(hashtags: string[] | undefined): Video['hashtags'] {
  if (!hashtags || hashtags.length === 0) return [];
  return hashtags.map((name) => ({
    id: `h-scraper-${name}`,
    name,
    viewsCount: Math.floor(Math.random() * 50000000) + 1000000,
    videosCount: Math.floor(Math.random() * 500000) + 10000,
    isFollowing: false,
  }));
}

function toOrkyVideo(sv: ScraperVideo, index: number): Video {
  const c = CREATORS[index % CREATORS.length];
  const dur = sv.duration > 0 ? sv.duration : Math.min(Math.max((sv.title||'').length/2, 15), 90);

  return {
    id: `scraper-${sv.id}`,
    user: {
      id: c.id, username: c.username, displayName: c.displayName,
      avatarUrl: c.avatarUrl, bio: c.bio,
      followersCount: Math.floor(Math.random()*50000)+1000,
      followingCount: Math.floor(Math.random()*500)+50,
      likesCount: Math.floor(Math.random()*100000)+5000,
      videosCount: Math.floor(Math.random()*200)+10,
      isVerified: c.isVerified, isFollowing: false, isFollowedBy: false,
      createdAt: new Date(Date.now()-Math.random()*31536000000).toISOString(),
    },
    // 🎬 Stream/cache depuis l'API scraper
    videoUrl: `${SCRAPER_API}/api/stream/${sv.id}`,
    // 🖼️ Miniature TikTok RÉELLE
    thumbnailUrl: sv.thumbnailUrl || `https://picsum.photos/seed/${sv.id}/720/1280`,
    description: sv.title || 'Vidéo scrapée',
    likesCount: sv.likes, commentsCount: sv.commentCount,
    sharesCount: Math.floor(sv.likes*0.3), savesCount: Math.floor(sv.likes*0.15),
    viewsCount: sv.views, duration: Math.round(dur),
    isLiked: false, isSaved: false,
    // 🏷️ Hashtags enrichis du scraper
    hashtags: mapHashtags(sv.hashtags),
    sound: SOUNDS[index % SOUNDS.length],
    location: null,
    createdAt: new Date(Date.now()-index*3600000).toISOString(),
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
      followersCount: Math.floor(Math.random() * 10000) + 100,
      followingCount: Math.floor(Math.random() * 500) + 10,
      likesCount: Math.floor(Math.random() * 50000),
      videosCount: Math.floor(Math.random() * 100),
      isVerified: false,
      isFollowing: false,
      isFollowedBy: false,
      createdAt: sc.createdAt || new Date().toISOString(),
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

    const videos = raw.slice(0, limit).map(toOrkyVideo);
    setCached(videos);
    return videos;
  },

  /** Récupère les vrais commentaires d'une vidéo scrapée. */
  async getComments(videoId: string): Promise<Comment[]> {
    const raw = await fetchComments(videoId);
    return raw.map(mapComment);
  },

  async refresh(): Promise<void> {
    try { await fetch(`${SCRAPER_API}/api/reload`, { signal: AbortSignal.timeout(2000) }); } catch {}
    cachedVideos = null; cachedAt = 0;
  },
};
