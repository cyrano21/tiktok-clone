import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { tokens } from '@/theme/tokens';
import { useNavigation } from '@/navigation/NavigationContext';

/**
 * L'édition vidéo réelle (trim, filtres, texte, FFmpeg) vit dans le Studio.
 * Cet écran n'affiche plus un faux éditeur : il redirige vers le vrai.
 */
export const EditScreen: React.FC = () => {
  const insets = useSafeAreaInsets();
  const nav = useNavigation();

  return (
    <View style={[styles.container, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => nav.back()} style={styles.backBtn}>
          <Text style={styles.backIcon}>←</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Edit</Text>
        <View style={styles.headerSpacer} />
      </View>

      <View style={styles.body}>
        <View style={styles.iconCircle}>
          <Text style={styles.icon}>🎬</Text>
        </View>
        <Text style={styles.title}>Éditeur vidéo complet dans le Studio</Text>
        <Text style={styles.subtitle}>
          L’édition (découpage, vitesse, filtres, texte, overlay) s’effectue dans le Studio avec
          traitement réel par FFmpeg, puis publication persistante. Tu y trouveras aussi l’import
          de fichier.
        </Text>
        <TouchableOpacity style={styles.primaryBtn} onPress={() => nav.push('studio.editor')}>
          <Text style={styles.primaryBtnText}>Ouvrir le Studio</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.secondaryBtn} onPress={() => nav.back()}>
          <Text style={styles.secondaryBtnText}>Retour</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: tokens.colors.black },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: tokens.spacing.md, paddingVertical: tokens.spacing.sm },
  backBtn: { width: 40, height: 40, justifyContent: 'center' },
  backIcon: { color: tokens.colors.white, fontSize: 24 },
  headerTitle: { color: tokens.colors.white, fontSize: tokens.typography.title.fontSize, fontWeight: '700' },
  headerSpacer: { width: 40 },
  body: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: tokens.spacing.xxl, gap: tokens.spacing.md },
  iconCircle: { width: 88, height: 88, borderRadius: 44, backgroundColor: tokens.colors.elevated, justifyContent: 'center', alignItems: 'center', marginBottom: tokens.spacing.sm },
  icon: { fontSize: 40 },
  title: { color: tokens.colors.white, fontSize: tokens.typography.subhead.fontSize, fontWeight: '800', textAlign: 'center' },
  subtitle: { color: tokens.colors.text.secondary, fontSize: tokens.typography.body.fontSize, lineHeight: 20, textAlign: 'center' },
  primaryBtn: { alignSelf: 'stretch', backgroundColor: tokens.colors.brand.primary, borderRadius: tokens.radius.md, paddingVertical: 14, alignItems: 'center', marginTop: tokens.spacing.md },
  primaryBtnText: { color: tokens.colors.white, fontSize: tokens.typography.subhead.fontSize, fontWeight: '800' },
  secondaryBtn: { alignSelf: 'stretch', borderRadius: tokens.radius.md, paddingVertical: 14, alignItems: 'center', borderWidth: 1, borderColor: tokens.colors.surface },
  secondaryBtnText: { color: tokens.colors.white, fontSize: tokens.typography.body.fontSize, fontWeight: '600' },
});
