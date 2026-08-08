import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, RouteName } from './NavigationContext';
import { SCREEN_REGISTRY, TAB_ROUTES, ROUTE_TO_TAB } from './screenRegistry';
import { useBrandingStore } from '@/store/brandingStore';

interface TabDef {
  route: RouteName;
  icon: string;
  label: string;
}

const TABS: TabDef[] = [
  { route: 'feed.foryou', icon: '🏠', label: 'Accueil' },
  { route: 'explore', icon: '🔍', label: 'Découvrir' },
  { route: 'shop', icon: '🛍️', label: 'Shop' },
  { route: 'create', icon: '+', label: '' },
  { route: 'inbox', icon: '💬', label: 'Boîte' },
  { route: 'profile', icon: '👤', label: 'Profil' },
];

// Routes that take over the full screen (no bottom tab bar).
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
  const isMobile = width < 500;
  const nav = useNavigation();
  const route = nav.current.name;
  const Screen = SCREEN_REGISTRY[route];
  const showTabBar = !FULLSCREEN_ROUTES.includes(route);
  const activeTab = ROUTE_TO_TAB[route];
  const branding = useBrandingStore((s) => s.branding);

  return (
    <View style={styles.outer}>
      <View style={[styles.phone, isMobile ? styles.phoneMobile : styles.phoneDesktop]}>
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
  phoneMobile: { maxWidth: '100%', maxHeight: '100%', borderRadius: 0 },
  phoneDesktop: { maxWidth: 430, maxHeight: 932, borderRadius: 36 },
  screen: { flex: 1, position: 'relative' },
  screenFill: { flex: 1, width: '100%', height: '100%' },
  bottomNav: {
    position: 'absolute',
    left: 0, right: 0, bottom: 0,
    flexDirection: 'row',
    backgroundColor: 'rgba(9, 9, 15, 0.96)',
    borderTopWidth: 0.5,
    borderTopColor: '#22222F',
    paddingTop: 8,
    zIndex: 50,
  },
  navItem: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 2, paddingHorizontal: 2 },
  navIcon: { fontSize: 21, opacity: 0.65 },
  navLabel: { fontSize: 9, color: '#9A9AA8' },
  createBtn: {
    width: 46, height: 30, borderRadius: 8,
    backgroundColor: '#15151F',
    borderWidth: 2,
    borderColor: '#7C3AED',
    justifyContent: 'center', alignItems: 'center',
    shadowColor: '#F72585', shadowOpacity: 0.45, shadowRadius: 8, shadowOffset: { width: -2, height: 0 },
  },
  createBtnText: { fontSize: 22, color: '#fff', lineHeight: 24, fontWeight: '700' },
  missing: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#09090F' },
  missingText: { color: '#fff', fontSize: 16 },
});
