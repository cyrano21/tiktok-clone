import React from 'react';

export const useSafeAreaInsets = () => {
  // The web shim has no native safe-area bridge. Keep desktop layouts flush,
  // and reserve the iOS home-indicator area only on narrow browser viewports.
  const isMobileViewport = typeof window !== 'undefined' && window.innerWidth < 500;
  return { top: isMobileViewport ? 44 : 0, bottom: isMobileViewport ? 34 : 0, left: 0, right: 0 };
};

export const SafeAreaProvider = ({ children }: { children: React.ReactNode }) => children;
export const SafeAreaView = ({ children }: { children: React.ReactNode }) => children;
