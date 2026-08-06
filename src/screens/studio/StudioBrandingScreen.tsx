import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, Image } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { tokens } from '@/theme/tokens';
import { useNavigation } from '@/navigation/NavigationContext';
import { useBrandingStore, Branding } from '@/store/brandingStore';
import { brandingService } from '@/services/brandingService';

const PRESETS: Array<{ label: string; branding: Branding }> = [
  {
    label: 'TikTok',
    branding: { name: 'TikTok', logoUrl: '', primaryColor: '#FE2C55', accentColor: '#25F4EE', tagline: 'Short videos' },
  },
  {
    label: 'ÉcolePro',
    branding: { name: 'ÉcolePro', logoUrl: '', primaryColor: '#4C6FFF', accentColor: '#7AE0FF', tagline: 'Micro-leçons vidéo' },
  },
  {
    label: 'CorpTV',
    branding: { name: 'CorpTV', logoUrl: '', primaryColor: '#7C3AED', accentColor: '#F472B6', tagline: 'Réseau interne' },
  },
  {
    label: 'Foodies',
    branding: { name: 'Foodies', logoUrl: '', primaryColor: '#FF8C42', accentColor: '#FFD166', tagline: 'Recettes en 60s' },
  },
  {
    label: 'FitHub',
    branding: { name: 'FitHub', logoUrl: '', primaryColor: '#10B981', accentColor: '#A7F3D0', tagline: 'Coaching vidéo' },
  },
];

const COLOR_OPTIONS = [
  '#FE2C55', '#4C6FFF', '#7C3AED', '#10B981', '#FF8C42',
  '#F472B6', '#0EA5E9', '#F59E0B', '#22C55E', '#EF4444',
];

