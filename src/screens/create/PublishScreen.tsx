import React, { useState } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, ScrollView, Switch } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { tokens } from '@/theme/tokens';
import { useNavigation } from '@/navigation/NavigationContext';

export const PublishScreen: React.FC = () => {
  const insets = useSafeAreaInsets();
  const nav = useNavigation();
  const [description, setDescription] = useState('');
  const [allowComments, setAllowComments] = useState(true);
  const [allowDuet, setAllowDuet] = useState(true);
  const [allowStitch, setAllowStitch] = useState(true);
  const [visibility, setVisibility] = useState<'public' | 'friends' | 'private'>('public');
  const [tagMode, setTagMode] = useState<'hashtags' | 'mention' | 'location' | null>(null);

  const insertTag = (mode: 'hashtags' | 'mention' | 'location') => {
    const prefix = mode === 'hashtags' ? '# ' : mode === 'mention' ? '@ ' : '📍 ';
    setTagMode(mode);
    setDescription((value) => `${value}${value && !value.endsWith(' ') ? ' ' : ''}${prefix}`);
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => nav.back()}>
          <Text style={styles.backIcon}>←</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Post</Text>
        <View style={styles.placeholder} />
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.descriptionSection}>
          <View style={styles.descriptionRow}>
            <TextInput
              style={styles.descriptionInput}
              placeholder="Describe your video..."
              placeholderTextColor={tokens.colors.text.tertiary}
              value={description}
              onChangeText={setDescription}
              multiline
              maxLength={2200}
            />
            <View style={styles.thumbnailPreview}>
              <Text style={styles.thumbnailPlaceholder}>📹</Text>
            </View>
          </View>
          <Text style={styles.charCount}>{description.length}/2200</Text>
        </View>

        <View style={styles.tagsSection}>
          <TouchableOpacity style={[styles.tagButton, tagMode === 'hashtags' && styles.tagButtonActive]} onPress={() => insertTag('hashtags')}>
            <Text style={styles.tagIcon}>#</Text>
            <Text style={styles.tagText}>Hashtags</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.tagButton, tagMode === 'mention' && styles.tagButtonActive]} onPress={() => insertTag('mention')}>
            <Text style={styles.tagIcon}>@</Text>
            <Text style={styles.tagText}>Mention</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.tagButton, tagMode === 'location' && styles.tagButtonActive]} onPress={() => insertTag('location')}>
            <Text style={styles.tagIcon}>📍</Text>
            <Text style={styles.tagText}>Location</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.settingsSection}>
          <Text style={styles.sectionTitle}>Who can view this video</Text>
          <View style={styles.visibilityRow}>
            {(['public', 'friends', 'private'] as const).map((option) => (
              <TouchableOpacity
                key={option}
                style={[styles.visibilityOption, visibility === option && styles.visibilityOptionActive]}
                onPress={() => setVisibility(option)}
              >
                <Text style={[styles.visibilityText, visibility === option && styles.visibilityTextActive]}>
                  {option.charAt(0).toUpperCase() + option.slice(1)}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        <View style={styles.togglesSection}>
          <View style={styles.toggleRow}>
            <Text style={styles.toggleLabel}>Allow comments</Text>
            <Switch
              value={allowComments}
              onValueChange={setAllowComments}
              trackColor={{ false: tokens.colors.surface, true: tokens.colors.brand.primary }}
              thumbColor={tokens.colors.white}
            />
          </View>
          <View style={styles.toggleRow}>
            <Text style={styles.toggleLabel}>Allow Duet</Text>
            <Switch
              value={allowDuet}
              onValueChange={setAllowDuet}
              trackColor={{ false: tokens.colors.surface, true: tokens.colors.brand.primary }}
              thumbColor={tokens.colors.white}
            />
          </View>
          <View style={styles.toggleRow}>
            <Text style={styles.toggleLabel}>Allow Stitch</Text>
            <Switch
              value={allowStitch}
              onValueChange={setAllowStitch}
              trackColor={{ false: tokens.colors.surface, true: tokens.colors.brand.primary }}
              thumbColor={tokens.colors.white}
            />
          </View>
        </View>
      </ScrollView>

      <View style={styles.footer}>
        <TouchableOpacity style={styles.draftButton} onPress={() => nav.reset('feed.foryou')}>
          <Text style={styles.draftButtonText}>Drafts</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.postButton} onPress={() => nav.reset('feed.foryou')}>
          <Text style={styles.postButtonText}>Post</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: tokens.colors.bg,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: tokens.spacing.md,
    paddingVertical: tokens.spacing.sm,
  },
  backIcon: { color: tokens.colors.white, fontSize: 24 },
  headerTitle: { color: tokens.colors.white, fontSize: tokens.typography.title.fontSize, fontWeight: '700' },
  placeholder: { width: 24 },
  content: { flex: 1, paddingHorizontal: tokens.spacing.md },
  descriptionSection: { marginTop: tokens.spacing.md },
  descriptionRow: { flexDirection: 'row', gap: tokens.spacing.md },
  descriptionInput: {
    flex: 1,
    color: tokens.colors.white,
    fontSize: tokens.typography.body.fontSize,
    minHeight: 100,
    textAlignVertical: 'top',
  },
  thumbnailPreview: {
    width: 80,
    height: 110,
    backgroundColor: tokens.colors.elevated,
    borderRadius: tokens.radius.sm,
    justifyContent: 'center',
    alignItems: 'center',
  },
  thumbnailPlaceholder: { fontSize: 28 },
  charCount: { color: tokens.colors.text.tertiary, fontSize: tokens.typography.caption.fontSize, marginTop: tokens.spacing.xs, textAlign: 'right' },
  tagsSection: { flexDirection: 'row', gap: tokens.spacing.sm, marginTop: tokens.spacing.md, paddingVertical: tokens.spacing.md, borderTopWidth: 0.5, borderTopColor: tokens.colors.surface },
  tagButton: { flexDirection: 'row', alignItems: 'center', gap: tokens.spacing.xs, paddingHorizontal: tokens.spacing.md, paddingVertical: tokens.spacing.sm, backgroundColor: tokens.colors.elevated, borderRadius: tokens.radius.full },
  tagButtonActive: { backgroundColor: tokens.colors.brand.primary },
  tagIcon: { fontSize: 14 },
  tagText: { color: tokens.colors.white, fontSize: tokens.typography.body.fontSize },
  settingsSection: { marginTop: tokens.spacing.lg },
  sectionTitle: { color: tokens.colors.white, fontSize: tokens.typography.subhead.fontSize, fontWeight: '600', marginBottom: tokens.spacing.sm },
  visibilityRow: { flexDirection: 'row', gap: tokens.spacing.sm },
  visibilityOption: { flex: 1, paddingVertical: tokens.spacing.sm, alignItems: 'center', borderRadius: tokens.radius.sm, backgroundColor: tokens.colors.elevated },
  visibilityOptionActive: { backgroundColor: tokens.colors.brand.primary },
  visibilityText: { color: tokens.colors.text.secondary, fontSize: tokens.typography.body.fontSize },
  visibilityTextActive: { color: tokens.colors.white, fontWeight: '600' },
  togglesSection: { marginTop: tokens.spacing.lg, gap: tokens.spacing.md },
  toggleRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  toggleLabel: { color: tokens.colors.white, fontSize: tokens.typography.body.fontSize },
  footer: { flexDirection: 'row', paddingHorizontal: tokens.spacing.md, paddingVertical: tokens.spacing.md, gap: tokens.spacing.sm },
  draftButton: { flex: 1, paddingVertical: tokens.spacing.md, alignItems: 'center', borderRadius: tokens.radius.sm, borderWidth: 1, borderColor: tokens.colors.surface },
  draftButtonText: { color: tokens.colors.white, fontSize: tokens.typography.body.fontSize, fontWeight: '600' },
  postButton: { flex: 2, paddingVertical: tokens.spacing.md, alignItems: 'center', borderRadius: tokens.radius.sm, backgroundColor: tokens.colors.brand.primary },
  postButtonText: { color: tokens.colors.white, fontSize: tokens.typography.body.fontSize, fontWeight: '700' },
});
