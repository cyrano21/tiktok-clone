import { create } from 'zustand';
import { brandingService } from '@/services/brandingService';

export interface Branding {
  name: string;
  logoUrl: string;
  primaryColor: string;
  accentColor: string;
  tagline: string;
}

export const DEFAULT_BRANDING: Branding = {
  name: 'ORKY',
  logoUrl: '/logo_orky.png',
  primaryColor: '#7C3AED',
  accentColor: '#F72585',
  tagline: 'La vidéo qui vous ressemble',
};

interface BrandingState {
  branding: Branding;
  loaded: boolean;
  isCustom: boolean;
  load: () => Promise<void>;
  apply: (b: Partial<Branding>) => void;
  reset: () => void;
}

export const useBrandingStore = create<BrandingState>((set, get) => ({
  branding: DEFAULT_BRANDING,
  loaded: false,
  isCustom: false,

  load: async () => {
    try {
      const b = await brandingService.get();
      set({
        branding: b,
        loaded: true,
        isCustom: b.name !== DEFAULT_BRANDING.name,
      });
    } catch {
      set({ loaded: true, isCustom: false });
    }
  },

  apply: (b) => {
    set((state) => ({
      branding: { ...state.branding, ...b },
      isCustom: true,
    }));
  },

  reset: () => {
    set({ branding: DEFAULT_BRANDING, isCustom: false });
  },
}));

/** Convenience hook: current branding values. */
export function useBranding(): Branding {
  return useBrandingStore((s) => s.branding);
}
