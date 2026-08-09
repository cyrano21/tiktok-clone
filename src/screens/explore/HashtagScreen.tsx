import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, FlatList, Image, Dimensions, ActivityIndicator } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { tokens } from '@/theme/tokens';
import { useNavigation, useRouteParams } from '@/navigation/NavigationContext';
import { shareText } from '@/services/share';
import type { Video } from '@/types';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const VIDEO_SIZE = (SCREEN_WIDTH - 4) / 3;

interface VideoGridItem {
  id: string;
  thumbnailUrl: string;
  viewsCount: string;
}

function formatViews(value: number): string {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1).replace('.0', '')}M`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(1).replace('.0', '')}K`;
  return String(value);
}

function toGridItem(video: Video): VideoGridItem {
  return {
    id: video.id,
    thumbnailUrl: video.thumbnailUrl,
    viewsCount: formatViews(video.viewsCount),
  };
}

export const HashtagScreen: React.FC = () => {
  const insets = useSafeAreaInsets();
  const nav = useNavigation();
  const params = useRouteParams<{ tag?: string }>();
  const tag = (params.tag ?? 'fyp').replace(/^#/, '');
  const [isFollowing, setIsFollowing] = useState(false);
  const [videos, setVideos] = useState<Video[]>([]);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setFailed(false);
    try {
      const { scraperBridge } = await import('@/services/scraperBridge');
      const all = await scraperBridge.getVideos(60);
      if (!all.length) {
        setVideos([]);
        return;
      }
      // Prefer videos whose hashtags match the tag; fall back to the full
      // catalog so a healthy scraper never renders an empty grid.
      const normalized = tag.toLowerCase();
      const matched = all.filter((video) =>
        (video.hashtags ?? []).some((h) => h.name.toLowerCase().includes(normalized))
        || video.description.toLowerCase().includes(normalized),
      );
      setVideos((matched.length ? matched : all).slice(0, 24));
    } catch {
      setFailed(true);
      setVideos([]);
    } finally {
      setLoading(false);
    }
  }, [tag]);

  useEffect(() => {
    void load();
  }, [load]);

  const totalViews = useMemo(() => videos.reduce((sum, v) => sum + (v.viewsCount ?? 0), 0), [videos]);

  const renderVideoItem = ({ item }: { item: VideoGridItem }) => (
    <TouchableOpacity style={styles.videoItem} onPress={() => nav.push('video.detail', { videoId: item.id })}>
      <Image source={{ uri: item.thumbnailUrl }} style={styles.videoThumbnail} resizeMode="cover" />
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
        <TouchableOpacity onPress={() => shareText(`Découvre le hashtag #${tag}`)}>
          <Text style={styles.shareIcon}>↗</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.hashtagInfo}>
        <View style={styles.hashtagIcon}>
          <Text style={styles.hashtagEmoji}>#</Text>
        </View>
        <View style={styles.hashtagStats}>
          <Text style={styles.hashtagName}>#{tag}</Text>
          <Text style={styles.hashtagViews}>
            {loading ? 'Chargement…' : failed ? 'Indisponible' : `${formatViews(totalViews)} vues · ${videos.length} vidéos`}
          </Text>
          <Text style={styles.hashtagDescription}>
            {failed ? 'Impossible de charger les vidéos de ce hashtag pour le moment.' : 'Vidéos réelles issues du flux TikTok observé.'}
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

      {loading ? (
        <View style={styles.stateContainer}>
          <ActivityIndicator color={tokens.colors.brand.primary} />
          <Text style={styles.stateText}>Chargement des vidéos…</Text>
        </View>
      ) : videos.length === 0 ? (
        <View style={styles.stateContainer}>
          <Text style={styles.stateText}>Aucune vidéo pour ce hashtag pour le moment.</Text>
          <TouchableOpacity style={styles.retryButton} onPress={() => void load()}>
            <Text style={styles.retryText}>Réessayer</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={videos.map(toGridItem)}
          renderItem={renderVideoItem}
          keyExtractor={(item) => item.id}
          numColumns={3}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.videoGrid}
        />
      )}
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
  stateContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: tokens.spacing.sm,
    padding: tokens.spacing.xl,
  },
  stateText: {
    color: tokens.colors.text.secondary,
    textAlign: 'center',
    fontSize: tokens.typography.body.fontSize,
  },
  retryButton: {
    backgroundColor: tokens.colors.brand.primary,
    paddingHorizontal: tokens.spacing.lg,
    paddingVertical: tokens.spacing.sm,
    borderRadius: tokens.radius.sm,
  },
  retryText: {
    color: tokens.colors.white,
    fontWeight: '700',
  },
});
