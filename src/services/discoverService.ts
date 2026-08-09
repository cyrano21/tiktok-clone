import { apiClient } from './api';
import type { Video } from '@/types';

// Demo discover feed is used ONLY when explicitly enabled (NEXT_PUBLIC_USE_DEMO=true).
// Otherwise categories come from the real backend /feed/discover.
const USE_DEMO = process.env.NEXT_PUBLIC_USE_DEMO === 'true';

export type DiscoverCategory = 'all' | 'trending' | 'music' | 'comedy' | 'sports' | 'food' | 'beauty';

export interface DiscoverVideo {
  id: string;
  title: string;
  thumbnailUrl: string;
  viewsCount: string;
  categories: string[];
}

interface BackendVideo {
  id: string;
  title?: string | null;
  description?: string | null;
  thumbnailUrl?: string | null;
  coverUrl?: string | null;
  viewCount?: number | string;
  isTrending?: boolean;
  hashtags?: Array<
    | { id: string; name: string }
    | { hashtag: { id: string; name: string } }
  >;
  sound?: { title?: string | null; artist?: string | null } | null;
}

function formatViews(value: number | string | undefined): string {
  const count = Number(value ?? 0);
  if (count >= 1_000_000) return `${(count / 1_000_000).toFixed(1).replace('.0', '')}M`;
  if (count >= 1_000) return `${(count / 1_000).toFixed(1).replace('.0', '')}K`;
  return String(Math.round(count));
}

function mapVideo(video: BackendVideo): DiscoverVideo {
  const tags = (video.hashtags ?? [])
    .map((tag) => ('hashtag' in tag ? tag.hashtag.name : tag.name))
    .filter(Boolean);
  return {
    id: video.id,
    title: video.title?.trim() || video.description?.trim().split('\n')[0] || 'Vidéo sans titre',
    thumbnailUrl: video.thumbnailUrl ?? video.coverUrl ?? '',
    viewsCount: formatViews(video.viewCount),
    categories: [...tags, video.sound?.title, video.sound?.artist].filter(Boolean) as string[],
  };
}

// --- Demo data generators -------------------------------------------------------

const DEMO_THUMBNAILS = [
  'https://picsum.photos/seed/d1/400/600',
  'https://picsum.photos/seed/d2/400/600',
  'https://picsum.photos/seed/d3/400/600',
  'https://picsum.photos/seed/d4/400/600',
  'https://picsum.photos/seed/d5/400/600',
  'https://picsum.photos/seed/d6/400/600',
  'https://picsum.photos/seed/d7/400/600',
  'https://picsum.photos/seed/d8/400/600',
  'https://picsum.photos/seed/d9/400/600',
  'https://picsum.photos/seed/d10/400/600',
];

const DEMO_TITLES_BY_CATEGORY: Record<DiscoverCategory, string[]> = {
  all: ['Tendance du jour 🔥', 'À découvrir absolument', 'Le clip qui buzz', 'Moment viral', 'Création originale'],
  trending: ['Ce son explose tout 🚀', 'La trend de la semaine', 'Tout le monde en parle', 'Viral worldwide', 'Hausse fulgurante'],
  music: ['Nouveau son 🎵', 'Cover acoustique', 'Session live au studio', 'Ce beat est dingue', 'Duo surprise en backstage'],
  comedy: ['Sketch hilarant 😂', 'Prank qui tourne mal', 'Imitation parfaite', 'Stand-up minute', 'Fail légendaire en cuisine'],
  sports: ['But incroyable ⚽', 'Workout 5 minutes', 'Trick de skate propre', 'Match point intense', 'Entraînement pro'],
  food: ['Recette express 🍳', 'ASMR cooking', 'Plat signature du chef', 'Street food tour', 'Dessert en 3 ingrédients'],
  beauty: ['Tuto makeup glow ✨', 'Routine skincare', 'Transformation cheveux', 'Nail art minimaliste', 'Maquillage de soirée'],
};

function generateDiscoverVideos(category: DiscoverCategory, limit: number): DiscoverVideo[] {
  const titles = DEMO_TITLES_BY_CATEGORY[category];
  const seed = category === 'all' ? 0 : category.charCodeAt(0) + category.length;
  return Array.from({ length: limit }, (_, i) => ({
    id: `discover-${category}-${i}`,
    title: titles[i % titles.length],
    thumbnailUrl: DEMO_THUMBNAILS[(seed + i) % DEMO_THUMBNAILS.length],
    viewsCount: `${Math.floor(Math.random() * 900 + 100)}K`,
    categories: [category],
  }));
}

