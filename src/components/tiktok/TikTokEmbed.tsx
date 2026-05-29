import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Linking } from 'react-native';
import { tokens } from '@/theme/tokens';

export interface TikTokEmbedProps {
  /** Official TikTok embed URL (embed_link) returned by the Display API. */
  embedLink?: string;
  /** Public share URL fallback (share_url). */
  shareUrl?: string;
  /** Optional fixed height for the embed surface. */
  height?: number;
}

/**
 * Native fallback for the TikTok embed. React Native (non-web) cannot render an
 * iframe, so we surface a button that opens the official TikTok page. The web
 * build resolves `TikTokEmbed.web.tsx` instead, which embeds the real player.
 */
export const TikTokEmbed: React.FC<TikTokEmbedProps> = ({ shareUrl }) => {
  const open = () => {
    if (shareUrl) Linking.openURL(shareUrl).catch(() => {});
  };
  return (
    <View style={styles.fallback}>
      <Text style={styles.fallbackIcon}>▶</Text>
      <Text style={styles.fallbackText}>Lecture sur TikTok</Text>
      {shareUrl ? (
        <TouchableOpacity style={styles.fallbackBtn} onPress={open}>
          <Text style={styles.fallbackBtnText}>Ouvrir</Text>
        </TouchableOpacity>
      ) : null}
    </View>
  );
};

const styles = StyleSheet.create({
  fallback: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: tokens.spacing.sm,
    padding: tokens.spacing.lg,
    backgroundColor: tokens.colors.surface,
    borderRadius: tokens.radius.md,
  },
  fallbackIcon: { color: tokens.colors.white, fontSize: 28 },
  fallbackText: { color: tokens.colors.text.secondary, fontSize: tokens.typography.body.fontSize },
  fallbackBtn: {
    backgroundColor: tokens.colors.brand.primary,
    borderRadius: tokens.radius.sm,
    paddingHorizontal: tokens.spacing.xl,
    paddingVertical: tokens.spacing.sm,
  },
  fallbackBtnText: { color: tokens.colors.white, fontWeight: '700' },
});

export default TikTokEmbed;
