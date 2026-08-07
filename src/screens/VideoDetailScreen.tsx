import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, Dimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { tokens } from '@/theme/tokens';
import { useNavigation, useRouteParams } from '@/navigation/NavigationContext';
import { FeedItem } from '@/components/core/FeedItem';
import { feedService } from '@/services/feedService';
import { getDemoFeed } from '@/services/demoFeed';
import type { Video } from '@/types';

const USE_DEMO = true;

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

/** Build a single demo video seeded from the videoId so it's deterministic. */
function buildDemoVideo(videoId: string): Video {
  const seed = videoId.split('').reduce((sum, ch) => sum + ch.charCodeAt(0), 0);
  const feed = getDemoFeed(seed % 20 + 1);
  return feed.videos[seed % feed.videos.length];
}

export const VideoDetailScreen: React.FC = () => {
  const insets = useSafeAreaInsets();
  const nav = useNavigation();
  const { videoId } = useRouteParams<{ videoId?: string }>();

  const [video, setVideo] = useState<Video | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      if (!videoId) {
        setError('Vidéo introuvable.');
        setLoading(false);
        return;
      }

      setLoading(true);
      setError(null);
      try {
        const result = await feedService.getVideoById(videoId);
        if (!cancelled) setVideo(result);
      } catch {
        // Only show demo data when explicitly in demo mode, otherwise surface the real error.
        if (USE_DEMO) {
          if (!cancelled) setVideo(buildDemoVideo(videoId));
        } else {
          if (!cancelled) setError('Impossible de charger cette vidéo.');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    void load();
    return () => {
      cancelled = true;
    };
  }, [videoId]);

  if (!videoId) {
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <Text style={styles.errorText}>Vidéo introuvable.</Text>
        <TouchableOpacity style={styles.backBtn} onPress={() => nav.back()}>
          <Text style={styles.backText}>← Retour</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (loading) {
    return (
      <View style={[styles.container, styles.center]}>
        <ActivityIndicator color={tokens.colors.brand.primary} size="large" />
        <Text style={styles.loadingText}>Chargement…</Text>
      </View>
    );
  }

  if (error || !video) {
    return (
      <View style={[styles.container, styles.center, { paddingTop: insets.top }]}>
        <Text style={styles.errorText}>{error ?? 'Vidéo introuvable.'}</Text>
        <TouchableOpacity style={styles.backBtn} onPress={() => nav.back()}>
          <Text style={styles.backText}>← Retour</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <FeedItem
        video={video}
        isActive
        itemHeight={SCREEN_HEIGHT}
        onCommentPress={() =>
          nav.push('video.comments', { postId: video.id, count: video.commentsCount })
        }
        onSharePress={() => nav.push('inbox')}
        onProfilePress={() => nav.push('profile')}
        onProductPress={(productId) => nav.push('shop.product', { productId })}
      />

      {/* Close button overlay */}
      <TouchableOpacity
        style={[styles.closeBtn, { top: insets.top + 8 }]}
        onPress={() => nav.back()}
        hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
      >
        <Text style={styles.closeIcon}>✕</Text>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: tokens.colors.black,
  },
  center: {
    justifyContent: 'center',
    alignItems: 'center',
    gap: tokens.spacing.md,
  },
  loadingText: {
    color: tokens.colors.text.secondary,
    fontSize: tokens.typography.body.fontSize,
  },
  errorText: {
    color: tokens.colors.semantic.error,
    fontSize: tokens.typography.body.fontSize,
    textAlign: 'center',
    paddingHorizontal: tokens.spacing.xl,
  },
  backBtn: {
    marginTop: tokens.spacing.lg,
    paddingHorizontal: tokens.spacing.lg,
    paddingVertical: tokens.spacing.sm,
    backgroundColor: tokens.colors.elevated,
    borderRadius: tokens.radius.sm,
  },
  backText: {
    color: tokens.colors.white,
    fontWeight: '700',
  },
  closeBtn: {
    position: 'absolute',
    left: tokens.spacing.md,
    zIndex: 20,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeIcon: {
    color: tokens.colors.white,
    fontSize: 18,
    fontWeight: '700',
  },
});
