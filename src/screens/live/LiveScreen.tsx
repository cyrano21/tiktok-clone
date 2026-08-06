import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, FlatList, TextInput, Image } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { tokens } from '@/theme/tokens';
import { useNavigation } from '@/navigation/NavigationContext';
import { shareText } from '@/services/share';

interface ChatMessage {
  id: string;
  username: string;
  text: string;
  isGift?: boolean;
  giftEmoji?: string;
}

const MOCK_CHAT: ChatMessage[] = [
  { id: '1', username: 'viewer1', text: 'Amazing stream! 🔥' },
  { id: '2', username: 'fan_girl', text: 'Love this content' },
  { id: '3', username: 'supporter', text: '', isGift: true, giftEmoji: '🌹' },
  { id: '4', username: 'new_viewer', text: 'Just joined!' },
  { id: '5', username: 'regular', text: 'Can you do a shoutout?' },
];

const GIFTS = ['🌹', '💎', '🎁', '🦁', '🚀', '👑', '💰', '🎉'];

export const LiveScreen: React.FC = () => {
  const insets = useSafeAreaInsets();
  const nav = useNavigation();
  const [message, setMessage] = useState('');
  const [showGifts, setShowGifts] = useState(false);

  const renderChatMessage = ({ item }: { item: ChatMessage }) => (
    <View style={styles.chatMessage}>
      {item.isGift ? (
        <Text style={styles.giftMessage}>
          <Text style={styles.chatUsername}>{item.username}</Text> sent {item.giftEmoji}
        </Text>
      ) : (
        <Text style={styles.chatText}>
          <Text style={styles.chatUsername}>{item.username}</Text> {item.text}
        </Text>
      )}
    </View>
  );

  return (
    <View style={[styles.container, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
      <View style={styles.videoBackground}>
        <Text style={styles.videoPlaceholder}>📡 LIVE</Text>
      </View>

      <View style={styles.topBar}>
        <View style={styles.hostInfo}>
          <Image source={{ uri: 'https://picsum.photos/40/40' }} style={styles.hostAvatar} />
          <View>
            <Text style={styles.hostName}>@streamer</Text>
            <View style={styles.liveBadge}>
              <Text style={styles.liveBadgeText}>LIVE</Text>
            </View>
          </View>
        </View>
        <View style={styles.topRight}>
          <View style={styles.viewerCount}>
            <Text style={styles.viewerIcon}>👁</Text>
            <Text style={styles.viewerText}>12.4K</Text>
          </View>
          <TouchableOpacity style={styles.closeButton} onPress={() => nav.back()}>
            <Text style={styles.closeIcon}>✕</Text>
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.chatContainer}>
        <FlatList
          data={MOCK_CHAT}
          renderItem={renderChatMessage}
          keyExtractor={(item) => item.id}
          showsVerticalScrollIndicator={false}
          inverted
        />
      </View>

      {showGifts && (
        <View style={styles.giftsPanel}>
          <View style={styles.giftsGrid}>
            {GIFTS.map((gift, index) => (
              <TouchableOpacity key={index} style={styles.giftItem} onPress={() => setShowGifts(false)}>
                <Text style={styles.giftEmoji}>{gift}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      )}

      <View style={styles.bottomBar}>
        <View style={styles.inputRow}>
          <TextInput
            style={styles.chatInput}
            placeholder="Say something..."
            placeholderTextColor={tokens.colors.text.tertiary}
            value={message}
            onChangeText={setMessage}
          />
          <TouchableOpacity style={styles.giftButton} onPress={() => setShowGifts(!showGifts)}>
            <Text style={styles.giftButtonIcon}>🎁</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.shareButton} onPress={() => shareText('Regarde ce LIVE sur TikTok Clone')}>
            <Text style={styles.shareButtonIcon}>↗</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: tokens.colors.black },
  videoBackground: { ...StyleSheet.absoluteFillObject, justifyContent: 'center', alignItems: 'center', backgroundColor: tokens.colors.elevated },
  videoPlaceholder: { color: tokens.colors.semantic.live, fontSize: tokens.typography.headline.fontSize, fontWeight: '700' },
  topBar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: tokens.spacing.md, paddingTop: tokens.spacing.sm, zIndex: 10 },
  hostInfo: { flexDirection: 'row', alignItems: 'center', gap: tokens.spacing.sm, backgroundColor: 'rgba(0,0,0,0.5)', borderRadius: tokens.radius.full, paddingRight: tokens.spacing.md, paddingVertical: 4 },
  hostAvatar: { width: 36, height: 36, borderRadius: 18 },
  hostName: { color: tokens.colors.white, fontSize: tokens.typography.body.fontSize, fontWeight: '600' },
  liveBadge: { backgroundColor: tokens.colors.semantic.live, borderRadius: 4, paddingHorizontal: 6, paddingVertical: 1, alignSelf: 'flex-start' },
  liveBadgeText: { color: tokens.colors.white, fontSize: 10, fontWeight: '700' },
  topRight: { flexDirection: 'row', alignItems: 'center', gap: tokens.spacing.sm },
  viewerCount: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: 'rgba(0,0,0,0.5)', borderRadius: tokens.radius.full, paddingHorizontal: tokens.spacing.sm, paddingVertical: 4 },
  viewerIcon: { fontSize: 14 },
  viewerText: { color: tokens.colors.white, fontSize: tokens.typography.caption.fontSize, fontWeight: '600' },
  closeButton: { width: 32, height: 32, borderRadius: 16, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center' },
  closeIcon: { color: tokens.colors.white, fontSize: 16 },
  chatContainer: { position: 'absolute', bottom: 80, left: tokens.spacing.md, right: 100, maxHeight: 250, zIndex: 10 },
  chatMessage: { marginBottom: tokens.spacing.xs },
  chatText: { color: tokens.colors.white, fontSize: tokens.typography.body.fontSize },
  chatUsername: { fontWeight: '700', color: tokens.colors.brand.secondary },
  giftMessage: { color: tokens.colors.action.tip, fontSize: tokens.typography.body.fontSize },
  giftsPanel: { position: 'absolute', bottom: 80, left: 0, right: 0, backgroundColor: 'rgba(0,0,0,0.8)', padding: tokens.spacing.md, zIndex: 20 },
  giftsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: tokens.spacing.md, justifyContent: 'center' },
  giftItem: { width: 48, height: 48, borderRadius: 24, backgroundColor: tokens.colors.elevated, justifyContent: 'center', alignItems: 'center' },
  giftEmoji: { fontSize: 24 },
  bottomBar: { position: 'absolute', bottom: 0, left: 0, right: 0, paddingHorizontal: tokens.spacing.md, paddingBottom: tokens.spacing.md, zIndex: 10 },
  inputRow: { flexDirection: 'row', alignItems: 'center', gap: tokens.spacing.sm },
  chatInput: { flex: 1, backgroundColor: 'rgba(255,255,255,0.15)', borderRadius: tokens.radius.full, paddingHorizontal: tokens.spacing.md, height: 40, color: tokens.colors.white, fontSize: tokens.typography.body.fontSize },
  giftButton: { width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.15)', justifyContent: 'center', alignItems: 'center' },
  giftButtonIcon: { fontSize: 20 },
  shareButton: { width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.15)', justifyContent: 'center', alignItems: 'center' },
  shareButtonIcon: { color: tokens.colors.white, fontSize: 18 },
});
