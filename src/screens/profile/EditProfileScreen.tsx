import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, ScrollView, Image, ActivityIndicator } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { tokens } from '@/theme/tokens';
import { useNavigation } from '@/navigation/NavigationContext';
import { useMyProfile } from '@/hooks/useMyProfile';
import { authService } from '@/services/authService';

export const EditProfileScreen: React.FC = () => {
  const insets = useSafeAreaInsets();
  const nav = useNavigation();
  const profile = useMyProfile();

  const [name, setName] = useState('');
  const [username, setUsername] = useState('');
  const [bio, setBio] = useState('');
  const [link, setLink] = useState('');
  const [loaded, setLoaded] = useState(false);
  const [lastUserId, setLastUserId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Prefill when the profile arrives; re-prefill if the user changes (demo → real).
  useEffect(() => {
    if (loaded && profile.user.id === lastUserId) return;
    setName(profile.user.displayName ?? '');
    setUsername(profile.user.username);
    setBio(profile.user.bio ?? '');
    setLink('');
    setLoaded(true);
    setLastUserId(profile.user.id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile.user.id, profile.live]);

  const save = async () => {
    if (!profile.live) return;
    setSaving(true);
    setError(null);
    try {
      await authService.updateProfile({
        displayName: name.trim(),
        bio: bio.trim(),
        website: link.trim() || undefined,
      });
      nav.back();
    } catch (e: any) {
      setError(e?.message ?? 'Impossible d’enregistrer');
      setSaving(false);
    }
  };

  if (!loaded) {
    return (
      <View style={[styles.container, styles.center, { paddingTop: insets.top }]}>
        <ActivityIndicator color={tokens.colors.brand.primary} />
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => nav.back()}>
          <Text style={styles.cancelButton}>Cancel</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Edit profile</Text>
        <TouchableOpacity onPress={save} disabled={saving || !profile.live}>
          <Text style={[styles.saveButton, (saving || !profile.live) && { opacity: 0.5 }]}>
            {saving ? '…' : profile.live ? 'Save' : '—'}
          </Text>
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.avatarSection}>
          <Image source={{ uri: profile.user.avatarUrl ?? 'https://picsum.photos/100/100' }} style={styles.avatar} />
          <Text style={styles.changePhotoText}>{profile.live ? `@${username}` : 'Compte de démonstration'}</Text>
        </View>

        {error && <Text style={styles.errorText}>{error}</Text>}

        <View style={styles.formSection}>
          <View style={styles.fieldRow}>
            <Text style={styles.fieldLabel}>Name</Text>
            <TextInput
              style={styles.fieldInput}
              value={name}
              onChangeText={setName}
              placeholderTextColor={tokens.colors.text.tertiary}
              maxLength={50}
            />
          </View>

          <View style={styles.fieldRow}>
            <Text style={styles.fieldLabel}>Username</Text>
            <TextInput
              style={[styles.fieldInput, styles.fieldReadonly]}
              value={username}
              onChangeText={setUsername}
              autoCapitalize="none"
              editable={false}
              placeholderTextColor={tokens.colors.text.tertiary}
            />
          </View>

          <View style={styles.fieldRow}>
            <Text style={styles.fieldLabel}>Bio</Text>
            <TextInput
              style={[styles.fieldInput, styles.bioInput]}
              value={bio}
              onChangeText={setBio}
              multiline
              maxLength={200}
              placeholderTextColor={tokens.colors.text.tertiary}
            />
          </View>

          <View style={styles.fieldRow}>
            <Text style={styles.fieldLabel}>Link</Text>
            <TextInput
              style={styles.fieldInput}
              value={link}
              onChangeText={setLink}
              placeholder="Add a link"
              autoCapitalize="none"
              keyboardType="url"
              placeholderTextColor={tokens.colors.text.tertiary}
            />
          </View>
        </View>

        {profile.live ? (
          <Text style={styles.hint}>Les modifications sont enregistrées sur ton compte réel.</Text>
        ) : (
          <Text style={styles.hint}>Connecte-toi pour modifier ton vrai profil.</Text>
        )}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: tokens.colors.bg,
  },
  center: { justifyContent: 'center', alignItems: 'center' },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: tokens.spacing.md,
    paddingVertical: tokens.spacing.sm,
    borderBottomWidth: 0.5,
    borderBottomColor: tokens.colors.surface,
  },
  cancelButton: { color: tokens.colors.white, fontSize: tokens.typography.body.fontSize },
  headerTitle: { color: tokens.colors.white, fontSize: tokens.typography.title.fontSize, fontWeight: '700' },
  saveButton: { color: tokens.colors.brand.primary, fontSize: tokens.typography.body.fontSize, fontWeight: '600' },
  content: { flex: 1 },
  avatarSection: {
    alignItems: 'center',
    paddingVertical: tokens.spacing.xl,
    gap: tokens.spacing.sm,
  },
  avatar: {
    width: 96,
    height: 96,
    borderRadius: 48,
  },
  changePhotoText: {
    color: tokens.colors.brand.primary,
    fontSize: tokens.typography.body.fontSize,
    fontWeight: '500',
  },
  errorText: {
    color: tokens.colors.semantic.error,
    fontSize: tokens.typography.body.fontSize,
    fontWeight: '600',
    textAlign: 'center',
    paddingHorizontal: tokens.spacing.md,
    marginBottom: tokens.spacing.sm,
  },
  formSection: {
    paddingHorizontal: tokens.spacing.md,
  },
  fieldRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: tokens.spacing.md,
    borderBottomWidth: 0.5,
    borderBottomColor: tokens.colors.surface,
  },
  fieldLabel: {
    width: 100,
    color: tokens.colors.text.secondary,
    fontSize: tokens.typography.body.fontSize,
    paddingTop: 2,
  },
  fieldInput: {
    flex: 1,
    color: tokens.colors.white,
    fontSize: tokens.typography.body.fontSize,
  },
  fieldReadonly: { color: tokens.colors.text.tertiary },
  bioInput: {
    minHeight: 60,
    textAlignVertical: 'top',
  },
  hint: {
    color: tokens.colors.text.tertiary,
    fontSize: tokens.typography.caption.fontSize,
    textAlign: 'center',
    marginTop: tokens.spacing.lg,
    paddingHorizontal: tokens.spacing.xl,
  },
});
