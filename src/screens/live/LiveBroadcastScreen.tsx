import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { tokens } from '@/theme/tokens';
import { useNavigation } from '@/navigation/NavigationContext';

/**
 * Native fallback. The web build resolves LiveBroadcastScreen.web.tsx and uses
 * the real LiveKit/WebRTC implementation. Native publishing must use the
 * LiveKit React Native SDK before it is exposed here; this screen deliberately
 * does not simulate a camera or mark a user as live.
 */
export const LiveBroadcastScreen: React.FC = () => {
  const insets = useSafeAreaInsets();
  const nav = useNavigation();

  return (
    <View style={[styles.container, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
      <View style={styles.card}>
        <Text style={styles.eyebrow}>LIVE</Text>
        <Text style={styles.title}>Diffusion native non activée</Text>
        <Text style={styles.body}>
          Le live réel est disponible sur la version web via LiveKit/WebRTC. La version native ne prétend plus diffuser tant que le SDK LiveKit React Native n’est pas intégré.
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
