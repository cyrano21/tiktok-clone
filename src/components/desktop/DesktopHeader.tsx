import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, TextInput } from 'react-native';
import { useNavigation } from '@/navigation/NavigationContext';
import { useBrandingStore } from '@/store/brandingStore';

export function DesktopHeader() {
  const nav = useNavigation();
  const branding = useBrandingStore((s) => s.branding);
  const [searchQuery, setSearchQuery] = useState('');

  const handleSearch = () => {
    const q = searchQuery.trim();
    if (q) {
      nav.push('explore.search', { query: q });
    } else {
      nav.push('explore');
    }
  };

  return (
    <View style={styles.header}>
      {/* Brand logo */}
      <TouchableOpacity
        style={styles.logoContainer}
        activeOpacity={0.8}
        onPress={() => nav.reset('feed.foryou')}
      >
        <Text style={styles.logoText}>ORKY</Text>
        <View style={styles.brandBadge}>
          <Text style={styles.brandBadgeText}>by Orchidy</Text>
        </View>
      </TouchableOpacity>

      {/* Search Bar */}
      <View style={styles.searchContainer}>
        <TextInput
          style={styles.searchInput}
          placeholder="Rechercher des comptes, vidéos, tendances..."
          placeholderTextColor="#717185"
          value={searchQuery}
          onChangeText={setSearchQuery}
          onSubmitEditing={handleSearch}
          returnKeyType="search"
        />
        <TouchableOpacity
          style={styles.searchButton}
          activeOpacity={0.7}
          onPress={handleSearch}
          accessibilityLabel="Lancer la recherche"
        >
          <Text style={styles.searchButtonIcon}>🔍</Text>
        </TouchableOpacity>
      </View>

      {/* Right action buttons */}
      <View style={styles.actionsContainer}>
        <TouchableOpacity
          style={[styles.createButton, { backgroundColor: branding.primaryColor }]}
          activeOpacity={0.85}
          onPress={() => nav.push('studio')}
        >
          <Text style={styles.createButtonPlus}>＋</Text>
          <Text style={styles.createButtonText}>Studio</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.iconNavBtn}
          activeOpacity={0.75}
          onPress={() => nav.push('shop')}
          accessibilityLabel="Boutique Orchidy"
        >
          <Text style={styles.iconNavEmoji}>🛍️</Text>
          <Text style={styles.iconNavLabel}>Shop</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.iconNavBtn}
          activeOpacity={0.75}
          onPress={() => nav.push('shop.products')}
          accessibilityLabel="Produits du moment"
        >
          <Text style={styles.iconNavEmoji}>🔥</Text>
          <Text style={styles.iconNavLabel}>Produits</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.iconNavBtn}
          activeOpacity={0.75}
          onPress={() => nav.push('inbox')}
          accessibilityLabel="Boîte de réception"
        >
          <Text style={styles.iconNavEmoji}>💬</Text>
          <Text style={styles.iconNavLabel}>Messages</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.profileBtn}
          activeOpacity={0.8}
          onPress={() => nav.push('profile')}
          accessibilityLabel="Mon profil"
        >
          <Text style={styles.profileBtnAvatar}>👤</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    height: 60,
    width: '100%',
    backgroundColor: '#0D0D16',
    borderBottomWidth: 1,
    borderBottomColor: '#1E1E2C',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 24,
    zIndex: 100,
  },
  logoContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  logoText: {
    fontSize: 24,
    fontWeight: '900',
    color: '#FFFFFF',
    letterSpacing: -0.5,
  },
  brandBadge: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 6,
    backgroundColor: 'rgba(124, 58, 237, 0.25)',
    borderWidth: 1,
    borderColor: 'rgba(124, 58, 237, 0.5)',
  },
  brandBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#A78BFA',
    letterSpacing: 0.3,
  },
  searchContainer: {
    flex: 1,
    maxWidth: 420,
    marginHorizontal: 24,
    height: 40,
    backgroundColor: '#161624',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#26263B',
    flexDirection: 'row',
    alignItems: 'center',
    paddingLeft: 16,
    paddingRight: 6,
  },
  searchInput: {
    flex: 1,
    color: '#FFFFFF',
    fontSize: 13,
    outlineStyle: 'none' as any,
  },
  searchButton: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
  },
  searchButtonIcon: {
    fontSize: 13,
  },
  actionsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  createButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
  },
  createButtonPlus: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '900',
    lineHeight: 16,
  },
  createButtonText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
  iconNavBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  iconNavEmoji: {
    fontSize: 14,
  },
  iconNavLabel: {
    color: '#C4C4D4',
    fontSize: 12,
    fontWeight: '600',
  },
  profileBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#222234',
    borderWidth: 1.5,
    borderColor: '#7C3AED',
    alignItems: 'center',
    justifyContent: 'center',
  },
  profileBtnAvatar: {
    fontSize: 16,
  },
});
