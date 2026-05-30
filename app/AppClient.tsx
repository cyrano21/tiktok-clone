'use client';

import React from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { NavigationProvider } from '@/navigation/NavigationContext';
import { WebAppShell } from '@/navigation/WebAppShell';

/**
 * Client-only root for the react-native-web app.
 *
 * The whole UI relies on browser APIs (Dimensions, window, in-memory
 * navigation state), so it is mounted client-side. This mirrors the previous
 * Vite `App.tsx` composition exactly — only the build host changed (Next.js).
 */
export default function AppClient() {
  return (
    <SafeAreaProvider>
      <NavigationProvider initial={{ name: 'feed.foryou' }}>
        <WebAppShell />
      </NavigationProvider>
    </SafeAreaProvider>
  );
}
