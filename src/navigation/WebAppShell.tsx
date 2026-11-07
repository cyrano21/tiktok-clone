import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, RouteName } from './NavigationContext';
import { SCREEN_REGISTRY, TAB_ROUTES, ROUTE_TO_TAB } from './screenRegistry';
import { useBrandingStore } from '@/store/brandingStore';
import { OrchidyCheckoutReturnNotice } from '@/components/shop/OrchidyCheckoutReturnNotice';
import { DesktopHeader } from '@/components/desktop/DesktopHeader';
import { DesktopSidebar } from '@/components/desktop/DesktopSidebar';
import { DesktopFeedControls } from '@/components/desktop/DesktopFeedControls';

interface TabDef {
  route: RouteName;
  icon: string;
  label: string;
}

const TABS: TabDef[] = [
  { route: 'feed.foryou', icon: '🏠', label: 'Accueil' },
  { route: 'explore', icon: '🔍', label: 'Découvrir' },
  { route: 'shop', icon: '🛍️', label: 'Shop' },
  { route: 'shop.products', icon: '🔥', label: 'Produits' },
  { route: 'create', icon: '+', label: '' },
  { route: 'inbox', icon: '💬', label: 'Boîte' },
  { route: 'profile', icon: '👤', label: 'Profil' },
];

// Routes qui prennent tout l'écran sur mobile (pas de barre inférieure).
const FULLSCREEN_ROUTES: RouteName[] = [
  'create.record',
  'create.edit',
  'create.publish',
  'live',
  'live.broadcast',
  'call',
  'inbox.chat',
  'inbox.activity',
  'shop.product',
  'shop.cart',
  'shop.seller',
  'shop.dashboard',
  'shop.product.editor',
  'shop.checkout',
  'shop.image.generator',
  'orders',
  'studio.editor',
  'studio',
  'studio.analytics',
  'studio.monetization',
  'studio.content',
  'studio.post',
  'studio.tiktok',
  'studio.scraper',
  'video.comments',
  'profile.settings',
  'profile.settings.detail',
  'profile.edit',
];

