import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { tokens } from '@/theme/tokens';
import { useNavigation } from '@/navigation/NavigationContext';

/**
 * Native fallback. The web resolver uses LiveScreen.web.tsx and connects to
 * real LiveKit rooms. Native playback remains disabled until the native SDK is
 * wired, rather than showing invented hosts, viewer counts, chat or gifts.
 */
export const LiveScreen: React.FC = () => {
  const insets = useSafeAreaInsets();
  const nav = useNavigation();

  return (
    <View style={[styles.container, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
      <View style={styles.card}>
        <Text style={styles.eyebrow}>LIVE</Text>
        <Text style={styles.title}>Lecture native non activée</Text>
        <Text style={styles.body}>
          Les directs réels fonctionnent sur le web via LiveKit/WebRTC. Cette version native n’affiche plus de faux streamer, faux chat ou faux compteur.
        </Text>
        <TouchableOpacity style={styles.button} onPress={() => nav.back()}>
          <Text style={styles.buttonText}>Retour</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: tokens.colors.black, justifyContent: 'center', paddingHorizontal: tokens.spacing.lg },
  card: { backgroundColor: tokens.colors.elevated, borderRadius: tokens.radius.lg, padding: tokens.spacing.xl, gap: tokens.spacing.md },
  eyebrow: { color: tokens.colors.semantic.live, fontSize: tokens.typography.caption.fontSize, fontWeight: '900', letterSpacing: 2 },
  title: { color: tokens.colors.white, fontSize: tokens.typography.headline.fontSize, fontWeight: '800' },
  body: { color: tokens.colors.text.secondary, fontSize: tokens.typography.body.fontSize, lineHeight: 21 },
  button: { marginTop: tokens.spacing.sm, backgroundColor: tokens.colors.brand.primary, borderRadius: tokens.radius.sm, paddingVertical: tokens.spacing.md, alignItems: 'center' },
  buttonText: { color: tokens.colors.white, fontWeight: '800' },
});
