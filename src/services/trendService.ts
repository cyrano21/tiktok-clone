import { scraperBridge } from './scraperBridge';
import { apiClient } from './api';
import { toCommerceStats, videoIdFromSignal } from './commerceStats';
import type { CommerceStats } from './commerceStats';
import type { FunnelAggregate } from './commerceStats';

export type TrendSignalSource = 'tiktok' | 'reels' | 'shorts';

export interface TrendSignal {
  id: string;
  sourceSignalId?: string;
  /**
   * LOT 8 : identifiant de corrélation inter-applications, déterministe par
   * tendance (dérivé de l'id stable) — suit trendSignalId → sourcingRequestId
   * → … → orderId pour reconstruire toute l'histoire depuis un orderId.
   */
  correlationId?: string;
  sourceApp: 'orky';
  sourcePlatform: TrendSignalSource;
  sourceVideoUrl: string;
  sourceEmbedUrl?: string;
  creatorUsername?: string;
  creatorDisplayName?: string;
  caption?: string;
  hashtags: string[];
  detectedProductName: string;
  detectedKeywords: string[];
  detectedCategory?: string;
  thumbnailUrl?: string;
  viralStats: { views: number; likes: number; comments: number };
  /** Signal commerce agrégé (Lot 3) joint au signal viral avant envoi à Pro. */
  commerceStats?: CommerceStats;
}

export type { CommerceStats, FunnelAggregate } from './commerceStats';

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

export interface GeneratedVideoState {
  status: 'queued' | 'processing' | 'completed' | 'failed';
  jobId: string;
  requestedBy?: string;
  requestedAt?: string;
  updatedAt?: string;
  model?: string | null;
  sourceUrl?: string | null;
  hostedUrl?: string | null;
  error?: string | null;
  orkyVideoId?: string | null;
}

