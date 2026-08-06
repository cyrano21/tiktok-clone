import React, { useCallback, useRef, useState } from 'react';
import { View, Text, StyleSheet, FlatList, TextInput, TouchableOpacity, KeyboardAvoidingView, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { tokens } from '@/theme/tokens';
import { useNavigation, useRouteParams } from '@/navigation/NavigationContext';

interface Message {
  id: string;
  text: string;
  isMine: boolean;
  timestamp: string;
}

const INITIAL_MESSAGES: Message[] = [
  { id: '1', text: 'Hey! Love your content 🔥', isMine: false, timestamp: '10:30 AM' },
  { id: '2', text: 'Thanks so much! Means a lot', isMine: true, timestamp: '10:31 AM' },
  { id: '3', text: 'Would you be down for a collab?', isMine: false, timestamp: '10:32 AM' },
  { id: '4', text: 'Absolutely! What did you have in mind?', isMine: true, timestamp: '10:33 AM' },
  { id: '5', text: 'Maybe a dance duet? Your style is amazing', isMine: false, timestamp: '10:35 AM' },
  { id: '6', text: "Let's do it! DM me the details 💃", isMine: true, timestamp: '10:36 AM' },
];

const AUTO_REPLIES = [
  'Haha love that 😄',
  'For sure!',
  'Sounds good to me 🙌',
  'Tell me more!',
  'On my way 🚀',
  'That is so cool',
];

function formatNow(): string {
  return new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

export const ChatScreen: React.FC = () => {
  const insets = useSafeAreaInsets();
  const nav = useNavigation();
  const params = useRouteParams<{ username?: string }>();
  const username = params.username ?? 'sarah_dance';
  const [message, setMessage] = useState('');
  const [messages, setMessages] = useState<Message[]>(INITIAL_MESSAGES);
  const listRef = useRef<FlatList<Message>>(null);
  const replyTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [attachment, setAttachment] = useState<string | null>(null);

  const scrollToEnd = useCallback(() => {
    requestAnimationFrame(() => listRef.current?.scrollToEnd({ animated: true }));
  }, []);

  const sendMessage = useCallback(() => {
    const text = message.trim();
    if (!text) return;

    const mine: Message = {
      id: `m-${Date.now()}`,
      text,
      isMine: true,
      timestamp: formatNow(),
    };
    setMessages((prev) => [...prev, mine]);
    setMessage('');
    scrollToEnd();

    // Simulated reply from the other user
    if (replyTimer.current) clearTimeout(replyTimer.current);
    replyTimer.current = setTimeout(() => {
      const reply: Message = {
        id: `r-${Date.now()}`,
        text: AUTO_REPLIES[Math.floor(Math.random() * AUTO_REPLIES.length)],
        isMine: false,
        timestamp: formatNow(),
      };
      setMessages((prev) => [...prev, reply]);
      scrollToEnd();
    }, 900);
  }, [message, scrollToEnd]);

  const renderMessage = ({ item }: { item: Message }) => (
    <View style={[styles.messageContainer, item.isMine && styles.myMessageContainer]}>
      <View style={[styles.messageBubble, item.isMine ? styles.myBubble : styles.theirBubble]}>
        <Text style={[styles.messageText, item.isMine && styles.myMessageText]}>{item.text}</Text>
      </View>
      <Text style={[styles.timestamp, item.isMine && styles.myTimestamp]}>{item.timestamp}</Text>
    </View>
  );

  return (
    <KeyboardAvoidingView
      style={[styles.container, { paddingTop: insets.top }]}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <View style={styles.header}>
        <TouchableOpacity onPress={() => nav.back()}>
          <Text style={styles.backIcon}>←</Text>
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={styles.headerUsername}>@{username}</Text>
          <Text style={styles.headerStatus}>Active now</Text>
        </View>
        <TouchableOpacity onPress={() => nav.push('call', { username })}>
          <Text style={styles.callIcon}>📞</Text>
        </TouchableOpacity>
      </View>

      <FlatList
        ref={listRef}
        data={messages}
        renderItem={renderMessage}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.messagesList}
        showsVerticalScrollIndicator={false}
        onContentSizeChange={scrollToEnd}
      />      <View style={[styles.inputContainer, { paddingBottom: insets.bottom || tokens.spacing.sm }]}>
        <TouchableOpacity style={styles.attachButton} onPress={() => setAttachment(attachment ? null : 'https://picsum.photos/seed/chat-attachment/200/200')}>
          <Text style={styles.attachIcon}>{attachment ? '✓' : '+'}</Text>
        </TouchableOpacity>
        <View style={styles.inputWrapper}>
          <TextInput
            style={styles.input}
            placeholder="Send a message..."
            placeholderTextColor={tokens.colors.text.tertiary}
            value={message}
            onChangeText={setMessage}
            onSubmitEditing={sendMessage}
            blurOnSubmit={false}
            returnKeyType="send"
            multiline
          />
        </View>
        <TouchableOpacity
          style={[styles.sendButton, message.trim().length > 0 && styles.sendButtonActive]}
          onPress={sendMessage}
          disabled={message.trim().length === 0}
        >
          <Text style={styles.sendIcon}>➤</Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: tokens.colors.bg,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: tokens.spacing.md,
    paddingVertical: tokens.spacing.sm,
    borderBottomWidth: 0.5,
    borderBottomColor: tokens.colors.surface,
  },
  backIcon: { color: tokens.colors.white, fontSize: 24 },
  headerCenter: { flex: 1, marginLeft: tokens.spacing.md },
  headerUsername: { color: tokens.colors.white, fontSize: tokens.typography.subhead.fontSize, fontWeight: '700' },
  headerStatus: { color: tokens.colors.semantic.success, fontSize: tokens.typography.caption.fontSize },
  callIcon: { fontSize: 22 },
  messagesList: {
    paddingHorizontal: tokens.spacing.md,
    paddingVertical: tokens.spacing.md,
    gap: tokens.spacing.sm,
  },
  messageContainer: {
    alignItems: 'flex-start',
    marginBottom: tokens.spacing.xs,
  },
  myMessageContainer: {
    alignItems: 'flex-end',
  },
  messageBubble: {
    maxWidth: '75%',
    paddingHorizontal: tokens.spacing.md,
    paddingVertical: tokens.spacing.sm,
    borderRadius: tokens.radius.lg,
  },
  myBubble: {
    backgroundColor: tokens.colors.brand.primary,
    borderBottomRightRadius: tokens.radius.xs,
  },
  theirBubble: {
    backgroundColor: tokens.colors.elevated,
    borderBottomLeftRadius: tokens.radius.xs,
  },
  messageText: {
    color: tokens.colors.white,
    fontSize: tokens.typography.body.fontSize,
    lineHeight: tokens.typography.body.lineHeight,
  },
  myMessageText: {
    color: tokens.colors.white,
  },
  timestamp: {
    color: tokens.colors.text.tertiary,
    fontSize: 10,
    marginTop: 2,
  },
  myTimestamp: {
    textAlign: 'right',
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: tokens.spacing.md,
    paddingTop: tokens.spacing.sm,
    borderTopWidth: 0.5,
    borderTopColor: tokens.colors.surface,
    gap: tokens.spacing.sm,
  },
  attachButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: tokens.colors.elevated,
    justifyContent: 'center',
    alignItems: 'center',
  },
  attachIcon: { color: tokens.colors.white, fontSize: 20 },
  inputWrapper: {
    flex: 1,
    backgroundColor: tokens.colors.elevated,
    borderRadius: tokens.radius.lg,
    paddingHorizontal: tokens.spacing.md,
    minHeight: 36,
    maxHeight: 100,
    justifyContent: 'center',
  },
  input: {
    color: tokens.colors.white,
    fontSize: tokens.typography.body.fontSize,
    paddingVertical: tokens.spacing.sm,
  },
  sendButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: tokens.colors.surface,
    justifyContent: 'center',
    alignItems: 'center',
  },
  sendButtonActive: {
    backgroundColor: tokens.colors.brand.primary,
  },
  sendIcon: { color: tokens.colors.white, fontSize: 16 },
});
