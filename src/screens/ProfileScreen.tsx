import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Image, FlatList, Dimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { tokens } from '@/theme/tokens';
import { useNavigation } from '@/navigation/NavigationContext';
import { useStudioStore } from '@/store/studioStore';
import { useSessionStore } from '@/store/sessionStore';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const VIDEO_SIZE = (SCREEN_WIDTH - 4) / 3;

interface VideoGridItem {
  id: string;
  thumbnailUrl: string;
  viewsCount: string;
}

const MOCK_VIDEOS: VideoGridItem[] = Array.from({ length: 18 }, (_, i) => ({
  id: `video-${i}`,
  thumbnailUrl: `https://picsum.photos/seed/profvid${i}/200/300`,
  viewsCount: `${Math.floor(Math.random() * 900 + 100)}K`,
}));

export const ProfileScreen: React.FC = () => {
  const insets = useSafeAreaInsets();
  const nav = useNavigation();
  const [activeTab, setActiveTab] = useState<'videos' | 'liked'>('videos');
  const myPosts = useStudioStore((s) => s.posts);
  const isSeller = useSessionStore((s) => s.isSeller);

  const renderVideoItem = ({ item }: { item: VideoGridItem }) => (
    <TouchableOpacity style={styles.videoItem}>
      <Image source={{ uri: item.thumbnailUrl }} style={styles.videoThumbnail} />
      <View style={styles.videoOverlay}>
        <Text style={styles.videoViews}>▶ {item.viewsCount}</Text>
      </View>
    </TouchableOpacity>
  );

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => nav.push('profile.settings')}>
          <Text style={styles.headerIcon}>☰</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>@username</Text>
        <TouchableOpacity onPress={() => nav.push('profile.settings')}>
          <Text style={styles.headerIcon}>⋯</Text>
        </TouchableOpacity>
      </View>

      <ScrollView showsVerticalScrollIndicator={false}>
        <View style={styles.profileSection}>
          <Image
            source={{ uri: 'https://picsum.photos/100/100' }}
            style={styles.avatar}
          />
          <Text style={styles.displayName}>Display Name</Text>
          <Text style={styles.username}>@username</Text>

          <View style={styles.statsRow}>
            <View style={styles.statItem}>
              <Text style={styles.statValue}>128</Text>
              <Text style={styles.statLabel}>Following</Text>
            </View>
            <View style={styles.statItem}>
              <Text style={styles.statValue}>14.2K</Text>
              <Text style={styles.statLabel}>Followers</Text>
            </View>
            <View style={styles.statItem}>
              <Text style={styles.statValue}>892K</Text>
              <Text style={styles.statLabel}>Likes</Text>
            </View>
          </View>

          <View style={styles.actionRow}>
            <TouchableOpacity style={styles.editButton} onPress={() => nav.push('profile.edit')}>
              <Text style={styles.editButtonText}>Edit profile</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.shareButton}>
              <Text style={styles.shareButtonIcon}>↗</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.commerceRow}>
            <TouchableOpacity style={styles.commerceBtn} onPress={() => nav.push('orders')}>
              <Text style={styles.commerceIcon}>📦</Text>
              <Text style={styles.commerceText}>Mes commandes</Text>
            </TouchableOpacity>
            {isSeller && (
              <TouchableOpacity style={[styles.commerceBtn, styles.commerceBtnPrimary]} onPress={() => nav.push('shop.dashboard')}>
                <Text style={styles.commerceIcon}>🛍️</Text>
                <Text style={[styles.commerceText, styles.commerceTextPrimary]}>Ma boutique</Text>
              </TouchableOpacity>
            )}
          </View>

          <TouchableOpacity style={styles.studioBtn} onPress={() => nav.push('studio')}>
            <Text style={styles.studioIcon}>🎬</Text>
            <View style={{ flex: 1 }}>
              <Text style={styles.studioTitle}>TikTok Studio</Text>
              <Text style={styles.studioSub}>Analyses, contenu, monétisation</Text>
            </View>
            <Text style={styles.studioChevron}>›</Text>
          </TouchableOpacity>

          <Text style={styles.bio}>
            Creative content creator 🎬{'\n'}
            Making videos that inspire ✨
          </Text>
        </View>

        <View style={styles.tabRow}>
          <TouchableOpacity
            style={[styles.tabButton, activeTab === 'videos' && styles.tabButtonActive]}
            onPress={() => setActiveTab('videos')}
          >
            <Text style={[styles.tabButtonText, activeTab === 'videos' && styles.tabButtonTextActive]}>
              📹 Videos
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tabButton, activeTab === 'liked' && styles.tabButtonActive]}
            onPress={() => setActiveTab('liked')}
          >
            <Text style={[styles.tabButtonText, activeTab === 'liked' && styles.tabButtonTextActive]}>
              ♥ Liked
            </Text>
          </TouchableOpacity>
        </View>

        <FlatList
          data={[
            ...myPosts.map((p) => ({ id: p.id, thumbnailUrl: p.thumbnailUrl, viewsCount: 'Nouveau' })),
            ...MOCK_VIDEOS,
          ]}
          renderItem={renderVideoItem}
          keyExtractor={(item) => item.id}
          numColumns={3}
          scrollEnabled={false}
          contentContainerStyle={styles.videoGrid}
        />
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
  },
  headerTitle: {
    color: tokens.colors.white,
    fontSize: tokens.typography.title.fontSize,
    fontWeight: '700',
  },
  headerIcon: {
    color: tokens.colors.white,
    fontSize: 24,
  },
  profileSection: {
    alignItems: 'center',
    paddingVertical: tokens.spacing.lg,
  },
  avatar: {
    width: 96,
    height: 96,
    borderRadius: 48,
    marginBottom: tokens.spacing.sm,
  },
  displayName: {
    color: tokens.colors.white,
    fontSize: tokens.typography.title.fontSize,
    fontWeight: '700',
  },
  username: {
    color: tokens.colors.text.secondary,
    fontSize: tokens.typography.body.fontSize,
    marginTop: 2,
  },
  statsRow: {
    flexDirection: 'row',
    marginTop: tokens.spacing.lg,
    gap: tokens.spacing.xl,
  },
  statItem: {
    alignItems: 'center',
  },
  statValue: {
    color: tokens.colors.white,
    fontSize: tokens.typography.title.fontSize,
    fontWeight: '700',
  },
  statLabel: {
    color: tokens.colors.text.secondary,
    fontSize: tokens.typography.caption.fontSize,
    marginTop: 2,
  },
  actionRow: {
    flexDirection: 'row',
    marginTop: tokens.spacing.md,
    gap: tokens.spacing.sm,
  },
  editButton: {
    paddingHorizontal: tokens.spacing.xl,
    paddingVertical: tokens.spacing.sm,
    backgroundColor: tokens.colors.elevated,
    borderRadius: tokens.radius.xs,
  },
  editButtonText: {
    color: tokens.colors.white,
    fontSize: tokens.typography.body.fontSize,
    fontWeight: '600',
  },
  shareButton: {
    width: 36,
    height: 36,
    backgroundColor: tokens.colors.elevated,
    borderRadius: tokens.radius.xs,
    justifyContent: 'center',
    alignItems: 'center',
  },
  shareButtonIcon: {
    color: tokens.colors.white,
    fontSize: 18,
  },
  commerceRow: {
    flexDirection: 'row',
    gap: tokens.spacing.sm,
    marginTop: tokens.spacing.md,
    paddingHorizontal: tokens.spacing.lg,
    width: '100%',
  },
  commerceBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: tokens.spacing.sm,
    borderRadius: tokens.radius.sm,
    backgroundColor: tokens.colors.elevated,
  },
  commerceBtnPrimary: {
    backgroundColor: tokens.colors.brand.primary,
  },
  commerceIcon: { fontSize: 15 },
  commerceText: { color: tokens.colors.white, fontSize: tokens.typography.body.fontSize, fontWeight: '600' },
  commerceTextPrimary: { color: tokens.colors.white, fontWeight: '800' },
  studioBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.spacing.sm,
    marginTop: tokens.spacing.sm,
    paddingVertical: tokens.spacing.sm,
    paddingHorizontal: tokens.spacing.md,
    marginHorizontal: tokens.spacing.lg,
    borderRadius: tokens.radius.sm,
    backgroundColor: tokens.colors.elevated,
    alignSelf: 'stretch',
  },
  studioIcon: { fontSize: 20 },
  studioTitle: { color: tokens.colors.white, fontSize: tokens.typography.body.fontSize, fontWeight: '700' },
  studioSub: { color: tokens.colors.text.secondary, fontSize: tokens.typography.caption.fontSize, marginTop: 1 },
  studioChevron: { color: tokens.colors.text.tertiary, fontSize: 20 },
  bio: {
    color: tokens.colors.white,
    fontSize: tokens.typography.body.fontSize,
    textAlign: 'center',
    marginTop: tokens.spacing.md,
    paddingHorizontal: tokens.spacing.xl,
    lineHeight: tokens.typography.body.lineHeight,
  },
  tabRow: {
    flexDirection: 'row',
    borderBottomWidth: 0.5,
    borderBottomColor: tokens.colors.surface,
  },
  tabButton: {
    flex: 1,
    paddingVertical: tokens.spacing.md,
    alignItems: 'center',
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  tabButtonActive: {
    borderBottomColor: tokens.colors.white,
  },
  tabButtonText: {
    color: tokens.colors.text.secondary,
    fontSize: tokens.typography.body.fontSize,
    fontWeight: '500',
  },
  tabButtonTextActive: {
    color: tokens.colors.white,
    fontWeight: '700',
  },
  videoGrid: {
    gap: 2,
  },
  videoItem: {
    width: VIDEO_SIZE,
    height: VIDEO_SIZE * 1.3,
    margin: 0.5,
  },
  videoThumbnail: {
    width: '100%',
    height: '100%',
  },
  videoOverlay: {
    position: 'absolute',
    bottom: tokens.spacing.xs,
    left: tokens.spacing.xs,
    flexDirection: 'row',
    alignItems: 'center',
  },
  videoViews: {
    color: tokens.colors.white,
    fontSize: tokens.typography.caption.fontSize,
    fontWeight: '600',
  },
});
