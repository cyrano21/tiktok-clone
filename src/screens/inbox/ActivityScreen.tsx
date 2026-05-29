import React, { useMemo, useState } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, Image, ScrollView } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { tokens } from '@/theme/tokens';
import { useNavigation } from '@/navigation/NavigationContext';

type ActivityType = 'like' | 'comment' | 'follow' | 'mention';

interface ActivityItem {
  id: string;
  type: ActivityType;
  username: string;
  avatarUrl: string;
  text: string;
  timestamp: string;
  thumbnailUrl?: string;
  isFollowing?: boolean;
}

const ACTIVITIES: ActivityItem[] = [
  { id: 'a1', type: 'like', username: 'leamartin', avatarUrl: 'https://i.pravatar.cc/100?img=47', text: 'a aimé votre vidéo', timestamp: '2m', thumbnailUrl: 'https://picsum.photos/seed/av1/100/140' },
  { id: 'a2', type: 'follow', username: 'thomas.k', avatarUrl: 'https://i.pravatar.cc/100?img=12', text: 'a commencé à vous suivre', timestamp: '8m', isFollowing: false },
  { id: 'a3', type: 'comment', username: 'studio.flow', avatarUrl: 'https://i.pravatar.cc/100?img=68', text: 'a commenté : "Incroyable 🔥"', timestamp: '23m', thumbnailUrl: 'https://picsum.photos/seed/av2/100/140' },
  { id: 'a4', type: 'mention', username: 'naelle_', avatarUrl: 'https://i.pravatar.cc/100?img=32', text: 'vous a mentionné dans un commentaire', timestamp: '1h', thumbnailUrl: 'https://picsum.photos/seed/av3/100/140' },
  { id: 'a5', type: 'like', username: 'maxence_off', avatarUrl: 'https://i.pravatar.cc/100?img=15', text: 'et 24 autres ont aimé votre vidéo', timestamp: '2h', thumbnailUrl: 'https://picsum.photos/seed/av4/100/140' },
  { id: 'a6', type: 'follow', username: 'la.cheffe', avatarUrl: 'https://i.pravatar.cc/100?img=45', text: 'a commencé à vous suivre', timestamp: '3h', isFollowing: true },
  { id: 'a7', type: 'comment', username: 'pierre.dance', avatarUrl: 'https://i.pravatar.cc/100?img=8', text: 'a répondu à votre commentaire', timestamp: '5h', thumbnailUrl: 'https://picsum.photos/seed/av5/100/140' },
  { id: 'a8', type: 'like', username: 'mia.sunset', avatarUrl: 'https://i.pravatar.cc/100?img=24', text: 'a aimé votre commentaire', timestamp: '8h', thumbnailUrl: 'https://picsum.photos/seed/av6/100/140' },
  { id: 'a9', type: 'mention', username: 'kev_skate', avatarUrl: 'https://i.pravatar.cc/100?img=11', text: 'vous a tagué dans une vidéo', timestamp: '1j', thumbnailUrl: 'https://picsum.photos/seed/av7/100/140' },
  { id: 'a10', type: 'follow', username: 'amelie_yoga', avatarUrl: 'https://i.pravatar.cc/100?img=49', text: 'a commencé à vous suivre', timestamp: '2j', isFollowing: false },
];

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
  const [following, setFollowing] = useState<Record<string, boolean>>(
    () => Object.fromEntries(ACTIVITIES.filter((a) => a.type === 'follow').map((a) => [a.id, !!a.isFollowing]))
  );

  const data = useMemo(
    () => (filter === 'all' ? ACTIVITIES : ACTIVITIES.filter((a) => a.type === filter)),
    [filter]
  );

  const toggleFollow = (id: string) =>
    setFollowing((prev) => ({ ...prev, [id]: !prev[id] }));

  const renderItem = ({ item }: { item: ActivityItem }) => (
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

      {item.type === 'follow' ? (
        <TouchableOpacity
          style={[styles.followBtn, following[item.id] && styles.followingBtn]}
          onPress={() => toggleFollow(item.id)}
        >
          <Text style={[styles.followBtnText, following[item.id] && styles.followingBtnText]}>
            {following[item.id] ? 'Abonné' : 'Suivre'}
          </Text>
        </TouchableOpacity>
      ) : item.thumbnailUrl ? (
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
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyEmoji}>🔔</Text>
            <Text style={styles.emptyText}>Aucune activité ici pour le moment</Text>
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
