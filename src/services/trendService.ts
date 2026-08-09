import { scraperBridge } from './scraperBridge';
import { apiClient } from './api';

export type TrendSignalSource = 'tiktok' | 'reels' | 'shorts';

export interface TrendSignal {
  id: string;
  sourceApp: 'orky';
  sourcePlatform: TrendSignalSource;
  sourceVideoUrl: string;
  sourceEmbedUrl?: string;
  creatorUsername?: string;
  creatorDisplayName?: string;
  caption?: string;
  hashtags: string[];
  /** Nom du produit détecté — dérivé du titre/caption (signal, pas une certitude). */
  detectedProductName: string;
  detectedKeywords: string[];
  detectedCategory?: string;
  thumbnailUrl?: string;
  viralStats: {
    views: number;
    likes: number;
    comments: number;
  };
}

export interface SourcingCandidate {
  candidateId: string;
  supplierId: string;
  supplierName: string;
  platform: string;
  title: string;
  imageUrl: string;
  productUrl: string;
  price: string;
  currency: string;
  stock?: number | null;
  stockKnown: boolean;
  shippingDays?: number | null;
  matchScore: number;
  matchType: 'exact' | 'similar' | 'alternative';
  riskFlags: string[];
  suggestedRetailPrice?: number;
  estimatedMargin?: number;
}

export interface SourcingRequest {
  _id: string;
  status: string;
  signal: TrendSignal;
  candidates: SourcingCandidate[];
  approvedCandidateId?: string | null;
  orchidyProProductId?: string | null;
  orchidyMarketplaceProductId?: string | null;
  error?: string | null;
  createdAt: string;
  updatedAt: string;
}

/** URL du proxy Next vers orchidy-pro. */
const PROXY_BASE = '/api/trends/sourcing';

function stopwords(): Set<string> {
  return new Set([
    'avec', 'pour', 'une', 'dans', 'cette', 'voici', 'comment', 'tiktok', 'mademybueit',
    'amazonfinds', 'foryou', 'viral', 'product', 'gadget', 'nouveau', 'tuto', 'astuce',
  ]);
}

/** Déduit un nom produit probable depuis le titre/caption + hashtags. */
function detectProductName(caption: string, hashtags: string[]): { name: string; keywords: string[] } {
  const text = `${caption} ${hashtags.join(' ')}`.toLowerCase();
  const tokens = text.split(/[^a-z0-9#éèàçùêâîôûäöüß]+/).filter((t) => t.length > 3 && !stopwords().has(t));
  const keywords = Array.from(new Set(tokens)).slice(0, 6);
  const name = keywords[0]
    ? keywords[0].charAt(0).toUpperCase() + keywords[0].slice(1)
    : 'Produit tendance';
  return { name, keywords };
}

function toTrendSignal(video: Awaited<ReturnType<typeof scraperBridge.getVideos>>[number]): TrendSignal | null {
  const caption = video.description || '';
  const hashtags = (video.hashtags || []).map((h) => (typeof h === 'string' ? h : h.name || '')).filter(Boolean);
  const { name, keywords } = detectProductName(caption, hashtags);
  return {
    id: `trend-${video.id}`,
    sourceApp: 'orky',
    sourcePlatform: 'tiktok',
    sourceVideoUrl: video.videoUrl || '',
    creatorUsername: video.user?.username,
    creatorDisplayName: video.user?.displayName,
    caption: caption.slice(0, 2000),
    hashtags,
    detectedProductName: name,
    detectedKeywords: keywords,
    thumbnailUrl: video.thumbnailUrl || undefined,
    viralStats: {
      views: video.viewsCount || 0,
      likes: video.likesCount || 0,
      comments: video.commentsCount || 0,
    },
  };
}

export const trendService = {
  /**
   * Liste les signaux de tendance à partir du catalogue scraper réel (60 vidéos
   * TikTok avec vues / likes / commentaires / hashtags). La vidéo source reste un
   * signal : le produit vendu est l'objet commercial Orchidy, jamais la vidéo.
   */
  async listTrends(limit = 50): Promise<TrendSignal[]> {
    const videos = await scraperBridge.getVideos(limit);
    return videos
      .map(toTrendSignal)
      .filter((s): s is TrendSignal => s !== null)
      .sort((a, b) => {
        const scoreA = a.viralStats.views + a.viralStats.likes * 10 + a.viralStats.comments * 20;
        const scoreB = b.viralStats.views + b.viralStats.likes * 10 + b.viralStats.comments * 20;
        return scoreB - scoreA;
      });
  },

  /** Crée une demande de sourcing chez Orchidy Pro (signal complet + stats virales). */
  async sendToSourcing(signal: TrendSignal): Promise<{ success: boolean; requestId: string; status: string; candidates: SourcingCandidate[]; error?: string }> {
    return apiClient.post<{ success: boolean; requestId: string; status: string; candidates: SourcingCandidate[]; error?: string }>(`${PROXY_BASE}/requests`, { signal });
  },

  /** Récupère l'état d'une demande de sourcing (candidats, statut, produit publié). */
  async getSourcingRequest(requestId: string): Promise<SourcingRequest | null> {
    const data = await apiClient.get<{ success: boolean; request?: SourcingRequest }>(`${PROXY_BASE}/requests/${requestId}`);
    return data.request ?? null;
  },

  /** Approuve un candidat → Orchidy Pro crée le produit et le publie sur Orchidy. */
  async approveCandidate(requestId: string, candidateId: string): Promise<{ success: boolean; productId?: string; productUrl?: string; orchidyMarketplaceProductId?: string | null; status?: string; error?: string }> {
    return apiClient.post<{ success: boolean; productId?: string; productUrl?: string; orchidyMarketplaceProductId?: string | null; status?: string; error?: string }>(`${PROXY_BASE}/requests/${requestId}/approve`, { candidateId });
  },
};
