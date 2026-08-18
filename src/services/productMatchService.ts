import { apiClient } from './api';

export interface VideoProductMatchCandidate {
  orchidyCatalogItemId: string;
  title: string;
  slug?: string;
  images: string[];
  price?: number;
  currency?: string;
  score: number;
  source: 'catalog_lexical_match';
  requiresApproval: true;
}

export interface VideoProductMatchRecord {
  id: string;
  videoId: string;
  orchidyCatalogItemId: string;
  variantKey: string;
  confidence: number;
  source: string;
  status: string;
}

export const productMatchService = {
  async candidates(input: {
    title: string;
    hashtags?: string[];
    limit?: number;
  }): Promise<VideoProductMatchCandidate[]> {
    const params = new URLSearchParams({
      title: input.title,
      hashtags: (input.hashtags || []).join(','),
      limit: String(input.limit ?? 8),
    });
    const raw = await apiClient.get<{ candidates: VideoProductMatchCandidate[] }>(`/product-matches/candidates?${params.toString()}`);
    return raw.candidates;
  },

  async attach(input: {
    videoId: string;
    orchidyCatalogItemId: string;
    variantKey?: string;
    source?: 'manual' | 'matcher' | 'import';
    confidence?: number;
  }): Promise<VideoProductMatchRecord> {
    const raw = await apiClient.post<{ match: VideoProductMatchRecord }>('/product-matches', {
      videoId: input.videoId,
      orchidyCatalogItemId: input.orchidyCatalogItemId,
      variantKey: input.variantKey ?? '',
      source: input.source ?? 'manual',
      confidence: input.confidence ?? 1,
    });
    return raw.match;
  },

  async forVideo(videoId: string): Promise<VideoProductMatchRecord[]> {
    const raw = await apiClient.get<{ matches: VideoProductMatchRecord[] }>(`/product-matches/video/${encodeURIComponent(videoId)}`);
    return raw.matches;
  },

  async remove(id: string): Promise<void> {
    await apiClient.delete(`/product-matches/${encodeURIComponent(id)}`);
  },
};
