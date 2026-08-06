import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, FlatList, Image, Dimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { tokens } from '@/theme/tokens';
import { useNavigation } from '@/navigation/NavigationContext';
import { shareText } from '@/services/share';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const VIDEO_SIZE = (SCREEN_WIDTH - 4) / 3;

interface VideoGridItem {
  id: string;
  thumbnailUrl: string;
  viewsCount: string;
}

const MOCK_VIDEOS: VideoGridItem[] = Array.from({ length: 18 }, (_, i) => ({
  id: `sound-video-${i}`,
  thumbnailUrl: `https://picsum.photos/200/${400 + i}`,
  viewsCount: `${Math.floor(Math.random() * 300 + 20)}K`,
}));

export const SoundScreen: React.FC = () => {
  const insets = useSafeAreaInsets();
  const nav = useNavigation();
  const [isBookmarked, setIsBookmarked] = useState(false);

  const renderVideoItem = ({ item }: { item: VideoGridItem }) => (
    <TouchableOpacity style={styles.videoItem} onPress={() => nav.push('feed.foryou')}>

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
        <Text style={styles.headerTitle}>Sound</Text>
        <TouchableOpacity onPress={() => shareText('Découvre ce son original sur TikTok Clone')}>
          <Text style={styles.shareIcon}>↗</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.soundInfo}>
        <Image
          source={{ uri: 'https://picsum.photos/80/80' }}
          style={styles.soundCover}
        />
        <View style={styles.soundDetails}>
          <Text style={styles.soundTitle}>Original Sound</Text>
          <Text style={styles.soundArtist}>@artist_name</Text>
          <Text style={styles.soundUsage}>1.2M videos</Text>
        </View>
      </View>

      <View style={styles.actionRow}>
        <TouchableOpacity
          style={[styles.bookmarkButton, isBookmarked && styles.bookmarkButtonActive]}
          onPress={() => setIsBookmarked(!isBookmarked)}
        >
          <Text style={styles.bookmarkIcon}>{isBookmarked ? '🔖' : '📑'}</Text>
          <Text style={[styles.bookmarkText, isBookmarked && styles.bookmarkTextActive]}>
            {isBookmarked ? 'Saved' : 'Add to Favorites'}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.useButton} onPress={() => nav.push('create.record')}>
          <Text style={styles.useButtonText}>Use this sound</Text>
        </TouchableOpacity>
      </View>

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
  soundInfo: {
    flexDirection: 'row',
    paddingHorizontal: tokens.spacing.md,
    paddingVertical: tokens.spacing.md,
    gap: tokens.spacing.md,
    alignItems: 'center',
  },
  soundCover: {
    width: 72,
    height: 72,
    borderRadius: tokens.radius.sm,
  },
  soundDetails: {
    flex: 1,
    gap: 2,
  },
  soundTitle: {
    color: tokens.colors.white,
    fontSize: tokens.typography.title.fontSize,
    fontWeight: '700',
  },
  soundArtist: {
    color: tokens.colors.text.secondary,
    fontSize: tokens.typography.body.fontSize,
  },
  soundUsage: {
    color: tokens.colors.text.tertiary,
    fontSize: tokens.typography.caption.fontSize,
    marginTop: tokens.spacing.xs,
  },
  actionRow: {
    flexDirection: 'row',
    paddingHorizontal: tokens.spacing.md,
    marginBottom: tokens.spacing.md,
    gap: tokens.spacing.sm,
  },
  bookmarkButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: tokens.spacing.xs,
    paddingVertical: tokens.spacing.sm,
    borderRadius: tokens.radius.sm,
    backgroundColor: tokens.colors.elevated,
  },
  bookmarkButtonActive: {
    backgroundColor: tokens.colors.brand.primary + '20',
  },
  bookmarkIcon: {
    fontSize: 16,
  },
  bookmarkText: {
    color: tokens.colors.white,
    fontSize: tokens.typography.body.fontSize,
    fontWeight: '500',
  },
  bookmarkTextActive: {
    color: tokens.colors.brand.primary,
  },
  useButton: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: tokens.spacing.sm,
    borderRadius: tokens.radius.sm,
    backgroundColor: tokens.colors.brand.primary,
  },
  useButtonText: {
    color: tokens.colors.white,
    fontSize: tokens.typography.body.fontSize,
    fontWeight: '700',
  },
  videoGrid: {
    gap: 2,
    // The shared tab bar overlays the child route; leave the last row scrollable above it.
    paddingBottom: 96,
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
