import React, { useMemo, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Image, Dimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { tokens } from '@/theme/tokens';
import { useNavigation } from '@/navigation/NavigationContext';
import { useStudioStore, MediaPost } from '@/store/studioStore';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const COL = 3;
const CELL = (Math.min(SCREEN_WIDTH, 430) - tokens.spacing.md * 2 - (COL - 1) * 2) / COL;

function formatShort(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1).replace('.0', '')}M`;
  if (n >= 1000) return `${(n / 1000).toFixed(1).replace('.0', '')}k`;
  return String(Math.round(n));
}

type SortKey = 'recent' | 'views' | 'likes';

const SORTS: Array<{ id: SortKey; label: string }> = [
  { id: 'recent', label: 'Récentes' },
  { id: 'views', label: 'Plus vues' },
  { id: 'likes', label: 'Plus aimées' },
];

export const StudioContentScreen: React.FC = () => {
  const insets = useSafeAreaInsets();
  const nav = useNavigation();
  const posts = useStudioStore((s) => s.posts);
  const [sort, setSort] = useState<SortKey>('recent');
  const [filter, setFilter] = useState<'all' | 'product'>('all');

  const data = useMemo(() => {
    let list = filter === 'product' ? posts.filter((p) => p.productId) : posts;
    list = [...list];
    if (sort === 'views') list.sort((a, b) => b.metrics.views - a.metrics.views);
    else if (sort === 'likes') list.sort((a, b) => b.metrics.likes - a.metrics.likes);
    else list.sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt));
    return list;
  }, [posts, sort, filter]);

  const renderCell = (p: MediaPost) => (
    <TouchableOpacity key={p.id} style={styles.cell} onPress={() => nav.push('studio.post', { postId: p.id })}>
      <Image source={{ uri: p.thumbnailUrl }} style={styles.cellImg} />
      {p.productId && (
        <View style={styles.shopTag}><Text style={styles.shopTagText}>🛍️</Text></View>
      )}
      <View style={styles.cellStats}>
        <Text style={styles.cellViews}>▶ {formatShort(p.metrics.views)}</Text>
      </View>
    </TouchableOpacity>
  );

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => nav.back()} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <Text style={styles.backIcon}>←</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Mon contenu</Text>
        <TouchableOpacity onPress={() => nav.push('studio.editor')}>
          <Text style={styles.addIcon}>＋</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.controls}>
        <View style={styles.sortRow}>
          {SORTS.map((s) => (
            <TouchableOpacity
              key={s.id}
              style={[styles.sortChip, sort === s.id && styles.sortChipActive]}
              onPress={() => setSort(s.id)}
            >
              <Text style={[styles.sortText, sort === s.id && styles.sortTextActive]}>{s.label}</Text>
            </TouchableOpacity>
          ))}
        </View>
        <TouchableOpacity
          style={[styles.filterToggle, filter === 'product' && styles.filterToggleActive]}
          onPress={() => setFilter((f) => (f === 'all' ? 'product' : 'all'))}
        >
          <Text style={[styles.filterToggleText, filter === 'product' && styles.filterToggleTextActive]}>
            🛍️ Vidéos produit
          </Text>
        </TouchableOpacity>
      </View>

      {data.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyEmoji}>🎬</Text>
          <Text style={styles.emptyText}>Aucune publication ici.</Text>
          <TouchableOpacity style={styles.createBtn} onPress={() => nav.push('studio.editor')}>
            <Text style={styles.createBtnText}>Créer une vidéo</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.grid}>
          <View style={styles.gridInner}>{data.map(renderCell)}</View>
        </ScrollView>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: tokens.colors.bg },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: tokens.spacing.md,
    paddingVertical: tokens.spacing.sm,
    borderBottomWidth: 0.5,
    borderBottomColor: tokens.colors.surface,
  },
  backIcon: { color: tokens.colors.white, fontSize: 24, width: 28 },
  headerTitle: { color: tokens.colors.white, fontSize: tokens.typography.title.fontSize, fontWeight: '700' },
  addIcon: { color: tokens.colors.white, fontSize: 26, width: 28, textAlign: 'right' },
  controls: { paddingHorizontal: tokens.spacing.md, paddingVertical: tokens.spacing.sm, gap: tokens.spacing.sm },
  sortRow: { flexDirection: 'row', gap: tokens.spacing.sm },
  sortChip: { paddingHorizontal: tokens.spacing.md, paddingVertical: 6, borderRadius: tokens.radius.full, backgroundColor: tokens.colors.elevated },
  sortChipActive: { backgroundColor: tokens.colors.white },
  sortText: { color: tokens.colors.text.secondary, fontSize: tokens.typography.body.fontSize, fontWeight: '500' },
  sortTextActive: { color: tokens.colors.black, fontWeight: '700' },
  filterToggle: { alignSelf: 'flex-start', paddingHorizontal: tokens.spacing.md, paddingVertical: 6, borderRadius: tokens.radius.full, borderWidth: 1, borderColor: tokens.colors.surface },
  filterToggleActive: { borderColor: tokens.colors.brand.primary, backgroundColor: tokens.colors.brand.primary + '1A' },
  filterToggleText: { color: tokens.colors.text.secondary, fontSize: tokens.typography.caption.fontSize, fontWeight: '600' },
  filterToggleTextActive: { color: tokens.colors.brand.primary },
  grid: { padding: tokens.spacing.md },
  gridInner: { flexDirection: 'row', flexWrap: 'wrap', gap: 2 },
  cell: { width: CELL, aspectRatio: 9 / 16, backgroundColor: tokens.colors.surface, borderRadius: tokens.radius.xs, overflow: 'hidden', justifyContent: 'flex-end' },
  cellImg: { ...StyleSheet.absoluteFillObject, width: '100%', height: '100%' },
  shopTag: { position: 'absolute', top: 4, left: 4, backgroundColor: 'rgba(0,0,0,0.55)', borderRadius: tokens.radius.xs, paddingHorizontal: 4, paddingVertical: 2 },
  shopTagText: { fontSize: 10 },
  cellStats: { padding: 4, backgroundColor: 'rgba(0,0,0,0.35)' },
  cellViews: { color: tokens.colors.white, fontSize: tokens.typography.caption.fontSize, fontWeight: '700' },
  empty: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: tokens.spacing.sm },
  emptyEmoji: { fontSize: 48 },
  emptyText: { color: tokens.colors.text.secondary, fontSize: tokens.typography.body.fontSize },
  createBtn: { marginTop: tokens.spacing.md, backgroundColor: tokens.colors.brand.primary, borderRadius: tokens.radius.sm, paddingHorizontal: tokens.spacing.xl, paddingVertical: tokens.spacing.md },
  createBtnText: { color: tokens.colors.white, fontSize: tokens.typography.body.fontSize, fontWeight: '700' },
});
