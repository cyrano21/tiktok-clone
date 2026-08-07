import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Image, FlatList, useWindowDimensions, ActivityIndicator } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { tokens } from '@/theme/tokens';
import { useNavigation } from '@/navigation/NavigationContext';
import { useSessionStore } from '@/store/sessionStore';
import { useMyProfile } from '@/hooks/useMyProfile';
import { shareText } from '@/services/share';
import { authService } from '@/services/authService';
import { Modal } from 'react-native';

interface VideoGridItem {
  id: string;
  thumbnailUrl: string;
  viewsCount: string;
}

function formatShort(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1).replace('.0', '')}M`;
  if (n >= 1000) return `${(n / 1000).toFixed(1).replace('.0', '')}K`;
  return String(Math.round(n));
}

export const ProfileScreen: React.FC = () => {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const videoSize = (Math.min(width, 430) - 4) / 3;
  const [showOptionsMenu, setShowOptionsMenu] = useState(false);
  const nav = useNavigation();
  const [activeTab, setActiveTab] = useState<'videos' | 'liked'>('videos');
  const isSeller = useSessionStore((s) => s.isSeller);
  const profile = useMyProfile();

  const visibleVideos = activeTab === 'liked' ? profile.likedVideos : profile.videos;
  const realVideos: VideoGridItem[] = visibleVideos.map((v) => ({
    id: v.id,
    thumbnailUrl: v.thumbnailUrl,
    viewsCount: formatShort(v.viewsCount),
  }));

  const renderVideoItem = ({ item }: { item: VideoGridItem }) => (
    <TouchableOpacity
      testID={`profile-video-${item.id}`}
      style={[styles.videoItem, { width: videoSize, height: videoSize * 1.3 }]}
      onPress={() => nav.push('video.detail', { videoId: item.id })}
    >

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
        <View style={styles.headerTitleRow}>
          <Text style={styles.headerTitle}>@{profile.user.username}</Text>
          <View style={[styles.liveDot, { backgroundColor: profile.live ? tokens.colors.semantic.success : tokens.colors.text.tertiary }]} />
        </View>
        <TouchableOpacity onPress={() => setShowOptionsMenu(true)}>
          <Text style={styles.headerIcon}>⋯</Text>
        </TouchableOpacity>
      </View>

      <ScrollView showsVerticalScrollIndicator={false}>
        {profile.loading && (
          <View style={styles.loadingRow}>
            <ActivityIndicator color={tokens.colors.brand.primary} />
            <Text style={styles.loadingText}>Chargement du profil…</Text>
          </View>
        )}
        {profile.error && <Text style={styles.errorText}>{profile.error}</Text>}
        <View style={styles.profileSection}>
          <Image
            source={{ uri: profile.user.avatarUrl ?? 'https://picsum.photos/100/100' }}
            style={styles.avatar}
          />
          <Text style={styles.displayName}>{profile.user.displayName}</Text>
          <Text style={styles.username}>@{profile.user.username}</Text>

          <View style={styles.statsRow}>
            <View style={styles.statItem}>
              <Text style={styles.statValue}>{formatShort(profile.user.followingCount)}</Text>
              <Text style={styles.statLabel}>Following</Text>
            </View>
            <View style={styles.statItem}>
              <Text style={styles.statValue}>{formatShort(profile.user.followersCount)}</Text>
              <Text style={styles.statLabel}>Followers</Text>
            </View>
            <View style={styles.statItem}>
              <Text style={styles.statValue}>{formatShort(profile.likesCount)}</Text>
              <Text style={styles.statLabel}>Likes</Text>
            </View>
          </View>

          <View style={styles.actionRow}>
            <TouchableOpacity style={styles.editButton} onPress={() => nav.push('profile.edit')}>
              <Text style={styles.editButtonText}>Edit profile</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.shareButton} onPress={() => shareText(`Découvre le profil @${profile.user.username}`)}>
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
              <Text style={styles.studioTitle}>ORKY Studio</Text>
              <Text style={styles.studioSub}>Analyses, contenu, monétisation</Text>
            </View>
            <Text style={styles.studioChevron}>›</Text>
          </TouchableOpacity>

          {profile.user.bio ? (
            <Text style={styles.bio}>{profile.user.bio}</Text>
          ) : (
            <Text style={[styles.bio, { color: tokens.colors.text.tertiary }]}>Aucune bio pour le moment</Text>
          )}
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
          data={realVideos}
          extraData={activeTab}
          renderItem={renderVideoItem}
          keyExtractor={(item) => item.id}
          numColumns={3}
          scrollEnabled={false}
          contentContainerStyle={styles.videoGrid}
          ListEmptyComponent={(
            <Text style={styles.emptyText}>
              {activeTab === 'liked' ? 'Aucune vidéo aimée pour le moment.' : 'Aucune vidéo publiée pour le moment.'}
            </Text>
          )}
        />
      </ScrollView>

      {/* Options Menu (⋯) */}
      <Modal
        visible={showOptionsMenu}
        transparent
        animationType="slide"
        onRequestClose={() => setShowOptionsMenu(false)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setShowOptionsMenu(false)}
        >
          <View style={styles.optionsSheet}>
            <View style={styles.optionsHandle} />
            <TouchableOpacity
              style={styles.optionItem}
              onPress={() => {
                setShowOptionsMenu(false);
                shareText(`Découvre le profil @${profile.user.username}`);
              }}
            >
              <Text style={styles.optionIcon}>↗</Text>
              <Text style={styles.optionText}>Partager le profil</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.optionItem}
              onPress={() => {
                setShowOptionsMenu(false);
                nav.push('profile.settings');
              }}
            >
              <Text style={styles.optionIcon}>⚙️</Text>
              <Text style={styles.optionText}>Paramètres</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.optionItem}
              onPress={() => {
                setShowOptionsMenu(false);
                nav.push('orders');
              }}
            >
              <Text style={styles.optionIcon}>📦</Text>
              <Text style={styles.optionText}>Mes commandes</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.optionItem}
              onPress={() => {
                setShowOptionsMenu(false);
                nav.push('studio');
              }}
            >
              <Text style={styles.optionIcon}>🎨</Text>
              <Text style={styles.optionText}>ORKY Studio</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.optionItem, styles.optionItemDanger]}
              onPress={() => {
                setShowOptionsMenu(false);
                authService.logout();
                nav.replace('auth.login');
              }}
            >
              <Text style={[styles.optionIcon, styles.optionIconDanger]}>🚪</Text>
              <Text style={[styles.optionText, styles.optionTextDanger]}>Se déconnecter</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>
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
  headerTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  headerTitle: {
    color: tokens.colors.white,
    fontSize: tokens.typography.title.fontSize,
    fontWeight: '700',
  },
  liveDot: { width: 8, height: 8, borderRadius: 4, marginTop: 2 },
  headerIcon: {
    color: tokens.colors.white,
    fontSize: 24,
  },
  loadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: tokens.spacing.sm,
    paddingVertical: tokens.spacing.sm,
  },
  loadingText: { color: tokens.colors.text.secondary, fontSize: tokens.typography.caption.fontSize },
  errorText: { color: tokens.colors.semantic.error, fontSize: tokens.typography.caption.fontSize, textAlign: 'center', paddingHorizontal: tokens.spacing.md },
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
    paddingHorizontal: 2,
  },
  videoItem: {
    aspectRatio: 1 / 1.3,
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
  emptyText: {
    color: tokens.colors.text.secondary,
    textAlign: 'center',
    padding: tokens.spacing.lg,
  },
  videoViews: {
    color: tokens.colors.white,
    fontSize: tokens.typography.caption.fontSize,
    fontWeight: '600',
  },
  // Options menu (⋯)
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  optionsSheet: {
    backgroundColor: tokens.colors.surface,
    borderTopLeftRadius: tokens.radius.lg,
    borderTopRightRadius: tokens.radius.lg,
    paddingBottom: tokens.spacing.xl,
  },
  optionsHandle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: tokens.colors.text.tertiary,
    alignSelf: 'center',
    marginTop: tokens.spacing.sm,
    marginBottom: tokens.spacing.md,
  },
  optionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: tokens.spacing.md,
    paddingHorizontal: tokens.spacing.lg,
    gap: tokens.spacing.md,
  },
  optionIcon: {
    fontSize: 20,
    width: 28,
    textAlign: 'center',
  },
  optionText: {
    color: tokens.colors.white,
    fontSize: tokens.typography.body.fontSize,
  },
  optionItemDanger: {
    marginTop: tokens.spacing.sm,
    borderTopWidth: 1,
    borderTopColor: tokens.colors.elevated,
  },
  optionIconDanger: {
    opacity: 0.9,
  },
  optionTextDanger: {
    color: tokens.colors.semantic.error,
  },
});
