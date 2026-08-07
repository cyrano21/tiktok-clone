import React, { useMemo, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, TextInput, Dimensions } from 'react-native';
import { BottomSheet } from './BottomSheet';
import { tokens } from '@/theme/tokens';
import { moderationService, ReportCategory } from '@/services/moderationService';

const REPORT_CATEGORIES: Array<{ id: ReportCategory; label: string }> = [
  { id: 'spam', label: 'Spam ou arnaque' },
  { id: 'harassment', label: 'Harcèlement' },
  { id: 'hate', label: 'Discours haineux' },
  { id: 'violence', label: 'Violence ou menace' },
  { id: 'sexual_content', label: 'Contenu sexuel' },
  { id: 'minor_safety', label: 'Sécurité des mineurs' },
  { id: 'self_harm', label: 'Automutilation ou suicide' },
  { id: 'illegal', label: 'Activité illégale' },
  { id: 'copyright', label: 'Droit d’auteur' },
  { id: 'impersonation', label: 'Usurpation d’identité' },
  { id: 'privacy', label: 'Atteinte à la vie privée' },
  { id: 'misinformation', label: 'Information trompeuse' },
  { id: 'other', label: 'Autre' },
];

interface SafetySheetProps {
  isVisible: boolean;
  onClose: () => void;
  videoId: string;
  creatorId: string;
  creatorUsername: string;
  onBlocked?: () => void;
}

export const SafetySheet: React.FC<SafetySheetProps> = ({
  isVisible,
  onClose,
  videoId,
  creatorId,
  creatorUsername,
  onBlocked,
}) => {
  const [selectedCategory, setSelectedCategory] = useState<ReportCategory | null>(null);
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState<'report' | 'block' | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const canReport = useMemo(() => selectedCategory !== null && busy === null, [selectedCategory, busy]);
  const sheetHeight = Math.min(620, Math.max(420, Dimensions.get('window').height * 0.82));

  const resetAndClose = () => {
    setSelectedCategory(null);
    setReason('');
    setMessage(null);
    setBusy(null);
    onClose();
  };

  const submitReport = async () => {
    if (!selectedCategory) return;
    setBusy('report');
    setMessage(null);
    try {
      await moderationService.report({
        targetType: 'video',
        targetId: videoId,
        category: selectedCategory,
        reason: reason.trim() || undefined,
      });
      setMessage('Signalement envoyé. Merci.');
      setSelectedCategory(null);
      setReason('');
    } catch (error: any) {
      setMessage(error?.response?.data?.message || error?.message || 'Impossible d’envoyer le signalement.');
    } finally {
      setBusy(null);
    }
  };

  const blockCreator = async () => {
    setBusy('block');
    setMessage(null);
    try {
      await moderationService.blockUser(creatorId);
      setMessage(`@${creatorUsername} est bloqué.`);
      onBlocked?.();
    } catch (error: any) {
      setMessage(error?.response?.data?.message || error?.message || 'Impossible de bloquer cet utilisateur.');
    } finally {
      setBusy(null);
    }
  };

  return (
    <BottomSheet isVisible={isVisible} onClose={resetAndClose} height={sheetHeight}>
      <ScrollView style={styles.container} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <View style={styles.headerRow}>
          <View style={styles.headerText}>
            <Text style={styles.title}>Sécurité et signalement</Text>
            <Text style={styles.subtitle}>Vidéo de @{creatorUsername}</Text>
          </View>
          <TouchableOpacity onPress={resetAndClose} style={styles.closeButton}>
            <Text style={styles.closeText}>×</Text>
          </TouchableOpacity>
        </View>

        <TouchableOpacity style={styles.blockButton} onPress={blockCreator} disabled={busy !== null}>
          <Text style={styles.blockTitle}>{busy === 'block' ? 'Blocage…' : `Bloquer @${creatorUsername}`}</Text>
          <Text style={styles.blockDescription}>Ses contenus et interactions seront masqués de ton expérience.</Text>
        </TouchableOpacity>

        <Text style={styles.sectionTitle}>Pourquoi signales-tu cette vidéo ?</Text>
        <View style={styles.categoryGrid}>
          {REPORT_CATEGORIES.map((category) => {
            const active = selectedCategory === category.id;
            return (
              <TouchableOpacity
                key={category.id}
                style={[styles.category, active && styles.categoryActive]}
                onPress={() => setSelectedCategory(category.id)}
                disabled={busy !== null}
              >
                <Text style={[styles.categoryText, active && styles.categoryTextActive]}>{category.label}</Text>
              </TouchableOpacity>
            );
          })}
        </View>

        <TextInput
          style={styles.reasonInput}
          value={reason}
          onChangeText={setReason}
          placeholder="Précisions facultatives"
          placeholderTextColor={tokens.colors.text.tertiary}
          multiline
          maxLength={2000}
          editable={busy === null}
        />

        {message && <Text style={styles.message}>{message}</Text>}

        <TouchableOpacity
          style={[styles.reportButton, !canReport && styles.reportButtonDisabled]}
          disabled={!canReport}
          onPress={submitReport}
        >
          <Text style={styles.reportText}>{busy === 'report' ? 'Envoi…' : 'Envoyer le signalement'}</Text>
        </TouchableOpacity>
      </ScrollView>
    </BottomSheet>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { paddingHorizontal: tokens.spacing.md, paddingBottom: tokens.spacing.xxl },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: tokens.spacing.md, gap: tokens.spacing.sm },
  headerText: { flex: 1, minWidth: 0 },
  title: { color: tokens.colors.white, fontSize: tokens.typography.title.fontSize, fontWeight: '800' },
  subtitle: { color: tokens.colors.text.secondary, marginTop: 3 },
  closeButton: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  closeText: { color: tokens.colors.white, fontSize: 30, lineHeight: 32 },
  blockButton: { backgroundColor: '#5b1b22', borderRadius: tokens.radius.md, padding: tokens.spacing.md, marginBottom: tokens.spacing.lg },
  blockTitle: { color: '#fff', fontWeight: '800', fontSize: tokens.typography.subhead.fontSize },
  blockDescription: { color: 'rgba(255,255,255,0.72)', marginTop: 4, fontSize: tokens.typography.caption.fontSize },
  sectionTitle: { color: tokens.colors.white, fontWeight: '800', marginBottom: tokens.spacing.sm },
  categoryGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  category: { borderWidth: 1, borderColor: tokens.colors.surface, borderRadius: tokens.radius.full, paddingHorizontal: 12, paddingVertical: 8 },
  categoryActive: { backgroundColor: tokens.colors.brand.primary, borderColor: tokens.colors.brand.primary },
  categoryText: { color: tokens.colors.text.secondary, fontSize: tokens.typography.caption.fontSize },
  categoryTextActive: { color: tokens.colors.white, fontWeight: '700' },
  reasonInput: { minHeight: 86, marginTop: tokens.spacing.md, borderRadius: tokens.radius.md, backgroundColor: tokens.colors.surface, color: tokens.colors.white, padding: tokens.spacing.md, textAlignVertical: 'top' },
  message: { color: tokens.colors.text.secondary, marginTop: tokens.spacing.sm },
  reportButton: { backgroundColor: tokens.colors.brand.primary, paddingVertical: 14, borderRadius: tokens.radius.md, alignItems: 'center', marginTop: tokens.spacing.md },
  reportButtonDisabled: { opacity: 0.45 },
  reportText: { color: tokens.colors.white, fontWeight: '800' },
});
