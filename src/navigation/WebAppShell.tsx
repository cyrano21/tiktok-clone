import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Dimensions } from 'react-native';
import { useNavigation, RouteName } from './NavigationContext';
import { SCREEN_REGISTRY, TAB_ROUTES, ROUTE_TO_TAB } from './screenRegistry';
import { useBrandingStore } from '@/store/brandingStore';

const { width } = Dimensions.get('window');
const isMobile = width < 500;

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
  const nav = useNavigation();
  const route = nav.current.name;
  const Screen = SCREEN_REGISTRY[route];
  const showTabBar = !FULLSCREEN_ROUTES.includes(route);
  const activeTab = ROUTE_TO_TAB[route];
  const branding = useBrandingStore((s) => s.branding);

  return (
    <View style={styles.outer}>
      <View style={styles.phone}>
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
          <View style={styles.bottomNav}>
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
    backgroundColor: '#0a0a0a',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: '100%',
  },
  phone: {
    width: '100%',
    maxWidth: isMobile ? '100%' : 430,
    height: '100%',
    maxHeight: isMobile ? '100%' : 932,
    backgroundColor: '#000',
    borderRadius: isMobile ? 0 : 36,
    overflow: 'hidden',
    position: 'relative',
  },
  screen: { flex: 1, position: 'relative' },
  screenFill: { flex: 1, width: '100%', height: '100%' },
  bottomNav: {
    position: 'absolute',
    left: 0, right: 0, bottom: 0,
    flexDirection: 'row',
    backgroundColor: 'rgba(0,0,0,0.96)',
    borderTopWidth: 0.5,
    borderTopColor: '#1f1f1f',
    paddingTop: 8,
    paddingBottom: 16,
    zIndex: 50,
  },
  navItem: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 2, paddingHorizontal: 2 },
  navIcon: { fontSize: 21, opacity: 0.65 },
  navLabel: { fontSize: 9, color: '#a8a8a8' },
  createBtn: {
    width: 46, height: 30, borderRadius: 8,
    backgroundColor: '#FE2C55',
    justifyContent: 'center', alignItems: 'center',
    shadowColor: '#25F4EE', shadowOpacity: 0.5, shadowRadius: 6, shadowOffset: { width: -2, height: 0 },
  },
  createBtnText: { fontSize: 22, color: '#fff', lineHeight: 24, fontWeight: '700' },
  missing: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#000' },
  missingText: { color: '#fff', fontSize: 16 },
});
