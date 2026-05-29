import React from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, Image } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { tokens } from '@/theme/tokens';
import { useNavigation } from '@/navigation/NavigationContext';

interface Conversation {
  id: string;
  username: string;
  avatarUrl: string;
  lastMessage: string;
  timestamp: string;
  unreadCount: number;
}

const MOCK_CONVERSATIONS: Conversation[] = [
  { id: '1', username: 'sarah_dance', avatarUrl: 'https://picsum.photos/50/50', lastMessage: 'That video was amazing! 🔥', timestamp: '2m', unreadCount: 2 },
  { id: '2', username: 'mike_comedy', avatarUrl: 'https://picsum.photos/50/51', lastMessage: 'Let\'s collab!', timestamp: '15m', unreadCount: 0 },
  { id: '3', username: 'foodie_chef', avatarUrl: 'https://picsum.photos/50/52', lastMessage: 'Thanks for the recipe tip', timestamp: '1h', unreadCount: 1 },
  { id: '4', username: 'travel_vlog', avatarUrl: 'https://picsum.photos/50/53', lastMessage: 'Where was that filmed?', timestamp: '3h', unreadCount: 0 },
  { id: '5', username: 'fitness_pro', avatarUrl: 'https://picsum.photos/50/54', lastMessage: 'Great workout routine!', timestamp: '1d', unreadCount: 0 },
];

export const InboxListScreen: React.FC = () => {
  const insets = useSafeAreaInsets();
  const nav = useNavigation();

  const renderConversation = ({ item }: { item: Conversation }) => (
    <TouchableOpacity style={styles.conversationItem} onPress={() => nav.push('inbox.chat', { conversationId: item.id, username: item.username })}>
      <Image source={{ uri: item.avatarUrl }} style={styles.avatar} />
      <View style={styles.conversationContent}>
        <View style={styles.conversationHeader}>
          <Text style={styles.username}>{item.username}</Text>
          <Text style={styles.timestamp}>{item.timestamp}</Text>
        </View>
        <View style={styles.messageRow}>
          <Text style={[styles.lastMessage, item.unreadCount > 0 && styles.unreadMessage]} numberOfLines={1}>
            {item.lastMessage}
          </Text>
          {item.unreadCount > 0 && (
            <View style={styles.unreadBadge}>
              <Text style={styles.unreadCount}>{item.unreadCount}</Text>
            </View>
          )}
        </View>
      </View>
    </TouchableOpacity>
  );

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Inbox</Text>
        <TouchableOpacity onPress={() => nav.push('explore.search')}>
          <Text style={styles.newMessageIcon}>✏️</Text>
        </TouchableOpacity>
      </View>

      <TouchableOpacity style={styles.activitySection} onPress={() => nav.push('inbox.activity')}>
        <View style={styles.activityIcon}>
          <Text style={styles.activityEmoji}>❤️</Text>
        </View>
        <View style={styles.activityContent}>
          <Text style={styles.activityTitle}>Activity</Text>
          <Text style={styles.activitySubtitle}>Likes, comments, and more</Text>
        </View>
        <Text style={styles.activityArrow}>›</Text>
      </TouchableOpacity>

      <View style={styles.messagesHeader}>
        <Text style={styles.messagesTitle}>Messages</Text>
      </View>

      <FlatList
        data={MOCK_CONVERSATIONS}
        renderItem={renderConversation}
        keyExtractor={(item) => item.id}
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
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: tokens.spacing.md,
    paddingVertical: tokens.spacing.md,
  },
  headerTitle: {
    color: tokens.colors.white,
    fontSize: tokens.typography.headline.fontSize,
    fontWeight: '700',
  },
  newMessageIcon: {
    fontSize: 22,
  },
  activitySection: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: tokens.spacing.md,
    paddingVertical: tokens.spacing.md,
    borderBottomWidth: 0.5,
    borderBottomColor: tokens.colors.surface,
  },
  activityIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: tokens.colors.brand.primary + '20',
    justifyContent: 'center',
    alignItems: 'center',
  },
  activityEmoji: { fontSize: 22 },
  activityContent: {
    flex: 1,
    marginLeft: tokens.spacing.md,
  },
  activityTitle: {
    color: tokens.colors.white,
    fontSize: tokens.typography.subhead.fontSize,
    fontWeight: '600',
  },
  activitySubtitle: {
    color: tokens.colors.text.secondary,
    fontSize: tokens.typography.body.fontSize,
  },
  activityArrow: {
    color: tokens.colors.text.secondary,
    fontSize: 24,
  },
  messagesHeader: {
    paddingHorizontal: tokens.spacing.md,
    paddingTop: tokens.spacing.md,
    paddingBottom: tokens.spacing.sm,
  },
  messagesTitle: {
    color: tokens.colors.white,
    fontSize: tokens.typography.subhead.fontSize,
    fontWeight: '600',
  },
  conversationItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: tokens.spacing.md,
    paddingVertical: tokens.spacing.sm,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
  },
  conversationContent: {
    flex: 1,
    marginLeft: tokens.spacing.md,
  },
  conversationHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  username: {
    color: tokens.colors.white,
    fontSize: tokens.typography.body.fontSize,
    fontWeight: '600',
  },
  timestamp: {
    color: tokens.colors.text.tertiary,
    fontSize: tokens.typography.caption.fontSize,
  },
  messageRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 2,
  },
  lastMessage: {
    flex: 1,
    color: tokens.colors.text.secondary,
    fontSize: tokens.typography.body.fontSize,
  },
  unreadMessage: {
    color: tokens.colors.white,
    fontWeight: '500',
  },
  unreadBadge: {
    backgroundColor: tokens.colors.brand.primary,
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 6,
  },
  unreadCount: {
    color: tokens.colors.white,
    fontSize: 11,
    fontWeight: '700',
  },
});
