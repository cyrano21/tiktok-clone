import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, Image, ActivityIndicator } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { tokens } from '@/theme/tokens';
import { useNavigation } from '@/navigation/NavigationContext';
import { useSessionStore } from '@/store/sessionStore';
import { messageService, type Conversation } from '@/services/messageService';

export const InboxListScreen: React.FC = () => {
  const insets = useSafeAreaInsets();
  const nav = useNavigation();
  const session = useSessionStore();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!session.authenticated) {
      setConversations([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      setConversations(await messageService.listConversations());
    } catch {
      setConversations([]);
      setError('Impossible de charger tes messages.');
    } finally {
      setLoading(false);
    }
  }, [session.authenticated]);

  useEffect(() => { void load(); }, [load]);

  const renderConversation = ({ item }: { item: Conversation }) => {
    const other = item.participant1Id === session.userId ? item.participant2 : item.participant1;
    const last = item.messages[0];
    const initial = (other.displayName || other.username || '?').charAt(0).toUpperCase();
    return (
      <TouchableOpacity style={styles.conversationItem} onPress={() => nav.push('inbox.chat', { conversationId: item.id, username: other.username })}>
        {other.avatarUrl ? (
          <Image source={{ uri: other.avatarUrl }} style={styles.avatar} />
        ) : (
          <View style={[styles.avatar, styles.avatarFallback]}><Text style={styles.avatarInitial}>{initial}</Text></View>
        )}
        <View style={styles.conversationContent}>
          <View style={styles.conversationHeader}>
            <Text style={styles.username}>{other.username}</Text>
            <Text style={styles.timestamp}>{last?.createdAt ? new Date(last.createdAt).toLocaleDateString() : ''}</Text>
          </View>
          <Text style={styles.lastMessage} numberOfLines={1}>{last?.content ?? 'Nouvelle conversation'}</Text>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Inbox</Text>
      </View>
      {!session.authenticated && <Text style={styles.stateText}>Connecte-toi pour accéder à tes messages.</Text>}
      {session.authenticated && loading && <View style={styles.state}><ActivityIndicator color={tokens.colors.brand.primary} /><Text style={styles.stateText}>Chargement des messages…</Text></View>}
      {session.authenticated && !loading && error && <View style={styles.state}><Text style={styles.stateText}>{error}</Text><TouchableOpacity onPress={() => void load()}><Text style={styles.retry}>Réessayer</Text></TouchableOpacity></View>}
      {session.authenticated && !loading && !error && conversations.length === 0 && <Text style={styles.stateText}>Aucune conversation pour le moment.</Text>}
      {session.authenticated && !loading && !error && conversations.length > 0 && <FlatList data={conversations} renderItem={renderConversation} keyExtractor={(item) => item.id} showsVerticalScrollIndicator={false} />}
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: tokens.colors.bg },
  header: { paddingHorizontal: tokens.spacing.md, paddingVertical: tokens.spacing.md },
  headerTitle: { color: tokens.colors.white, fontSize: tokens.typography.headline.fontSize, fontWeight: '700' },
  state: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: tokens.spacing.sm, padding: tokens.spacing.lg },
  stateText: { color: tokens.colors.text.secondary, textAlign: 'center', padding: tokens.spacing.lg },
  retry: { color: tokens.colors.brand.primary, fontWeight: '700', textAlign: 'center' },
  conversationItem: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: tokens.spacing.md, paddingVertical: tokens.spacing.sm },
  avatar: { width: 48, height: 48, borderRadius: 24 },
  avatarFallback: { backgroundColor: tokens.colors.brand.primary, alignItems: 'center', justifyContent: 'center' },
  avatarInitial: { color: tokens.colors.white, fontSize: 20, fontWeight: '700' },
  conversationContent: { flex: 1, marginLeft: tokens.spacing.md },
  conversationHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  username: { color: tokens.colors.white, fontSize: tokens.typography.body.fontSize, fontWeight: '600' },
  timestamp: { color: tokens.colors.text.tertiary, fontSize: tokens.typography.caption.fontSize },
  lastMessage: { color: tokens.colors.text.secondary, fontSize: tokens.typography.body.fontSize, marginTop: 2 },
});
