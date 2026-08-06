import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, Image, ScrollView, RefreshControl } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { tokens } from '@/theme/tokens';
import { useNavigation } from '@/navigation/NavigationContext';
import { notificationService, NotificationItem } from '@/services/notificationService';

type ActivityType = 'like' | 'comment' | 'follow' | 'mention';

const EMPTY_ACTIVITIES: NotificationItem[] = [];

const FILTERS: { id: ActivityType | 'all'; label: string }[] = [
  { id: 'all', label: 'Tout' },
  { id: 'like', label: 'J\'aime' },
  { id: 'comment', label: 'Commentaires' },
  { id: 'mention', label: 'Mentions' },
  { id: 'follow', label: 'Abonnés' },
];

const TYPE_ICON: Record<ActivityType, string> = {
  like: '❤️',
  comment: '💬',
  follow: '👤',
  mention: '@',
};

export const ActivityScreen: React.FC = () => {
  const insets = useSafeAreaInsets();
  const nav = useNavigation();
  const [filter, setFilter] = useState<ActivityType | 'all'>('all');
  const [activities, setActivities] = useState<NotificationItem[]>(EMPTY_ACTIVITIES);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const items = await notificationService.getNotifications(30);
      setActivities(items);
      await notificationService.markAllAsRead();
    } catch {
      setActivities(EMPTY_ACTIVITIES);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    load();
  }, [load]);

  const data = useMemo(
    () => (filter === 'all' ? activities : activities.filter((a) => a.type === filter)),
    [filter, activities]
  );

  const renderItem = ({ item }: { item: NotificationItem }) => (
    <View style={styles.item}>
      <View style={styles.avatarWrap}>
        <Image source={{ uri: item.avatarUrl }} style={styles.avatar} />
        <View style={styles.typeBadge}>
          <Text style={styles.typeBadgeText}>{TYPE_ICON[item.type]}</Text>
        </View>
      </View>

      <View style={styles.itemBody}>
        <Text style={styles.itemText} numberOfLines={2}>
          <Text style={styles.itemUser}>@{item.username}</Text> {item.text}
        </Text>
        <Text style={styles.itemTime}>{item.timestamp}</Text>
      </View>

      {item.thumbnailUrl ? (
        <Image source={{ uri: item.thumbnailUrl }} style={styles.thumb} />
      ) : null}
    </View>
  );

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => nav.back()} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <Text style={styles.backIcon}>←</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Activité</Text>
        <View style={styles.placeholder} />
      </View>

      <View style={styles.filtersWrap}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filtersContent}>
          {FILTERS.map((f) => (
            <TouchableOpacity
              key={f.id}
              style={[styles.filterChip, filter === f.id && styles.filterChipActive]}
              onPress={() => setFilter(f.id)}
            >
              <Text style={[styles.filterText, filter === f.id && styles.filterTextActive]}>{f.label}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      <FlatList
        data={data}
        renderItem={renderItem}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={tokens.colors.white} />
        }
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyEmoji}>🔔</Text>
            <Text style={styles.emptyText}>
              {loading ? 'Chargement…' : 'Aucune activité ici pour le moment'}
            </Text>
          </View>
        }
      />
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
  placeholder: { width: 28 },
  filtersWrap: { borderBottomWidth: 0.5, borderBottomColor: tokens.colors.surface },
  filtersContent: { paddingHorizontal: tokens.spacing.md, paddingVertical: tokens.spacing.sm, gap: tokens.spacing.sm },
  filterChip: {
    paddingHorizontal: tokens.spacing.md,
    paddingVertical: 6,
    borderRadius: tokens.radius.full,
    backgroundColor: tokens.colors.elevated,
  },
  filterChipActive: { backgroundColor: tokens.colors.white },
  filterText: { color: tokens.colors.text.secondary, fontSize: tokens.typography.body.fontSize, fontWeight: '500' },
  filterTextActive: { color: tokens.colors.black, fontWeight: '700' },
  list: { paddingVertical: tokens.spacing.sm },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: tokens.spacing.md,
    paddingVertical: tokens.spacing.sm,
    gap: tokens.spacing.md,
  },
  avatarWrap: { position: 'relative' },
  avatar: { width: 48, height: 48, borderRadius: 24, backgroundColor: tokens.colors.elevated },
  typeBadge: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: tokens.colors.brand.primary,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: tokens.colors.bg,
  },
  typeBadgeText: { fontSize: 9, color: tokens.colors.white },
  itemBody: { flex: 1 },
  itemText: { color: tokens.colors.white, fontSize: tokens.typography.body.fontSize, lineHeight: 18 },
  itemUser: { fontWeight: '700' },
  itemTime: { color: tokens.colors.text.tertiary, fontSize: tokens.typography.caption.fontSize, marginTop: 2 },
  thumb: { width: 44, height: 56, borderRadius: tokens.radius.xs, backgroundColor: tokens.colors.elevated },
  followBtn: {
    paddingHorizontal: tokens.spacing.md,
    paddingVertical: 7,
    borderRadius: tokens.radius.sm,
    backgroundColor: tokens.colors.brand.primary,
  },
  followingBtn: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: tokens.colors.surface,
  },
  followBtnText: { color: tokens.colors.white, fontSize: tokens.typography.body.fontSize, fontWeight: '700' },
  followingBtnText: { color: tokens.colors.text.secondary },
  empty: { alignItems: 'center', paddingTop: 80, gap: tokens.spacing.md },
  emptyEmoji: { fontSize: 44 },
  emptyText: { color: tokens.colors.text.secondary, fontSize: tokens.typography.body.fontSize },
});
