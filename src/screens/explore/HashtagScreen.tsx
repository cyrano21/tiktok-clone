import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, FlatList, Image, Dimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { tokens } from '@/theme/tokens';
import { useNavigation, useRouteParams } from '@/navigation/NavigationContext';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const VIDEO_SIZE = (SCREEN_WIDTH - 4) / 3;

interface VideoGridItem {
  id: string;
  thumbnailUrl: string;
  viewsCount: string;
}

const MOCK_VIDEOS: VideoGridItem[] = Array.from({ length: 24 }, (_, i) => ({
  id: `hashtag-video-${i}`,
  thumbnailUrl: `https://picsum.photos/200/${300 + i}`,
  viewsCount: `${Math.floor(Math.random() * 500 + 50)}K`,
}));

export const HashtagScreen: React.FC = () => {
  const insets = useSafeAreaInsets();
  const nav = useNavigation();
  const params = useRouteParams<{ tag?: string }>();
  const tag = params.tag ?? 'fyp';
  const [isFollowing, setIsFollowing] = useState(false);

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
        <TouchableOpacity onPress={() => nav.back()}>
          <Text style={styles.backIcon}>←</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>#{tag}</Text>
        <TouchableOpacity>
          <Text style={styles.shareIcon}>↗</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.hashtagInfo}>
        <View style={styles.hashtagIcon}>
          <Text style={styles.hashtagEmoji}>#</Text>
        </View>
        <View style={styles.hashtagStats}>
          <Text style={styles.hashtagName}>#{tag}</Text>
          <Text style={styles.hashtagViews}>2.5B views</Text>
          <Text style={styles.hashtagDescription}>
            Show us your best dance moves! Join the challenge.
          </Text>
        </View>
      </View>

      <TouchableOpacity
        style={[styles.followButton, isFollowing && styles.followButtonActive]}
        onPress={() => setIsFollowing(!isFollowing)}
      >
        <Text style={[styles.followButtonText, isFollowing && styles.followButtonTextActive]}>
          {isFollowing ? 'Following' : 'Follow'}
        </Text>
      </TouchableOpacity>

      <FlatList
        data={MOCK_VIDEOS}
        renderItem={renderVideoItem}
        keyExtractor={(item) => item.id}
        numColumns={3}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.videoGrid}
      />
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
  backIcon: {
    color: tokens.colors.white,
    fontSize: 24,
  },
  headerTitle: {
    color: tokens.colors.white,
    fontSize: tokens.typography.title.fontSize,
    fontWeight: '700',
  },
  shareIcon: {
    color: tokens.colors.white,
    fontSize: 22,
  },
  hashtagInfo: {
    flexDirection: 'row',
    paddingHorizontal: tokens.spacing.md,
    paddingVertical: tokens.spacing.md,
    gap: tokens.spacing.md,
  },
  hashtagIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: tokens.colors.elevated,
    justifyContent: 'center',
    alignItems: 'center',
  },
  hashtagEmoji: {
    fontSize: 28,
    color: tokens.colors.white,
    fontWeight: '700',
  },
  hashtagStats: {
    flex: 1,
    gap: 2,
  },
  hashtagName: {
    color: tokens.colors.white,
    fontSize: tokens.typography.subhead.fontSize,
    fontWeight: '700',
  },
  hashtagViews: {
    color: tokens.colors.text.secondary,
    fontSize: tokens.typography.body.fontSize,
  },
  hashtagDescription: {
    color: tokens.colors.text.secondary,
    fontSize: tokens.typography.body.fontSize,
    marginTop: tokens.spacing.xs,
  },
  followButton: {
    marginHorizontal: tokens.spacing.md,
    marginBottom: tokens.spacing.md,
    backgroundColor: tokens.colors.brand.primary,
    borderRadius: tokens.radius.sm,
    paddingVertical: tokens.spacing.sm,
    alignItems: 'center',
  },
  followButtonActive: {
    backgroundColor: tokens.colors.elevated,
    borderWidth: 1,
    borderColor: tokens.colors.surface,
  },
  followButtonText: {
    color: tokens.colors.white,
    fontSize: tokens.typography.body.fontSize,
    fontWeight: '700',
  },
  followButtonTextActive: {
    color: tokens.colors.text.secondary,
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
  },
  videoViews: {
    color: tokens.colors.white,
    fontSize: tokens.typography.caption.fontSize,
    fontWeight: '600',
  },
});
