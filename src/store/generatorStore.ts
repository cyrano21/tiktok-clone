import { create } from 'zustand';

interface GeneratorState {
  // last image generated, consumed by the product editor
  lastGenerated: string | null;
  setLastGenerated: (dataUrl: string) => void;
  consume: () => string | null;
}

export const useGeneratorStore = create<GeneratorState>((set, get) => ({
  lastGenerated: null,
  setLastGenerated: (dataUrl) => set({ lastGenerated: dataUrl }),
  consume: () => {
    const v = get().lastGenerated;
    set({ lastGenerated: null });
    return v;
  },
}));
