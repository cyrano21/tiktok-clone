import { apiClient } from './api';

// Demo mode is ON — uses local demo data (no backend required).
const USE_DEMO = true;

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

export const discoverService = {
  async getVideos(category: DiscoverCategory, page = 1, limit = 20): Promise<DiscoverVideo[]> {
    if (USE_DEMO) {
      if (await useScraperDiscover()) {
        const { scraperBridge } = await import('./scraperBridge');
        const videos = await scraperBridge.getVideos(limit);
        if (videos.length > 0) return scraperToDiscoverVideos(videos);
      }
      return generateDiscoverVideos(category, limit);
    }
    const raw = await apiClient.get<{ videos: BackendVideo[] }>('/feed/discover', {
      params: { category, page, limit },
    });
    return (raw.videos ?? []).map(mapVideo);
  },
};

export function __mapDiscoverVideoForTest(video: BackendVideo): DiscoverVideo {
  return mapVideo(video);
}