export const StudioBrandingScreen: React.FC = () => {
  const insets = useSafeAreaInsets();
  const nav = useNavigation();

  const current = useBrandingStore((s) => s.branding);
  const apply = useBrandingStore((s) => s.apply);
  const reset = useBrandingStore((s) => s.reset);

  const [name, setName] = useState(current.name);
  const [logoUrl, setLogoUrl] = useState(current.logoUrl);
  const [primaryColor, setPrimaryColor] = useState(current.primaryColor);
  const [accentColor, setAccentColor] = useState(current.accentColor);
  const [tagline, setTagline] = useState(current.tagline);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const save = async () => {
    setBusy(true);
    setMessage(null);
    try {
      await brandingService.update({
        name: name.trim() || 'TikTok',
        logoUrl: logoUrl.trim(),
        primaryColor,
        accentColor,
        tagline: tagline.trim(),
      });
      apply({ name: name.trim() || 'TikTok', logoUrl: logoUrl.trim(), primaryColor, accentColor, tagline: tagline.trim() });
      setMessage('✓ Branding enregistré — visible sur toute l’app');
    } catch (e: any) {
      setMessage(`Erreur : ${e?.message ?? 'impossible d’enregistrer'}`);
    } finally {
      setBusy(false);
    }
  };

  const handleReset = async () => {
    setBusy(true);
    setMessage(null);
    try {
      await brandingService.reset();
      reset();
      setName('TikTok');
      setLogoUrl('');
      setPrimaryColor('#FE2C55');
      setAccentColor('#25F4EE');
      setTagline('Short videos');
      setMessage('✓ Branding réinitialisé (identité TikTok)');
    } catch {
      setMessage('Erreur : connexion requise pour réinitialiser');
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => nav.back()} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <Text style={styles.backIcon}>←</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>White-label</Text>
        <View style={styles.placeholder} />
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: tokens.spacing.xxl }}>
        {/* Live preview */}
        <View style={styles.previewCard}>
          <Text style={styles.previewLabel}>Aperçu</Text>
          <View style={styles.previewRow}>
            {logoUrl ? (
              <Image source={{ uri: logoUrl }} style={styles.previewLogo} />
            ) : (
              <View style={[styles.previewLogo, { backgroundColor: primaryColor }]}>
                <Text style={styles.previewLogoText}>{name.slice(0, 1).toUpperCase()}</Text>
              </View>
            )}
            <View>
              <Text style={[styles.previewName, { color: primaryColor }]}>{name || 'Nom de la marque'}</Text>
              <Text style={styles.previewTagline}>{tagline || 'Slogan'}</Text>
            </View>
          </View>
          <View style={styles.previewNavRow}>
            {['🏠', '🔍', '🛍️', '+', '💬', '👤'].map((ic, i) => (
              <Text key={i} style={[styles.previewNavIcon, i === 0 && { color: primaryColor }]}>{ic}</Text>
            ))}
          </View>
        </View>

        {message && (
          <View style={styles.messageBanner}>
            <Text style={styles.messageText}>{message}</Text>
          </View>
        )}

        {/* Presets */}
        <Text style={styles.sectionTitle}>Templates de marque</Text>
        <View style={styles.section}>
          <View style={styles.presetsRow}>
            {PRESETS.map((p) => {
              const active = p.branding.name === name;
              return (
                <TouchableOpacity
                  key={p.label}
                  style={[styles.presetChip, active && { borderColor: p.branding.primaryColor }]}
                  onPress={() => {
                    setName(p.branding.name);
                    setPrimaryColor(p.branding.primaryColor);
                    setAccentColor(p.branding.accentColor);
                    setTagline(p.branding.tagline);
                  }}
                >
                  <View style={[styles.presetDot, { backgroundColor: p.branding.primaryColor }]} />
                  <Text style={styles.presetText}>{p.label}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* Fields */}
        <Text style={styles.sectionTitle}>Identité</Text>
        <View style={styles.section}>
          <TextInput style={styles.input} placeholder="Nom de l’app" placeholderTextColor={tokens.colors.text.tertiary} value={name} onChangeText={setName} maxLength={40} />
          <TextInput style={styles.input} placeholder="Logo URL (https://…)" placeholderTextColor={tokens.colors.text.tertiary} value={logoUrl} onChangeText={setLogoUrl} autoCapitalize="none" />
          <TextInput style={styles.input} placeholder="Slogan" placeholderTextColor={tokens.colors.text.tertiary} value={tagline} onChangeText={setTagline} maxLength={60} />
        </View>

        {/* Colors */}
        <Text style={styles.sectionTitle}>Couleur principale</Text>
        <View style={styles.section}>
          <View style={styles.colorRow}>
            {COLOR_OPTIONS.map((c) => (
              <TouchableOpacity
                key={c}
                style={[styles.colorSwatch, { backgroundColor: c }, primaryColor === c && styles.colorSwatchActive]}
                onPress={() => setPrimaryColor(c)}
              />
            ))}
          </View>
        </View>

        <Text style={styles.sectionTitle}>Couleur d’accent</Text>
        <View style={styles.section}>
          <View style={styles.colorRow}>
            {COLOR_OPTIONS.map((c) => (
              <TouchableOpacity
                key={c}
                style={[styles.colorSwatch, { backgroundColor: c }, accentColor === c && styles.colorSwatchActive]}
                onPress={() => setAccentColor(c)}
              />
            ))}
          </View>
        </View>

        {/* Actions */}
        <View style={styles.section}>
          <TouchableOpacity style={[styles.saveBtn, { backgroundColor: primaryColor }]} onPress={save} disabled={busy}>
            <Text style={styles.saveText}>{busy ? '…' : '💾 Enregistrer le branding'}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.resetBtn} onPress={handleReset} disabled={busy}>
            <Text style={styles.resetText}>↺ Réinitialiser (retour TikTok)</Text>
          </TouchableOpacity>
        </View>

        <Text style={styles.disclaimer}>
          Le white-label change le nom, le logo, les couleurs et le slogan — idéal pour revendre la plateforme à des écoles, entreprises ou communautés (client "tenant").
        </Text>
      </ScrollView>
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
  previewCard: {
    margin: tokens.spacing.md,
    backgroundColor: tokens.colors.elevated,
    borderRadius: tokens.radius.lg,
    padding: tokens.spacing.md,
    gap: tokens.spacing.md,
  },
  previewLabel: { color: tokens.colors.text.secondary, fontSize: tokens.typography.caption.fontSize, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 1 },
  previewRow: { flexDirection: 'row', alignItems: 'center', gap: tokens.spacing.md },
  previewLogo: { width: 56, height: 56, borderRadius: 14, justifyContent: 'center', alignItems: 'center' },
  previewLogoText: { color: tokens.colors.white, fontSize: 26, fontWeight: '800' },
  previewName: { fontSize: 22, fontWeight: '800' },
  previewTagline: { color: tokens.colors.text.secondary, fontSize: tokens.typography.body.fontSize, marginTop: 2 },
  previewNavRow: { flexDirection: 'row', justifyContent: 'space-around', paddingTop: tokens.spacing.sm, borderTopWidth: 0.5, borderTopColor: tokens.colors.surface },
  previewNavIcon: { fontSize: 16, opacity: 0.6 },
  messageBanner: {
    marginHorizontal: tokens.spacing.md,
    backgroundColor: tokens.colors.semantic.success + '22',
    borderRadius: tokens.radius.sm,
    padding: tokens.spacing.md,
    marginBottom: tokens.spacing.sm,
  },
  messageText: { color: tokens.colors.semantic.success, fontSize: tokens.typography.body.fontSize, fontWeight: '700' },
  sectionTitle: { color: tokens.colors.white, fontSize: tokens.typography.subhead.fontSize, fontWeight: '800', paddingHorizontal: tokens.spacing.md, marginTop: tokens.spacing.lg, marginBottom: tokens.spacing.sm },
  section: { paddingHorizontal: tokens.spacing.md, gap: tokens.spacing.sm },
  presetsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: tokens.spacing.sm },
  presetChip: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: tokens.spacing.md, paddingVertical: 8, borderRadius: tokens.radius.full, backgroundColor: tokens.colors.elevated, borderWidth: 1.5, borderColor: 'transparent' },
  presetDot: { width: 12, height: 12, borderRadius: 6 },
  presetText: { color: tokens.colors.white, fontSize: tokens.typography.body.fontSize, fontWeight: '600' },
  input: {
    backgroundColor: tokens.colors.elevated,
    borderRadius: tokens.radius.md,
    paddingHorizontal: tokens.spacing.md,
    paddingVertical: tokens.spacing.md,
    color: tokens.colors.white,
    fontSize: tokens.typography.body.fontSize,
  },
  colorRow: { flexDirection: 'row', flexWrap: 'wrap', gap: tokens.spacing.sm },
  colorSwatch: { width: 40, height: 40, borderRadius: 20, borderWidth: 2, borderColor: 'transparent' },
  colorSwatchActive: { borderColor: tokens.colors.white },
  saveBtn: { borderRadius: tokens.radius.md, paddingVertical: tokens.spacing.md, alignItems: 'center' },
  saveText: { color: tokens.colors.white, fontSize: tokens.typography.subhead.fontSize, fontWeight: '800' },
  resetBtn: { borderWidth: 1, borderColor: tokens.colors.surface, borderRadius: tokens.radius.md, paddingVertical: tokens.spacing.md, alignItems: 'center' },
  resetText: { color: tokens.colors.text.secondary, fontSize: tokens.typography.body.fontSize, fontWeight: '600' },
  disclaimer: { color: tokens.colors.text.tertiary, fontSize: tokens.typography.caption.fontSize, paddingHorizontal: tokens.spacing.md, marginTop: tokens.spacing.lg, lineHeight: 16 },
});
