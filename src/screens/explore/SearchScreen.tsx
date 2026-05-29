import React, { useState } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, FlatList, ScrollView } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { tokens } from '@/theme/tokens';
import { useNavigation } from '@/navigation/NavigationContext';

interface SearchCategory {
  id: string;
  icon: string;
  label: string;
}

const CATEGORIES: SearchCategory[] = [
  { id: 'users', icon: '👤', label: 'Users' },
  { id: 'videos', icon: '🎬', label: 'Videos' },
  { id: 'sounds', icon: '🎵', label: 'Sounds' },
  { id: 'hashtags', icon: '#', label: 'Hashtags' },
  { id: 'live', icon: '📡', label: 'LIVE' },
];

const RECENT_SEARCHES = ['dance challenge', 'cooking tips', 'funny cats', 'workout routine'];

export const SearchScreen: React.FC = () => {
  const insets = useSafeAreaInsets();
  const nav = useNavigation();
  const [query, setQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState('users');

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.searchHeader}>
        <TouchableOpacity onPress={() => nav.back()}>
          <Text style={styles.backIcon}>←</Text>
        </TouchableOpacity>
        <View style={styles.searchBar}>
          <Text style={styles.searchIcon}>🔍</Text>
          <TextInput
            style={styles.searchInput}
            placeholder="Search"
            placeholderTextColor={tokens.colors.text.tertiary}
            value={query}
            onChangeText={setQuery}
            autoFocus
          />
          {query.length > 0 && (
            <TouchableOpacity onPress={() => setQuery('')}>
              <Text style={styles.clearIcon}>✕</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.categoriesContainer}
        contentContainerStyle={styles.categoriesContent}
      >
        {CATEGORIES.map((cat) => (
          <TouchableOpacity
            key={cat.id}
            style={[styles.categoryChip, activeCategory === cat.id && styles.categoryChipActive]}
            onPress={() => {
              setActiveCategory(cat.id);
              if (cat.id === 'sounds') nav.push('explore.sound');
              else if (cat.id === 'live') nav.push('live');
              else if (cat.id === 'hashtags') nav.push('explore.hashtag', { tag: query || 'fyp' });
            }}
          >
            <Text style={styles.categoryIcon}>{cat.icon}</Text>
            <Text style={[styles.categoryLabel, activeCategory === cat.id && styles.categoryLabelActive]}>
              {cat.label}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {query.length === 0 && (
        <View style={styles.recentSection}>
          <View style={styles.recentHeader}>
            <Text style={styles.recentTitle}>Recent searches</Text>
            <TouchableOpacity>
              <Text style={styles.clearAll}>Clear all</Text>
            </TouchableOpacity>
          </View>
          {RECENT_SEARCHES.map((search, index) => (
            <TouchableOpacity key={index} style={styles.recentItem} onPress={() => nav.push('explore.hashtag', { tag: search })}>
              <Text style={styles.recentIcon}>🕐</Text>
              <Text style={styles.recentText}>{search}</Text>
              <TouchableOpacity>
                <Text style={styles.removeIcon}>✕</Text>
              </TouchableOpacity>
            </TouchableOpacity>
          ))}
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: tokens.colors.bg,
  },
  searchHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: tokens.spacing.md,
    paddingVertical: tokens.spacing.sm,
    gap: tokens.spacing.sm,
  },
  backIcon: {
    color: tokens.colors.white,
    fontSize: 24,
  },
  searchBar: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: tokens.colors.elevated,
    borderRadius: tokens.radius.sm,
    paddingHorizontal: tokens.spacing.md,
    height: 40,
  },
  searchIcon: {
    fontSize: 14,
    marginRight: tokens.spacing.sm,
  },
  searchInput: {
    flex: 1,
    color: tokens.colors.white,
    fontSize: tokens.typography.body.fontSize,
  },
  clearIcon: {
    color: tokens.colors.text.secondary,
    fontSize: 16,
  },
  categoriesContainer: {
    maxHeight: 44,
    borderBottomWidth: 0.5,
    borderBottomColor: tokens.colors.surface,
  },
  categoriesContent: {
    paddingHorizontal: tokens.spacing.md,
    gap: tokens.spacing.sm,
    alignItems: 'center',
  },
  categoryChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: tokens.spacing.md,
    paddingVertical: tokens.spacing.xs,
    borderRadius: tokens.radius.full,
    gap: tokens.spacing.xs,
  },
  categoryChipActive: {
    backgroundColor: tokens.colors.elevated,
  },
  categoryIcon: {
    fontSize: 14,
  },
  categoryLabel: {
    color: tokens.colors.text.secondary,
    fontSize: tokens.typography.body.fontSize,
  },
  categoryLabelActive: {
    color: tokens.colors.white,
    fontWeight: '600',
  },
  recentSection: {
    paddingHorizontal: tokens.spacing.md,
    paddingTop: tokens.spacing.md,
  },
  recentHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: tokens.spacing.md,
  },
  recentTitle: {
    color: tokens.colors.white,
    fontSize: tokens.typography.subhead.fontSize,
    fontWeight: '600',
  },
  clearAll: {
    color: tokens.colors.text.secondary,
    fontSize: tokens.typography.body.fontSize,
  },
  recentItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: tokens.spacing.sm,
    gap: tokens.spacing.sm,
  },
  recentIcon: {
    fontSize: 16,
  },
  recentText: {
    flex: 1,
    color: tokens.colors.white,
    fontSize: tokens.typography.body.fontSize,
  },
  removeIcon: {
    color: tokens.colors.text.tertiary,
    fontSize: 14,
  },
});
