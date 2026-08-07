'use client';

import React, { useEffect } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { NavigationProvider } from '@/navigation/NavigationContext';
import { WebAppShell } from '@/navigation/WebAppShell';
import { useBrandingStore } from '@/store/brandingStore';
import { authService } from '@/services/authService';

/**
 * Client-only root for the react-native-web app.
 *
 * The whole UI relies on browser APIs (Dimensions, window, in-memory
 * navigation state), so it is mounted client-side. This mirrors the previous
 * Vite `App.tsx` composition exactly — only the build host changed (Next.js).
 */
export default function AppClient() {
  const loadBranding = useBrandingStore((s) => s.load);

  useEffect(() => {
    loadBranding();
    void authService.hydrateSession();
  }, [loadBranding]);

  return (
    <SafeAreaProvider>
      <NavigationProvider initial={{ name: 'feed.foryou' }}>
        <WebAppShell />
      </NavigationProvider>
    </SafeAreaProvider>
  );
}
