import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, FlatList, Image } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { tokens } from '@/theme/tokens';
import { useNavigation } from '@/navigation/NavigationContext';

interface TrendingItem {
  id: string;
  title: string;
  thumbnailUrl: string;
  viewsCount: string;
}

const MOCK_TRENDING: TrendingItem[] = [
  { id: '1', title: 'Dance Challenge', thumbnailUrl: 'https://picsum.photos/200/300', viewsCount: '2.5M' },
  { id: '2', title: 'Cooking Hacks', thumbnailUrl: 'https://picsum.photos/200/301', viewsCount: '1.8M' },
  { id: '3', title: 'Pet Moments', thumbnailUrl: 'https://picsum.photos/200/302', viewsCount: '3.1M' },
  { id: '4', title: 'Travel Vlogs', thumbnailUrl: 'https://picsum.photos/200/303', viewsCount: '900K' },
  { id: '5', title: 'DIY Projects', thumbnailUrl: 'https://picsum.photos/200/304', viewsCount: '1.2M' },
  { id: '6', title: 'Comedy Skits', thumbnailUrl: 'https://picsum.photos/200/305', viewsCount: '4.7M' },
];

const TABS = ['All', 'Trending', 'Music', 'Comedy', 'Sports', 'Food', 'Beauty'];

export const ExploreScreen: React.FC = () => {
  const insets = useSafeAreaInsets();
  const nav = useNavigation();
  const [activeTab, setActiveTab] = useState('All');
  const [searchQuery, setSearchQuery] = useState('');

  const renderTrendingItem = ({ item }: { item: TrendingItem }) => (
    <TouchableOpacity style={styles.trendingItem} onPress={() => nav.push('explore.hashtag', { tag: item.title })}>
      <Image source={{ uri: item.thumbnailUrl }} style={styles.trendingThumbnail} />
      <View style={styles.trendingOverlay}>
        <Text style={styles.trendingTitle}>{item.title}</Text>
        <Text style={styles.trendingViews}>{item.viewsCount} views</Text>
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

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.tabsContainer}
        contentContainerStyle={styles.tabsContent}
      >
        {TABS.map((tab) => (
          <TouchableOpacity
            key={tab}
            style={[styles.tab, activeTab === tab && styles.tabActive]}
            onPress={() => setActiveTab(tab)}
          >
            <Text style={[styles.tabText, activeTab === tab && styles.tabTextActive]}>{tab}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      <FlatList
        data={MOCK_TRENDING}
        renderItem={renderTrendingItem}
        keyExtractor={(item) => item.id}
        numColumns={2}
        columnWrapperStyle={styles.gridRow}
        contentContainerStyle={styles.gridContent}
        showsVerticalScrollIndicator={false}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: tokens.colors.bg,
  },
  searchContainer: {
    paddingHorizontal: tokens.spacing.md,
    paddingVertical: tokens.spacing.sm,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: tokens.colors.elevated,
    borderRadius: tokens.radius.full,
    paddingHorizontal: tokens.spacing.md,
    height: 40,
  },
  searchIcon: {
    fontSize: 16,
    marginRight: tokens.spacing.sm,
  },
  searchInput: {
    flex: 1,
    color: tokens.colors.white,
    fontSize: tokens.typography.body.fontSize,
  },
  tabsContainer: {
    maxHeight: 44,
  },
  tabsContent: {
    paddingHorizontal: tokens.spacing.md,
    gap: tokens.spacing.sm,
  },
  tab: {
    paddingHorizontal: tokens.spacing.md,
    paddingVertical: tokens.spacing.sm,
    borderRadius: tokens.radius.full,
    backgroundColor: tokens.colors.elevated,
  },
  tabActive: {
    backgroundColor: tokens.colors.white,
  },
  tabText: {
    color: tokens.colors.text.secondary,
    fontSize: tokens.typography.body.fontSize,
    fontWeight: '500',
  },
  tabTextActive: {
    color: tokens.colors.black,
    fontWeight: '700',
  },
  gridRow: {
    gap: 2,
  },
  gridContent: {
    padding: 2,
    paddingTop: tokens.spacing.md,
    // The tab bar is absolutely positioned over the screen; keep the final row scrollable above it.
    paddingBottom: 96,
  },
  trendingItem: {
    flex: 1,
    aspectRatio: 3 / 4,
    margin: 1,
    borderRadius: tokens.radius.xs,
    overflow: 'hidden',
  },
  trendingThumbnail: {
    width: '100%',
    height: '100%',
  },
  trendingOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: tokens.spacing.sm,
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  trendingTitle: {
    color: tokens.colors.white,
    fontSize: tokens.typography.body.fontSize,
    fontWeight: '600',
  },
  trendingViews: {
    color: tokens.colors.text.secondary,
    fontSize: tokens.typography.caption.fontSize,
  },
});
