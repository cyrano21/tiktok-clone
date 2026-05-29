import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, FlatList } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { tokens } from '@/theme/tokens';
import { useNavigation, RouteName } from '@/navigation/NavigationContext';

interface CreateOption {
  id: string;
  icon: string;
  label: string;
  color: string;
  route: RouteName;
}

const CREATE_OPTIONS: CreateOption[] = [
  { id: 'studio', icon: '🎬', label: 'Studio', color: tokens.colors.brand.primary, route: 'studio.editor' },
  { id: 'camera', icon: '📷', label: 'Camera', color: tokens.colors.brand.secondary, route: 'create.record' },
  { id: 'upload', icon: '📁', label: 'Upload', color: tokens.colors.semantic.success, route: 'studio.editor' },
  { id: 'live', icon: '📡', label: 'LIVE', color: tokens.colors.semantic.live, route: 'live.broadcast' },
  { id: 'shop', icon: '🛍️', label: 'Ma boutique', color: tokens.colors.action.tip, route: 'shop.dashboard' },
  { id: 'duet', icon: '👥', label: 'Duet', color: tokens.colors.text.link, route: 'create.record' },
];

interface DraftItem {
  id: string;
  thumbnailUrl: string;
  duration: string;
}

const MOCK_DRAFTS: DraftItem[] = [
  { id: 'd1', thumbnailUrl: 'https://picsum.photos/100/150', duration: '0:15' },
  { id: 'd2', thumbnailUrl: 'https://picsum.photos/100/151', duration: '0:32' },
  { id: 'd3', thumbnailUrl: 'https://picsum.photos/100/152', duration: '1:05' },
];

export const CreateScreen: React.FC = () => {
  const insets = useSafeAreaInsets();
  const nav = useNavigation();

  const renderOption = ({ item }: { item: CreateOption }) => (
    <TouchableOpacity style={styles.optionItem} onPress={() => nav.push(item.route)}>
      <View style={[styles.optionIcon, { backgroundColor: item.color + '20' }]}>
        <Text style={styles.optionEmoji}>{item.icon}</Text>
      </View>
      <Text style={styles.optionLabel}>{item.label}</Text>
    </TouchableOpacity>
  );

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Create</Text>
      </View>

      <View style={styles.optionsGrid}>
        <FlatList
          data={CREATE_OPTIONS}
          renderItem={renderOption}
          keyExtractor={(item) => item.id}
          numColumns={3}
          scrollEnabled={false}
          contentContainerStyle={styles.optionsContent}
        />
      </View>

      <View style={styles.draftsSection}>
        <View style={styles.draftsSectionHeader}>
          <Text style={styles.draftsTitle}>Drafts</Text>
          <Text style={styles.draftsCount}>{MOCK_DRAFTS.length}</Text>
        </View>
        <FlatList
          data={MOCK_DRAFTS}
          horizontal
          showsHorizontalScrollIndicator={false}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.draftsContent}
          renderItem={({ item }) => (
            <TouchableOpacity style={styles.draftItem} onPress={() => nav.push('create.edit')}>
              <View style={styles.draftThumbnail}>
                <Text style={styles.draftPlaceholder}>📹</Text>
              </View>
              <Text style={styles.draftDuration}>{item.duration}</Text>
            </TouchableOpacity>
          )}
        />
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: tokens.colors.bg,
  },
  header: {
    paddingHorizontal: tokens.spacing.md,
    paddingVertical: tokens.spacing.md,
    alignItems: 'center',
  },
  headerTitle: {
    color: tokens.colors.white,
    fontSize: tokens.typography.headline.fontSize,
    fontWeight: '700',
  },
  optionsGrid: {
    paddingHorizontal: tokens.spacing.md,
    marginTop: tokens.spacing.lg,
  },
  optionsContent: {
    gap: tokens.spacing.md,
  },
  optionItem: {
    flex: 1,
    alignItems: 'center',
    gap: tokens.spacing.sm,
    padding: tokens.spacing.md,
  },
  optionIcon: {
    width: 64,
    height: 64,
    borderRadius: tokens.radius.lg,
    justifyContent: 'center',
    alignItems: 'center',
  },
  optionEmoji: {
    fontSize: 28,
  },
  optionLabel: {
    color: tokens.colors.white,
    fontSize: tokens.typography.caption.fontSize,
    fontWeight: '500',
  },
  draftsSection: {
    marginTop: tokens.spacing.xxl,
    paddingHorizontal: tokens.spacing.md,
  },
  draftsSectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.spacing.sm,
    marginBottom: tokens.spacing.md,
  },
  draftsTitle: {
    color: tokens.colors.white,
    fontSize: tokens.typography.title.fontSize,
    fontWeight: '700',
  },
  draftsCount: {
    color: tokens.colors.text.secondary,
    fontSize: tokens.typography.body.fontSize,
  },
  draftsContent: {
    gap: tokens.spacing.sm,
  },
  draftItem: {
    width: 100,
    height: 140,
    borderRadius: tokens.radius.sm,
    overflow: 'hidden',
    backgroundColor: tokens.colors.elevated,
  },
  draftThumbnail: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  draftPlaceholder: {
    fontSize: 32,
  },
  draftDuration: {
    color: tokens.colors.white,
    fontSize: tokens.typography.caption.fontSize,
    padding: tokens.spacing.xs,
    textAlign: 'center',
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
});
