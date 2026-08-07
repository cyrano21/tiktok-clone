import React, { createContext, useCallback, useContext, useMemo, useState } from 'react';

export type RouteName =
  | 'feed.foryou'
  | 'feed.following'
  | 'explore'
  | 'explore.search'
  | 'explore.hashtag'
  | 'explore.sound'
  | 'create'
  | 'create.record'
  | 'create.edit'
  | 'create.publish'
  | 'shop'
  | 'shop.product'
  | 'shop.cart'
  | 'shop.seller'
  | 'shop.dashboard'
  | 'shop.product.editor'
  | 'shop.checkout'
  | 'shop.image.generator'
  | 'orders'
  | 'studio'
  | 'studio.editor'
  | 'studio.analytics'
  | 'studio.monetization'
  | 'studio.content'
  | 'studio.post'
  | 'studio.tiktok'
  | 'studio.billing'
  | 'studio.crosspost'
  | 'studio.branding'
  | 'studio.scraper'
  | 'video.comments'
  | 'live'
  | 'live.broadcast'
  | 'inbox'
  | 'inbox.chat'
  | 'inbox.activity'
  | 'call'
  | 'profile'
  | 'profile.edit'
  | 'profile.settings'
  | 'profile.settings.detail'
  | 'auth.login'
  | 'auth.register';

export interface RouteEntry<P = Record<string, unknown>> {
  name: RouteName;
  params?: P;
}

interface NavigationContextValue {
  current: RouteEntry;
  history: RouteEntry[];
  push: (name: RouteName, params?: Record<string, unknown>) => void;
  replace: (name: RouteName, params?: Record<string, unknown>) => void;
  back: () => void;
  canGoBack: boolean;
  reset: (name: RouteName) => void;
}

const NavigationContext = createContext<NavigationContextValue | null>(null);

interface ProviderProps {
  initial?: RouteEntry;
  children: React.ReactNode;
}

export function NavigationProvider({ initial = { name: 'feed.foryou' }, children }: ProviderProps) {
  const [history, setHistory] = useState<RouteEntry[]>([initial]);

  const push = useCallback((name: RouteName, params?: Record<string, unknown>) => {
    setHistory((h) => [...h, { name, params }]);
  }, []);

  const replace = useCallback((name: RouteName, params?: Record<string, unknown>) => {
    setHistory((h) => [...h.slice(0, -1), { name, params }]);
  }, []);

  const back = useCallback(() => {
    setHistory((h) => (h.length > 1 ? h.slice(0, -1) : h));
  }, []);

  const reset = useCallback((name: RouteName) => {
    setHistory([{ name }]);
  }, []);

  const value = useMemo<NavigationContextValue>(
    () => ({
      current: history[history.length - 1],
      history,
      push,
      replace,
      back,
      canGoBack: history.length > 1,
      reset,
    }),
    [history, push, replace, back, reset]
  );

  return <NavigationContext.Provider value={value}>{children}</NavigationContext.Provider>;
}

export function useNavigation(): NavigationContextValue {
  const ctx = useContext(NavigationContext);
  if (!ctx) throw new Error('useNavigation must be used inside NavigationProvider');
  return ctx;
}

export function useRouteParams<P = Record<string, unknown>>(): P {
  const { current } = useNavigation();
  return (current.params as P) ?? ({} as P);
}
