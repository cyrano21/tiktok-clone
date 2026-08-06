import { apiClient } from './api';
import type { Branding } from '@/store/brandingStore';

export const brandingService = {
  async get(): Promise<Branding> {
    const raw = await apiClient.get<{ branding: Partial<Branding> }>('/branding');
    const b = raw.branding ?? {};
    return {
      name: b.name || 'TikTok',
      logoUrl: b.logoUrl || '',
      primaryColor: b.primaryColor || '#FE2C55',
      accentColor: b.accentColor || '#25F4EE',
      tagline: b.tagline || 'Short videos',
    };
  },

  async update(b: Partial<Branding>): Promise<void> {
    await apiClient.put('/branding', b);
  },

  async reset(): Promise<void> {
    await apiClient.delete('/branding');
  },
};