export interface SourcingRequest {
  _id: string;
  status: string;
  signal: TrendSignal;
  candidates: SourcingCandidate[];
  approvedCandidateId?: string | null;
  orchidyProProductId?: string | null;
  orchidyMarketplaceProductId?: string | null;
  conversion?: {
    ordersCount: number;
    unitsSold: number;
    revenueCents: number;
    currency: string;
    mixedCurrency?: boolean;
    byCurrency?: Record<string, { ordersCount: number; unitsSold: number; revenueCents: number; minorUnitFactor?: number }>;
    lastSaleAt?: string | null;
  } | null;
  generatedVideo?: GeneratedVideoState | null;
  error?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface GeneratedTrendVideo {
  success: boolean;
  requestId?: string;
  productId?: string;
  jobId?: string;
  status?: GeneratedVideoState['status'];
  videoUrl?: string | null;
  model?: string | null;
  error?: string;
  message?: string;
}

export interface ImportedTrendVideo {
  success: boolean;
  idempotent?: boolean;
  recoverable?: boolean;
  videoId?: string;
  productMatchId?: string | null;
  error?: string;
}

const PROXY_BASE = '/api/trends/sourcing';

const STOPWORDS = new Set([
  'avec', 'pour', 'une', 'dans', 'cette', 'voici', 'comment', 'tiktok', 'mademybueit',
  'amazonfinds', 'foryou', 'viral', 'product', 'gadget', 'nouveau', 'tuto', 'astuce',
  'that', 'this', 'with', 'from', 'your', 'have', 'just', 'really', 'best', 'must', 'need',
  'the', 'and', 'you', 'les', 'des', 'sur', 'mon', 'mes', 'son', 'ses', 'tout', 'plus',
]);

function meaningfulTokens(value: string): string[] {
  return value
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((token) => token.length > 2 && !STOPWORDS.has(token));
}

function detectProductName(caption: string, hashtags: string[]): { name: string; keywords: string[] } {
  const captionTokens = meaningfulTokens(caption);
  const hashtagTokens = hashtags.flatMap((tag) => meaningfulTokens(tag.replace(/^#/, '')));
  const keywords = Array.from(new Set([...hashtagTokens, ...captionTokens])).slice(0, 8);
  const phraseTokens = captionTokens.slice(0, 3).filter(Boolean);
  const fallbackTokens = keywords.slice(0, 3);
  const chosen = phraseTokens.length >= 2 ? phraseTokens : fallbackTokens;
  const name = chosen.length
    ? chosen.join(' ').replace(/^./, (character) => character.toUpperCase())
    : 'Produit à identifier';
  return { name, keywords };
}

function toTrendSignal(video: Awaited<ReturnType<typeof scraperBridge.getVideos>>[number]): TrendSignal | null {
  const caption = video.description || '';
  const hashtags = (video.hashtags || [])
    .map((tag) => (typeof tag === 'string' ? tag : tag.name || ''))
    .filter(Boolean);
  const { name, keywords } = detectProductName(caption, hashtags);
  const externalUrl = video.externalUrl || '';
  const tiktokId = video.id.startsWith('scraper-') ? video.id.slice(8) : video.id;
  const sourceEmbedUrl = externalUrl
    ? `https://www.tiktok.com/embed/v2/${tiktokId}?lang=en-US`
    : undefined;
  const id = `trend-${video.id}`;
  return {
    id,
    sourceSignalId: id,
    correlationId: `corr-${id}`,
    sourceApp: 'orky',
    sourcePlatform: 'tiktok',
    sourceVideoUrl: externalUrl,
    sourceEmbedUrl,
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

function viralOpportunityScore(signal: TrendSignal): number {
  const views = Math.max(1, signal.viralStats.views);
  const engagementRate = (signal.viralStats.likes + signal.viralStats.comments * 3) / views;
  return Math.log10(views + 1) * 100 + Math.min(1, engagementRate) * 500;
}


export const trendService = {
  async listTrends(limit = 50): Promise<TrendSignal[]> {
    const videos = await scraperBridge.getVideos(limit);
    return videos
      .map(toTrendSignal)
      .filter((signal): signal is TrendSignal => signal !== null)
      .sort((a, b) => viralOpportunityScore(b) - viralOpportunityScore(a));
  },

  async sendToSourcing(signal: TrendSignal): Promise<{ success: boolean; requestId: string; status: string; candidates: SourcingCandidate[]; error?: string }> {
    const persistedSignal: TrendSignal = {
      ...signal,
      sourceSignalId: signal.sourceSignalId || signal.id,
      commerceStats: signal.commerceStats ?? (await this.attachCommerceStats(signal)),
    };
    return apiClient.post<{ success: boolean; requestId: string; status: string; candidates: SourcingCandidate[]; error?: string }>(`${PROXY_BASE}/requests`, { signal: persistedSignal });
  },

  /**
   * Joint le signal commerce (entonnoir de lecture de la vidéo) au signal
   * viral. Toute erreur réseau est silencieuse : le signal part sans
   * commerceStats plutôt que de bloquer l'envoi.
   */
  async attachCommerceStats(signal: TrendSignal): Promise<CommerceStats | undefined> {
    const videoId = videoIdFromSignal(signal.id);
    if (!videoId) return undefined;
    try {
      const funnel = await apiClient.get<FunnelAggregate | null>(
        `/telemetry/funnel?videoId=${encodeURIComponent(videoId)}`,
        { timeout: 4000 },
      );
      return toCommerceStats(funnel);
    } catch {
      return undefined;
    }
  },

  async getSourcingRequest(requestId: string): Promise<SourcingRequest | null> {
    const data = await apiClient.get<{ success: boolean; request?: SourcingRequest }>(`${PROXY_BASE}/requests/${requestId}`);
    return data.request ?? null;
  },

  async approveCandidate(requestId: string, candidateId: string): Promise<{ success: boolean; productId?: string; productUrl?: string; orchidyMarketplaceProductId?: string | null; status?: string; error?: string }> {
    return apiClient.post<{ success: boolean; productId?: string; productUrl?: string; orchidyMarketplaceProductId?: string | null; status?: string; error?: string }>(`${PROXY_BASE}/requests/${requestId}/approve`, { candidateId });
  },

  async generateVideo(requestId: string): Promise<GeneratedTrendVideo> {
    return apiClient.post<GeneratedTrendVideo>(`${PROXY_BASE}/requests/${requestId}/generate-video`, {});
  },

  async getGeneratedVideo(requestId: string): Promise<GeneratedVideoState | null> {
    const data = await apiClient.get<{ success: boolean; video?: GeneratedVideoState | null }>(`${PROXY_BASE}/requests/${requestId}/generate-video`);
    return data.video ?? null;
  },

  async publishGeneratedVideoToOrky(requestId: string): Promise<ImportedTrendVideo> {
    const token = await apiClient.currentAccessToken();
    if (!token) throw new Error('Authentication required');
    const response = await fetch('/api/trends/generated-video/import', {
      method: 'POST',
      credentials: 'same-origin',
      headers: {
        authorization: `Bearer ${token}`,
        'content-type': 'application/json',
        accept: 'application/json',
      },
      body: JSON.stringify({ requestId }),
    });
    const payload = await response.json().catch(() => ({})) as ImportedTrendVideo;
    if (!response.ok || !payload.success) {
      const error = new Error(payload.error || 'ORKY video import failed');
      (error as any).status = response.status;
      throw error;
    }
    return payload;
  },

  async listSourcingRequests(limit = 50): Promise<SourcingRequest[]> {
    const data = await apiClient.get<{ success: boolean; requests: SourcingRequest[] }>(`${PROXY_BASE}/requests?limit=${limit}`);
    return data.requests ?? [];
  },
};
