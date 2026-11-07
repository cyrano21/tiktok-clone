import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { useNavigation, RouteName } from '@/navigation/NavigationContext';
import { ROUTE_TO_TAB } from '@/navigation/screenRegistry';
import { useBrandingStore } from '@/store/brandingStore';

interface NavItem {
  route: RouteName;
  icon: string;
  label: string;
}

const PRIMARY_NAV: NavItem[] = [
  { route: 'feed.foryou', icon: '🏠', label: 'Pour toi' },
  { route: 'feed.following', icon: '👥', label: 'Abonnements' },
  { route: 'explore', icon: '🔍', label: 'Découvrir' },
  { route: 'shop', icon: '🛍️', label: 'Shop Orchidy' },
  { route: 'shop.products', icon: '🔥', label: 'Produits du moment' },
  { route: 'studio', icon: '🎬', label: 'Studio Créateur' },
  { route: 'inbox', icon: '💬', label: 'Boîte de réception' },
  { route: 'profile', icon: '👤', label: 'Mon Profil' },
];

const TRENDING_TAGS = ['comedy', 'sport', 'orchidy', 'manvsbee', 'funny', 'lifestyle'];

const SUGGESTED_CREATORS = [
  { handle: 'mrbean', name: 'Rowan Atkinson', followers: '3.0M' },
  { handle: 'adrianbliss', name: 'Adrian Bliss', followers: '4.9M' },
  { handle: 'joynlife_', name: 'Joy Habib', followers: '7.7M' },
];

export function DesktopSidebar() {
  const nav = useNavigation();
  const currentRoute = nav.current.name;
  const activeTab = ROUTE_TO_TAB[currentRoute] || currentRoute;
  const branding = useBrandingStore((s) => s.branding);

  return (
    <View style={styles.sidebar}>
      <ScrollView
        style={styles.scrollArea}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Navigation principale */}
        <View style={styles.navSection}>
          {PRIMARY_NAV.map((item) => {
            const isActive = currentRoute === item.route || activeTab === item.route;
            return (
              <TouchableOpacity
                key={item.route}
                style={[
                  styles.navItem,
                  isActive && [styles.navItemActive, { backgroundColor: 'rgba(124, 58, 237, 0.12)' }],
                ]}
                activeOpacity={0.7}
                onPress={() => nav.reset(item.route)}
              >
                <Text style={[styles.navIcon, isActive && { opacity: 1 }]}>{item.icon}</Text>
                <Text
                  style={[
                    styles.navLabel,
                    isActive && { color: branding.primaryColor, fontWeight: '700' },
                  ]}
                >
                  {item.label}
                </Text>
                {isActive && (
                  <View style={[styles.activeIndicator, { backgroundColor: branding.primaryColor }]} />
                )}
              </TouchableOpacity>
            );
          })}
        </View>

        <View style={styles.divider} />

        {/* Créateurs suggérés */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Comptes suggérés</Text>
          {SUGGESTED_CREATORS.map((creator) => (
            <TouchableOpacity
              key={creator.handle}
              style={styles.creatorItem}
              activeOpacity={0.7}
              onPress={() => nav.push('profile')}
            >
              <View style={styles.creatorAvatar}>
                <Text style={styles.creatorAvatarText}>👤</Text>
              </View>
              <View style={styles.creatorInfo}>
                <Text style={styles.creatorName} numberOfLines={1}>{creator.name}</Text>
                <Text style={styles.creatorHandle} numberOfLines={1}>@{creator.handle} · {creator.followers}</Text>
              </View>
            </TouchableOpacity>
          ))}
        </View>

        <View style={styles.divider} />

        {/* Tendances du moment */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Tendances populaires</Text>
          <View style={styles.tagsContainer}>
            {TRENDING_TAGS.map((tag) => (
              <TouchableOpacity
                key={tag}
                style={styles.tagBadge}
                activeOpacity={0.7}
                onPress={() => nav.push('explore.hashtag', { tag })}
              >
                <Text style={styles.tagBadgeText}>#{tag}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        <View style={styles.divider} />

        {/* Footer info */}
        <View style={styles.footerSection}>
          <Text style={styles.footerBrand}>ORKY by Orchidy</Text>
          <Text style={styles.footerLegal}>
            Plateforme vidéo & commerce · © 2026 Tous droits réservés.
          </Text>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  sidebar: {
    width: 250,
    height: '100%',
    backgroundColor: '#0A0A13',
    borderRightWidth: 1,
    borderRightColor: '#1A1A28',
  },
  scrollArea: {
    flex: 1,
  },
  scrollContent: {
    paddingVertical: 16,
    paddingHorizontal: 12,
  },
  navSection: {
    gap: 4,
  },
  navItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 10,
    position: 'relative',
    gap: 12,
  },
  navItemActive: {
    borderWidth: 1,
    borderColor: 'rgba(124, 58, 237, 0.3)',
  },
  navIcon: {
    fontSize: 18,
    opacity: 0.8,
  },
  navLabel: {
    fontSize: 14,
    color: '#D1D1DF',
    fontWeight: '500',
    flex: 1,
  },
  activeIndicator: {
    width: 4,
    height: 18,
    borderRadius: 2,
  },
  divider: {
    height: 1,
    backgroundColor: '#191926',
    marginVertical: 16,
    marginHorizontal: 4,
  },
  section: {
    paddingHorizontal: 4,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: '#828298',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginBottom: 10,
  },
  creatorItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 7,
    paddingHorizontal: 6,
    borderRadius: 8,
  },
  creatorAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#1E1E2E',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  creatorAvatarText: {
    fontSize: 14,
  },
  creatorInfo: {
    flex: 1,
    minWidth: 0,
  },
  creatorName: {
    fontSize: 13,
    fontWeight: '600',
    color: '#EEEEF6',
  },
  creatorHandle: {
    fontSize: 11,
    color: '#76768B',
    marginTop: 1,
  },
  tagsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  tagBadge: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 14,
    backgroundColor: '#151522',
    borderWidth: 1,
    borderColor: '#242436',
  },
  tagBadgeText: {
    fontSize: 12,
    color: '#B0B0C4',
    fontWeight: '500',
  },
  footerSection: {
    paddingHorizontal: 4,
    paddingTop: 8,
    gap: 4,
  },
  footerBrand: {
    fontSize: 12,
    fontWeight: '700',
    color: '#9F80E8',
  },
  footerLegal: {
    fontSize: 10,
    color: '#555566',
    lineHeight: 14,
  },
});
