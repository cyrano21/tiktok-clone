import { apiClient } from './api';

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
