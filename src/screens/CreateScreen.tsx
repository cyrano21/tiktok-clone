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
  // Camera et Duet passent par le vrai éditeur média (upload/enregistrement) :
  // il n'existe pas de fausse caméra ni de faux parcours d'édition sur main.
  { id: 'camera', icon: '📷', label: 'Camera', color: tokens.colors.brand.secondary, route: 'studio.editor' },
  { id: 'upload', icon: '📁', label: 'Upload', color: tokens.colors.semantic.success, route: 'studio.editor' },
  { id: 'live', icon: '📡', label: 'LIVE', color: tokens.colors.semantic.live, route: 'live.broadcast' },
  { id: 'shop', icon: '🛍️', label: 'Ma boutique', color: tokens.colors.action.tip, route: 'shop.dashboard' },
  { id: 'duet', icon: '👥', label: 'Duet', color: tokens.colors.text.link, route: 'studio.editor' },
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
          <Text style={styles.draftsCount}>0</Text>
        </View>
        <View style={styles.draftsEmpty}>
          <Text style={styles.draftsEmptyText}>Aucun brouillon pour l’instant.</Text>
          <Text style={styles.draftsEmptyHint}>Tes vidéos en préparation apparaîtront ici. Crée et publie depuis le Studio.</Text>
        </View>
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
  draftsEmpty: {
    backgroundColor: tokens.colors.elevated,
    borderRadius: tokens.radius.md,
    padding: tokens.spacing.lg,
    gap: tokens.spacing.xs,
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
});