let _useScraperDiscover: boolean | null = null;
async function useScraperDiscover(): Promise<boolean> {
  if (_useScraperDiscover !== null) return _useScraperDiscover;
  try {
    const { scraperBridge } = await import('./scraperBridge');
    _useScraperDiscover = await scraperBridge.isAvailable();
  } catch {
    _useScraperDiscover = false;
  }
  return _useScraperDiscover ?? false;
}

function scraperToDiscoverVideos(videos: any[]): DiscoverVideo[] {
  return videos.map((v: any) => ({
    id: v.id,
    title: v.description?.slice(0, 40) || v.user?.displayName || 'Vidéo scrapée',
    thumbnailUrl: v.thumbnailUrl || '',
    viewsCount: v.viewsCount >= 1000 ? `${(v.viewsCount / 1000).toFixed(0)}K` : String(v.viewsCount),
    categories: v.hashtags?.map((h: any) => h.name) || [],
  }));
}

// The scraper catalog has no category field: match hashtags + description against
// per-category keywords so the Discover tabs actually filter the real content.
const CATEGORY_KEYWORDS: Record<Exclude<DiscoverCategory, 'all' | 'trending'>, string[]> = {
  music: ['music', 'song', 'sing', 'dance', 'musique', 'chanson', 'danse', 'beat', 'singer', 'remix', 'cover', 'sound'],
  comedy: ['comedy', 'funny', 'humor', 'humour', 'sketch', 'joke', 'lol', 'prank', 'comédie', 'standup', 'meme'],
  sports: ['sport', 'fitness', 'gym', 'football', 'soccer', 'workout', 'basketball', 'nba', 'nfl', 'training', 'match', 'olympics'],
  food: ['food', 'recipe', 'cook', 'cooking', 'cuisine', 'recette', 'eat', 'bake', 'baking', 'tasty', 'chef', 'kitchen'],
  beauty: ['beauty', 'makeup', 'skincare', 'fashion', 'beauté', 'maquillage', 'style', 'hair', 'nails', 'glow', 'ootd'],
};

function filterScrapedByCategory(videos: Video[], category: DiscoverCategory, limit: number): Video[] {
  if (!videos.length) return videos;
  if (category === 'all') return videos.slice(0, limit);
  if (category === 'trending') {
    return [...videos].sort((a, b) => (b.viewsCount ?? 0) - (a.viewsCount ?? 0)).slice(0, limit);
  }
  const terms = CATEGORY_KEYWORDS[category] ?? [];
  const textOf = (v: Video) =>
    [v.description, ...(v.hashtags ?? []).map((h) => h.name)].join(' ').toLowerCase();
  const matched = videos.filter((v) => terms.some((term) => textOf(v).includes(term)));
  // Fall back to the general pool when a category has no matches, so the tab
  // never shows an empty grid on a healthy scraper.
  const pool = matched.length >= Math.min(limit, 6) ? matched : videos;
  return pool.slice(0, limit);
}

async function loadScrapedDiscover(category: DiscoverCategory, limit: number): Promise<DiscoverVideo[] | null> {
  if (!(await useScraperDiscover())) return null;
  const { scraperBridge } = await import('./scraperBridge');
  const scraped = await scraperBridge.getVideos(Math.max(limit * 3, 30));
  if (scraped.length === 0) return null;
  return scraperToDiscoverVideos(filterScrapedByCategory(scraped, category, limit));
}

export const discoverService = {
  async getVideos(category: DiscoverCategory, page = 1, limit = 20): Promise<DiscoverVideo[]> {
    if (USE_DEMO) {
      const scraped = await loadScrapedDiscover(category, limit);
      if (scraped) return scraped;
      return generateDiscoverVideos(category, limit);
    }
    const raw = await apiClient.get<{ videos: BackendVideo[] }>('/feed/discover', {
      params: { category, page, limit },
    });
    const videos = (raw.videos ?? []).map(mapVideo);
    // The backend only holds ORKY-native videos; when it has none (the real
    // catalog lives in the TikTok scraper), surface the scraped catalog so
    // Discover never shows a dead empty grid on a healthy backend.
    if (videos.length === 0) {
      const scraped = await loadScrapedDiscover(category, limit);
      if (scraped) return scraped;
    }
    return videos;
  },
};

export function __mapDiscoverVideoForTest(video: BackendVideo): DiscoverVideo {
  return mapVideo(video);
}
