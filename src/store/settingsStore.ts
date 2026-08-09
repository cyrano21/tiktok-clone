import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

export type LanguageCode = 'fr' | 'en' | 'es' | 'de';

interface SettingsState {
  notifications: boolean;
  darkMode: boolean;
  dataSaver: boolean;
  language: LanguageCode;
  clearCache: () => void;
  cacheClearedAt: number | null;
  toggle: (key: 'notifications' | 'darkMode' | 'dataSaver') => void;
  cycleLanguage: () => void;
}

export const LANGUAGE_OPTIONS: Array<{ code: LanguageCode; label: string }> = [
  { code: 'fr', label: 'Français' },
  { code: 'en', label: 'English' },
  { code: 'es', label: 'Español' },
  { code: 'de', label: 'Deutsch' },
];

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set, get) => ({
      notifications: true,
      darkMode: true,
      dataSaver: false,
      language: 'en',
      cacheClearedAt: null,
      clearCache: () => set({ cacheClearedAt: Date.now() }),
      toggle: (key) => set((state) => ({ ...state, [key]: !state[key] })),
      cycleLanguage: () => {
        const { language } = get();
        const index = LANGUAGE_OPTIONS.findIndex((o) => o.code === language);
        const next = LANGUAGE_OPTIONS[(index + 1) % LANGUAGE_OPTIONS.length];
        set({ language: next.code });
      },
    }),
    {
      name: 'orky-settings',
      storage: createJSONStorage(() => AsyncStorage),
    }
  )
);
