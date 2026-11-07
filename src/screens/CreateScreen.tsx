import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, FlatList, Image } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { tokens } from '@/theme/tokens';
import { useNavigation, RouteName } from '@/navigation/NavigationContext';
import { useStudioStore, MediaPost } from '@/store/studioStore';

interface CreateOption {
  id: string;
  icon: string;
  label: string;
  color: string;
  route: RouteName;
}

const CREATE_OPTIONS: CreateOption[] = [
  { id: 'studio', icon: '🎬', label: 'Studio Hub', color: tokens.colors.brand.primary, route: 'studio' },
  { id: 'camera', icon: '📷', label: 'Caméra', color: tokens.colors.brand.secondary, route: 'create.record' },
  { id: 'upload', icon: '📁', label: 'Importer', color: tokens.colors.semantic.success, route: 'studio.editor' },
  { id: 'live', icon: '📡', label: 'LIVE', color: tokens.colors.semantic.live, route: 'live.broadcast' },
  { id: 'shop', icon: '🛍️', label: 'Ma boutique', color: tokens.colors.action.tip, route: 'shop.dashboard' },
  { id: 'duet', icon: '👥', label: 'Duet', color: tokens.colors.text.link, route: 'feed.foryou' },
];

export const CreateScreen: React.FC = () => {
  const insets = useSafeAreaInsets();
  const nav = useNavigation();
  const posts = useStudioStore((s) => s.posts);

  const renderOption = ({ item }: { item: CreateOption }) => (
    <TouchableOpacity style={styles.optionItem} onPress={() => nav.push(item.route)}>
      <View style={[styles.optionIcon, { backgroundColor: item.color + '20' }]}>
        <Text style={styles.optionEmoji}>{item.icon}</Text>
      </View>
      <Text style={styles.optionLabel}>{item.label}</Text>
    </TouchableOpacity>
  );

  const renderDraftItem = ({ item }: { item: MediaPost }) => (
    <TouchableOpacity style={styles.draftCard} onPress={() => nav.push('studio.editor')}>
      {item.thumbnailUrl ? (
        <Image source={{ uri: item.thumbnailUrl }} style={styles.draftThumb} />
      ) : (
        <View style={styles.draftThumbPlaceholder}>
          <Text style={styles.draftThumbIcon}>{item.type === 'video' ? '🎬' : '📷'}</Text>
        </View>
      )}
      <View style={styles.draftMeta}>
        <Text style={styles.draftTitle} numberOfLines={1}>{item.caption || 'Sans titre'}</Text>
        <Text style={styles.draftSub}>
          {item.type === 'video' ? 'Vidéo' : 'Photo'} · {new Date(item.createdAt).toLocaleDateString('fr-FR')}
        </Text>
      </View>
      <Text style={styles.draftArrow}>→</Text>
    </TouchableOpacity>
  );

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Création</Text>
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
          <Text style={styles.draftsTitle}>Brouillons & Vidéos</Text>
          <Text style={styles.draftsCount}>{posts.length}</Text>
        </View>

        {posts.length > 0 ? (
          <FlatList
            data={posts}
            renderItem={renderDraftItem}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.draftsContent}
          />
        ) : (
          <View style={styles.draftsEmpty}>
            <Text style={styles.draftsEmptyText}>Aucun brouillon pour l’instant.</Text>
            <Text style={styles.draftsEmptyHint}>
              Tes vidéos en préparation et publications apparaîtront ici. Crée et publie depuis le Studio.
            </Text>
            <TouchableOpacity style={styles.createDraftBtn} onPress={() => nav.push('studio.editor')}>
              <Text style={styles.createDraftBtnText}>+ Créer une nouvelle vidéo</Text>
            </TouchableOpacity>
          </View>
        )}
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
    marginTop: tokens.spacing.xl,
    paddingHorizontal: tokens.spacing.md,
    flex: 1,
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
    color: tokens.colors.brand.secondary,
    fontSize: tokens.typography.body.fontSize,
    fontWeight: '700',
  },
  draftsContent: {
    gap: tokens.spacing.sm,
  },
  draftCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: tokens.colors.elevated,
    borderRadius: tokens.radius.sm,
    padding: tokens.spacing.sm,
    gap: tokens.spacing.sm,
    borderWidth: 1,
    borderColor: tokens.colors.surface,
  },
  draftThumb: {
    width: 48,
    height: 48,
    borderRadius: tokens.radius.xs,
    backgroundColor: tokens.colors.black,
  },
  draftThumbPlaceholder: {
    width: 48,
    height: 48,
    borderRadius: tokens.radius.xs,
    backgroundColor: '#1E1E2C',
    justifyContent: 'center',
    alignItems: 'center',
  },
  draftThumbIcon: {
    fontSize: 20,
  },
  draftMeta: {
    flex: 1,
    gap: 2,
  },
  draftTitle: {
    color: tokens.colors.white,
    fontSize: tokens.typography.body.fontSize,
    fontWeight: '700',
  },
  draftSub: {
    color: tokens.colors.text.secondary,
    fontSize: tokens.typography.caption.fontSize,
  },
  draftArrow: {
    color: tokens.colors.text.tertiary,
    fontSize: 18,
    paddingRight: tokens.spacing.xs,
  },
  draftsEmpty: {
    backgroundColor: tokens.colors.elevated,
    borderRadius: tokens.radius.md,
    padding: tokens.spacing.lg,
    gap: tokens.spacing.sm,
  },
  draftsEmptyText: {
    color: tokens.colors.white,
    fontSize: tokens.typography.body.fontSize,
    fontWeight: '700',
  },
  draftsEmptyHint: {
    color: tokens.colors.text.secondary,
    fontSize: tokens.typography.caption.fontSize,
    lineHeight: 17,
  },
  createDraftBtn: {
    marginTop: tokens.spacing.sm,
    backgroundColor: tokens.colors.brand.primary,
    borderRadius: tokens.radius.sm,
    paddingVertical: 10,
    alignItems: 'center',
  },
  createDraftBtnText: {
    color: tokens.colors.white,
    fontSize: tokens.typography.caption.fontSize,
    fontWeight: '700',
  },
});
