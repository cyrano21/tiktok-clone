import React, { useCallback, useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, FlatList, TextInput, TouchableOpacity, KeyboardAvoidingView, Platform, ActivityIndicator } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { tokens } from '@/theme/tokens';
import { useNavigation, useRouteParams } from '@/navigation/NavigationContext';
import { messageService, type ConversationMessage } from '@/services/messageService';
import { useSessionStore } from '@/store/sessionStore';

export const ChatScreen: React.FC = () => {
  const insets = useSafeAreaInsets();
  const nav = useNavigation();
  const params = useRouteParams<{ conversationId?: string; username?: string }>();
  const session = useSessionStore();
  const [message, setMessage] = useState('');
  const [messages, setMessages] = useState<ConversationMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const listRef = useRef<FlatList<ConversationMessage>>(null);

  const load = useCallback(async () => {
    if (!params.conversationId || !session.authenticated) {
      setLoading(false);
      setError('Conversation indisponible.');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      setMessages(await messageService.listMessages(params.conversationId));
    } catch {
      setError('Impossible de charger cette conversation.');
    } finally {
      setLoading(false);
    }
  }, [params.conversationId, session.authenticated]);

  useEffect(() => { void load(); }, [load]);

  const sendMessage = useCallback(async () => {
    const text = message.trim();
    if (!text || !params.conversationId) return;
    setMessage('');
    try {
      const sent = await messageService.sendMessage(params.conversationId, text);
      setMessages((prev) => [...prev, sent]);
      requestAnimationFrame(() => listRef.current?.scrollToEnd({ animated: true }));
    } catch {
      setMessage(text);
      setError('Message non envoyé. Réessaie.');
    }
  }, [message, params.conversationId]);

  const renderMessage = ({ item }: { item: ConversationMessage }) => {
    const mine = item.senderId === session.userId;
    return (
      <View style={[styles.messageContainer, mine && styles.myMessageContainer]}>
        <View style={[styles.messageBubble, mine ? styles.myBubble : styles.theirBubble]}>
          <Text style={styles.messageText}>{item.content ?? ''}</Text>
        </View>
        <Text style={[styles.timestamp, mine && styles.myTimestamp]}>{new Date(item.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</Text>
      </View>
    );
  };

  return (
    <KeyboardAvoidingView style={[styles.container, { paddingTop: insets.top }]} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => nav.back()}><Text style={styles.backIcon}>←</Text></TouchableOpacity>
        <View style={styles.headerCenter}><Text style={styles.headerUsername}>@{params.username ?? 'conversation'}</Text></View>
        <View style={{ width: 28 }} />
      </View>
      {loading && <View style={styles.state}><ActivityIndicator color={tokens.colors.brand.primary} /><Text style={styles.stateText}>Chargement…</Text></View>}
      {!loading && error && <View style={styles.state}><Text style={styles.stateText}>{error}</Text><TouchableOpacity onPress={() => void load()}><Text style={styles.retry}>Réessayer</Text></TouchableOpacity></View>}
      {!loading && !error && <FlatList ref={listRef} data={messages} renderItem={renderMessage} keyExtractor={(item) => item.id} contentContainerStyle={styles.messagesList} showsVerticalScrollIndicator={false} onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: false })} />}
      <View style={[styles.inputContainer, { paddingBottom: insets.bottom || tokens.spacing.sm }]}>
        <TextInput style={styles.input} placeholder="Écrire un message…" placeholderTextColor={tokens.colors.text.tertiary} value={message} onChangeText={setMessage} onSubmitEditing={() => void sendMessage()} returnKeyType="send" />
        <TouchableOpacity style={[styles.sendButton, message.trim().length > 0 ? styles.sendButtonActive : null]} onPress={() => void sendMessage()} disabled={!message.trim()}><Text style={styles.sendIcon}>➤</Text></TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: tokens.colors.bg },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: tokens.spacing.md, paddingVertical: tokens.spacing.sm, borderBottomWidth: 0.5, borderBottomColor: tokens.colors.surface },
  backIcon: { color: tokens.colors.white, fontSize: 24 },
  headerCenter: { flex: 1, marginLeft: tokens.spacing.md },
  headerUsername: { color: tokens.colors.white, fontSize: tokens.typography.subhead.fontSize, fontWeight: '700' },
  state: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: tokens.spacing.sm },
  stateText: { color: tokens.colors.text.secondary, textAlign: 'center', padding: tokens.spacing.lg },
  retry: { color: tokens.colors.brand.primary, fontWeight: '700' },
  messagesList: { paddingHorizontal: tokens.spacing.md, paddingVertical: tokens.spacing.md, gap: tokens.spacing.sm },
  messageContainer: { alignItems: 'flex-start', marginBottom: tokens.spacing.xs },
  myMessageContainer: { alignItems: 'flex-end' },
  messageBubble: { maxWidth: '75%', paddingHorizontal: tokens.spacing.md, paddingVertical: tokens.spacing.sm, borderRadius: tokens.radius.lg },
  myBubble: { backgroundColor: tokens.colors.brand.primary, borderBottomRightRadius: tokens.radius.xs },
  theirBubble: { backgroundColor: tokens.colors.elevated, borderBottomLeftRadius: tokens.radius.xs },
  messageText: { color: tokens.colors.white, fontSize: tokens.typography.body.fontSize, lineHeight: tokens.typography.body.lineHeight },
  timestamp: { color: tokens.colors.text.tertiary, fontSize: 10, marginTop: 2 },
  myTimestamp: { textAlign: 'right' },
  inputContainer: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: tokens.spacing.md, paddingTop: tokens.spacing.sm, borderTopWidth: 0.5, borderTopColor: tokens.colors.surface, gap: tokens.spacing.sm },
  input: { flex: 1, color: tokens.colors.white, backgroundColor: tokens.colors.elevated, borderRadius: tokens.radius.lg, fontSize: tokens.typography.body.fontSize, paddingHorizontal: tokens.spacing.md, height: 40 },
  sendButton: { width: 36, height: 36, borderRadius: 18, backgroundColor: tokens.colors.surface, justifyContent: 'center', alignItems: 'center' },
  sendButtonActive: { backgroundColor: tokens.colors.brand.primary },
  sendIcon: { color: tokens.colors.white, fontSize: 16 },
});
