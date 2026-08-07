import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, FlatList, Image, ActivityIndicator } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { tokens } from '@/theme/tokens';
import { useNavigation } from '@/navigation/NavigationContext';
import { discoverService, type DiscoverCategory, type DiscoverVideo } from '@/services/discoverService';

const CATEGORIES: Array<{ label: string; value: DiscoverCategory }> = [
  { label: 'All', value: 'all' },
  { label: 'Trending', value: 'trending' },
  { label: 'Music', value: 'music' },
  { label: 'Comedy', value: 'comedy' },
  { label: 'Sports', value: 'sports' },
  { label: 'Food', value: 'food' },
  { label: 'Beauty', value: 'beauty' },
];

export const ExploreScreen: React.FC = () => {
  const insets = useSafeAreaInsets();
  const nav = useNavigation();
  const [activeCategory, setActiveCategory] = useState<DiscoverCategory>('all');
  const [videos, setVideos] = useState<DiscoverVideo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadVideos = useCallback(async (category: DiscoverCategory) => {
    setLoading(true);
    setError(null);
    try {
      const result = await discoverService.getVideos(category);
      setVideos(result);
    } catch {
      setVideos([]);
      setError('Impossible de charger Découvrir. Vérifie ta connexion puis réessaie.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadVideos(activeCategory);
  }, [activeCategory, loadVideos]);

  const renderTrendingItem = ({ item }: { item: DiscoverVideo }) => (
    <TouchableOpacity testID={`discover-video-${item.id}`} style={styles.trendingItem} onPress={() => nav.push('explore.hashtag', { tag: item.title })}>
      <Image source={{ uri: item.thumbnailUrl }} style={styles.trendingThumbnail} resizeMode="cover" />
      <View style={styles.trendingOverlay}>
        <Text style={styles.trendingTitle}>{item.title}</Text>
        <Text style={styles.trendingViews}>{item.viewsCount} vues</Text>
      </View>
    </TouchableOpacity>
  );

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.searchContainer}>
        <TouchableOpacity activeOpacity={0.8} onPress={() => nav.push('explore.search')}>
          <View style={styles.searchBar}>
            <Text style={styles.searchIcon}>🔍</Text>
            <Text style={[styles.searchInput, { color: tokens.colors.text.tertiary }]}>Search</Text>
          </View>
        </TouchableOpacity>
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.tabsContainer} contentContainerStyle={styles.tabsContent}>
        {CATEGORIES.map((category) => (
          <TouchableOpacity
            key={category.value}
            accessibilityRole="button"
            accessibilityState={{ selected: activeCategory === category.value }}
            style={[styles.tab, activeCategory === category.value && styles.tabActive]}
            onPress={() => setActiveCategory(category.value)}
          >
            <Text style={[styles.tabText, activeCategory === category.value && styles.tabTextActive]}>{category.label}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {loading && (
        <View style={styles.stateContainer}>
          <ActivityIndicator color={tokens.colors.brand.primary} />
          <Text style={styles.stateText}>Chargement des vidéos…</Text>
        </View>
      )}
      {!loading && error && (
        <View style={styles.stateContainer}>
          <Text style={styles.stateText}>{error}</Text>
          <TouchableOpacity style={styles.retryButton} onPress={() => void loadVideos(activeCategory)}>
            <Text style={styles.retryText}>Réessayer</Text>
          </TouchableOpacity>
        </View>
      )}
      {!loading && !error && videos.length === 0 && (
        <View style={styles.stateContainer}>
          <Text style={styles.stateText}>Aucune vidéo dans cette catégorie pour le moment.</Text>
        </View>
      )}
      {!loading && !error && videos.length > 0 && (
        <FlatList
          data={videos}
          extraData={activeCategory}
          renderItem={renderTrendingItem}
          keyExtractor={(item) => item.id}
          numColumns={2}
          columnWrapperStyle={styles.gridRow}
          contentContainerStyle={styles.gridContent}
          showsVerticalScrollIndicator={false}
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: tokens.colors.bg },
  searchContainer: { paddingHorizontal: tokens.spacing.md, paddingVertical: tokens.spacing.sm },
  searchBar: { flexDirection: 'row', alignItems: 'center', backgroundColor: tokens.colors.elevated, borderRadius: tokens.radius.full, paddingHorizontal: tokens.spacing.md, height: 40 },
  searchIcon: { fontSize: 16, marginRight: tokens.spacing.sm },
  searchInput: { flex: 1, fontSize: tokens.typography.body.fontSize },
  tabsContainer: { height: 48, flexGrow: 0, flexShrink: 0 },
  tabsContent: { flexGrow: 0, alignItems: 'center', paddingHorizontal: tokens.spacing.md, gap: tokens.spacing.sm },
  tab: { paddingHorizontal: tokens.spacing.md, paddingVertical: tokens.spacing.sm, borderRadius: tokens.radius.full, backgroundColor: tokens.colors.elevated },
  tabActive: { backgroundColor: tokens.colors.white },
  tabText: { color: tokens.colors.text.secondary, fontSize: tokens.typography.body.fontSize, fontWeight: '500' },
  tabTextActive: { color: tokens.colors.black, fontWeight: '700' },
  gridRow: { gap: 2 },
  gridContent: { padding: 2, paddingTop: tokens.spacing.md, paddingBottom: 96 },
  trendingItem: { flex: 1, aspectRatio: 3 / 4, margin: 1, borderRadius: tokens.radius.xs, overflow: 'hidden' },
  trendingThumbnail: { width: '100%', height: '100%' },
  trendingOverlay: { position: 'absolute', bottom: 0, left: 0, right: 0, padding: tokens.spacing.sm, backgroundColor: 'rgba(0,0,0,0.4)' },
  trendingTitle: { color: tokens.colors.white, fontSize: tokens.typography.body.fontSize, fontWeight: '600' },
  trendingViews: { color: tokens.colors.text.secondary, fontSize: tokens.typography.caption.fontSize },
  stateContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: tokens.spacing.sm, padding: tokens.spacing.xl },
  stateText: { color: tokens.colors.text.secondary, textAlign: 'center', fontSize: tokens.typography.body.fontSize },
  retryButton: { backgroundColor: tokens.colors.brand.primary, paddingHorizontal: tokens.spacing.lg, paddingVertical: tokens.spacing.sm, borderRadius: tokens.radius.sm },
  retryText: { color: tokens.colors.white, fontWeight: '700' },
});