export function WebAppShell() {
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const isDesktop = width >= 860;
  const nav = useNavigation();
  const route = nav.current.name;
  const Screen = SCREEN_REGISTRY[route];
  const activeTab = ROUTE_TO_TAB[route];
  const branding = useBrandingStore((s) => s.branding);

  const isFeedRoute = ['feed.foryou', 'feed.following'].includes(route);

  // Mise en page Desktop (≥ 860px) : Header en haut, Sidebar à gauche, contenu central et aucun onglet mobile
  if (isDesktop) {
    return (
      <View style={styles.desktopOuter}>
        <DesktopHeader />

        <View style={styles.desktopBody}>
          <DesktopSidebar />

          <View style={styles.desktopMainArea}>
            {isFeedRoute ? (
              <View style={styles.desktopFeedLayout}>
                <View style={styles.desktopFeedCard}>
                  {Screen ? <Screen /> : <Missing route={route} />}
                </View>
                <DesktopFeedControls />
              </View>
            ) : (
              <View style={styles.desktopWideContainer}>
                <View style={styles.desktopWideInner}>
                  {Screen ? <Screen /> : <Missing route={route} />}
                </View>
              </View>
            )}
          </View>
        </View>

        <OrchidyCheckoutReturnNotice />
      </View>
    );
  }

  // Mise en page Mobile (< 860px) : plein écran immersif avec barre inférieure
  const showTabBar = !FULLSCREEN_ROUTES.includes(route);

  return (
    <View style={styles.outer}>
      <View style={[styles.phone, styles.phoneMobile]}>
        <View style={styles.screen}>
          {Screen ? (
            <View style={styles.screenFill}>
              <Screen />
            </View>
          ) : (
            <Missing route={route} />
          )}
        </View>

        {showTabBar && (
          <View style={[styles.bottomNav, { paddingBottom: Math.max(insets.bottom, 16) }]}>
            {TABS.map((tab) => {
              const isActive = activeTab === tab.route;
              if (tab.route === 'create') {
                return (
                  <TouchableOpacity key={tab.route} style={styles.navItem} onPress={() => nav.reset('create')}>
                    <View style={[styles.createBtn, { backgroundColor: branding.primaryColor, shadowColor: branding.accentColor }]}>
                      <Text style={styles.createBtnText}>+</Text>
                    </View>
                  </TouchableOpacity>
                );
              }
              return (
                <TouchableOpacity key={tab.route} style={styles.navItem} onPress={() => nav.reset(tab.route)}>
                  <Text style={[styles.navIcon, isActive && { color: branding.primaryColor, opacity: 1 }]}>{tab.icon}</Text>
                  <Text style={[styles.navLabel, isActive && { color: branding.primaryColor, fontWeight: '700' }]}>{tab.label}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
        )}
        <OrchidyCheckoutReturnNotice />
      </View>
    </View>
  );
}

function Missing({ route }: { route: string }) {
  return (
    <View style={styles.missing}>
      <Text style={styles.missingText}>Écran introuvable: {route}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  // Desktop
  desktopOuter: {
    flex: 1,
    width: '100%',
    height: '100%',
    backgroundColor: '#09090F',
    flexDirection: 'column',
    overflow: 'hidden',
  },
  desktopBody: {
    flex: 1,
    flexDirection: 'row',
    width: '100%',
    minHeight: 0,
    backgroundColor: '#09090F',
    overflow: 'hidden',
  },
  desktopMainArea: {
    flex: 1,
    height: '100%',
    minWidth: 0,
    backgroundColor: '#09090F',
    overflow: 'hidden',
  },
  desktopFeedLayout: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    height: '100%',
  },
  desktopFeedCard: {
    width: 480,
    maxWidth: '100%',
    height: '100%',
    borderRadius: 14,
    overflow: 'hidden',
    backgroundColor: '#000000',
    borderWidth: 1,
    borderColor: '#1E1E2C',
    shadowColor: '#000',
    shadowOpacity: 0.45,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 4 },
  },
  desktopWideContainer: {
    flex: 1,
    width: '100%',
    height: '100%',
    alignItems: 'center',
    overflow: 'hidden',
  },
  desktopWideInner: {
    width: '100%',
    maxWidth: 1160,
    height: '100%',
    overflow: 'hidden',
  },

  // Mobile
  outer: {
    flex: 1,
    backgroundColor: '#09090F',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: '100%',
  },
  phone: {
    width: '100%',
    height: '100%',
    backgroundColor: '#000',
    overflow: 'hidden',
    position: 'relative',
  },
  phoneMobile: {
    maxWidth: '100%',
    maxHeight: '100%',
    borderRadius: 0,
  },
  screen: {
    flex: 1,
    position: 'relative',
  },
  screenFill: {
    flex: 1,
    width: '100%',
    height: '100%',
  },
  bottomNav: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    flexDirection: 'row',
    backgroundColor: 'rgba(9, 9, 15, 0.96)',
    borderTopWidth: 0.5,
    borderTopColor: '#22222F',
    paddingTop: 8,
    zIndex: 50,
  },
  navItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
    paddingHorizontal: 2,
  },
  navIcon: {
    fontSize: 21,
    opacity: 0.65,
  },
  navLabel: {
    fontSize: 9,
    color: '#9A9AA8',
  },
  createBtn: {
    width: 46,
    height: 30,
    borderRadius: 8,
    backgroundColor: '#15151F',
    borderWidth: 2,
    borderColor: '#7C3AED',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#F72585',
    shadowOpacity: 0.45,
    shadowRadius: 8,
    shadowOffset: { width: -2, height: 0 },
  },
  createBtnText: {
    fontSize: 22,
    color: '#fff',
    lineHeight: 24,
    fontWeight: '700',
  },
  missing: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#09090F',
  },
  missingText: {
    color: '#fff',
    fontSize: 16,
  },
});
