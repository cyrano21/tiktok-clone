import { apiClient } from './api';
import type { Branding } from '@/store/brandingStore';

export const brandingService = {
  async get(): Promise<Branding> {
    const raw = await apiClient.get<{ branding: Partial<Branding> }>('/branding');
    const b = raw.branding ?? {};
    return {
      name: b.name || 'ORKY',
      logoUrl: b.logoUrl || '/logo_orky.png',
      primaryColor: b.primaryColor || '#7C3AED',
      accentColor: b.accentColor || '#F72585',
      tagline: b.tagline || 'La vidéo qui vous ressemble',
    };
  },

  async update(b: Partial<Branding>): Promise<void> {
    await apiClient.put('/branding', b);
  },

  async reset(): Promise<void> {
    await apiClient.delete('/branding');
  },
};
