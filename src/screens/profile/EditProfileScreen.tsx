import React, { useState } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, ScrollView, Image } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { tokens } from '@/theme/tokens';
import { useNavigation } from '@/navigation/NavigationContext';

export const EditProfileScreen: React.FC = () => {
  const insets = useSafeAreaInsets();
  const nav = useNavigation();
  const [name, setName] = useState('Display Name');
  const [username, setUsername] = useState('username');
  const [bio, setBio] = useState('Creative content creator 🎬');
  const [link, setLink] = useState('');

  return (
    <View style={[styles.container, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => nav.back()}>
          <Text style={styles.cancelButton}>Cancel</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Edit profile</Text>
        <TouchableOpacity onPress={() => nav.back()}>
          <Text style={styles.saveButton}>Save</Text>
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.avatarSection}>
          <Image source={{ uri: 'https://picsum.photos/100/100' }} style={styles.avatar} />
          <TouchableOpacity>
            <Text style={styles.changePhotoText}>Change photo</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.formSection}>
          <View style={styles.fieldRow}>
            <Text style={styles.fieldLabel}>Name</Text>
            <TextInput
              style={styles.fieldInput}
              value={name}
              onChangeText={setName}
              placeholderTextColor={tokens.colors.text.tertiary}
            />
          </View>

          <View style={styles.fieldRow}>
            <Text style={styles.fieldLabel}>Username</Text>
            <TextInput
              style={styles.fieldInput}
              value={username}
              onChangeText={setUsername}
              autoCapitalize="none"
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
              maxLength={80}
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
      </ScrollView>
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
  bioInput: {
    minHeight: 60,
    textAlignVertical: 'top',
  },
});
