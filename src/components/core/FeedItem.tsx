import React, { useCallback, useState } from 'react';
import { View, Text, StyleSheet, Dimensions, TouchableOpacity, Image } from 'react-native';
import { tokens } from '@/theme/tokens';
import { Video } from '@/types';
import { VideoPlayer } from './VideoPlayer';
import { RightActionBar } from './RightActionBar';
import { DoubleTapHeart } from './DoubleTapHeart';
import { useDoubleTap } from '@/hooks/useDoubleTap';
import { useFeedStore } from '@/store/feedStore';
import { getProductById, formatPrice } from '@/services/demoShop';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

interface FeedItemProps {
  video: Video;
  isActive: boolean;
  onCommentPress: () => void;
  onSharePress: () => void;
  onProfilePress: (userId: string) => void;
  onProductPress?: (productId: string) => void;
}

export const FeedItem: React.FC<FeedItemProps> = ({
  video,
  isActive,
  onCommentPress,
  onSharePress,
  onProfilePress,
  onProductPress,
}) => {
  const { toggleLike, toggleSave, toggleFollow } = useFeedStore();
  const [isPaused, setIsPaused] = useState(false);
  const [heartVisible, setHeartVisible] = useState(false);
  const [heartPosition, setHeartPosition] = useState({ x: 0, y: 0 });

  const handleDoubleTap = useCallback(
    (event: { nativeEvent: { locationX: number; locationY: number } }) => {
      const { locationX, locationY } = event.nativeEvent;
      setHeartPosition({ x: locationX, y: locationY });
      setHeartVisible(true);
      if (!video.isLiked) {
        toggleLike(video.id);
      }
    },
    [video.id, video.isLiked, toggleLike]
  );

  const handleSingleTap = useCallback(() => {
    setIsPaused((prev) => !prev);
  }, []);

  const { onPress } = useDoubleTap({
    onSingleTap: handleSingleTap,
    onDoubleTap: handleDoubleTap as (event: unknown) => void,
    maxDelay: 300,
    excludeRight: true,
  });

  const handleHeartAnimationEnd = useCallback(() => {
    setHeartVisible(false);
  }, []);

  return (
    <View style={styles.container}>
      <VideoPlayer
        uri={video.videoUrl}
        isActive={isActive}
        isPaused={isPaused}
        onPress={onPress}
      />

      <DoubleTapHeart
        isVisible={heartVisible}
        x={heartPosition.x}
        y={heartPosition.y}
        onAnimationEnd={handleHeartAnimationEnd}
      />

      <RightActionBar
        video={video}
        onLike={() => toggleLike(video.id)}
        onComment={onCommentPress}
        onShare={onSharePress}
        onSave={() => toggleSave(video.id)}
        onAvatarPress={() => onProfilePress(video.user.id)}
      />

      <View style={styles.infoOverlay}>
        <TouchableOpacity onPress={() => onProfilePress(video.user.id)}>
          <Text style={styles.username}>@{video.user.username}</Text>
        </TouchableOpacity>
        <Text style={styles.description} numberOfLines={2}>
          {video.description}
        </Text>
        {video.productId && (() => {
          const product = getProductById(video.productId);
          if (!product) return null;
          return (
            <TouchableOpacity
              style={styles.productPill}
              activeOpacity={0.85}
              onPress={() => onProductPress?.(product.id)}
            >
              <Image source={{ uri: product.images[0] }} style={styles.productThumb} />
              <View style={styles.productInfo}>
                <Text style={styles.productTitle} numberOfLines={1}>{product.title}</Text>
                <Text style={styles.productPrice}>{formatPrice(product.price)}</Text>
              </View>
              <View style={styles.productCta}>
                <Text style={styles.productCtaText}>Acheter</Text>
              </View>
            </TouchableOpacity>
          );
        })()}
        {video.hashtags.length > 0 && (
          <View style={styles.hashtagRow}>
            {video.hashtags.slice(0, 3).map((tag) => (
              <Text key={tag.id} style={styles.hashtag}>
                #{tag.name}
              </Text>
            ))}
          </View>
        )}
        {video.sound && (
          <View style={styles.soundRow}>
            <Text style={styles.soundIcon}>♪</Text>
            <Text style={styles.soundText} numberOfLines={1}>
              {video.sound.title} - {video.sound.artist}
            </Text>
          </View>
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    width: SCREEN_WIDTH,
    height: SCREEN_HEIGHT,
    backgroundColor: tokens.colors.black,
  },
  infoOverlay: {
    position: 'absolute',
    bottom: 100,
    left: tokens.feed.infoPadding,
    right: tokens.feed.rightBarWidth + tokens.spacing.lg,
    gap: tokens.spacing.xs,
  },
  username: {
    color: tokens.colors.white,
    fontSize: tokens.typography.subhead.fontSize,
    fontWeight: '700',
  },
  description: {
    color: tokens.colors.white,
    fontSize: tokens.typography.body.fontSize,
    lineHeight: tokens.typography.body.lineHeight,
  },
  hashtagRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: tokens.spacing.xs,
  },
  hashtag: {
    color: tokens.colors.white,
    fontSize: tokens.typography.body.fontSize,
    fontWeight: '600',
  },
  soundRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.spacing.xs,
    marginTop: tokens.spacing.xs,
  },
  soundIcon: {
    color: tokens.colors.white,
    fontSize: 14,
  },
  soundText: {
    color: tokens.colors.white,
    fontSize: tokens.typography.body.fontSize,
    flex: 1,
  },
  productPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.spacing.sm,
    backgroundColor: 'rgba(0,0,0,0.55)',
    borderRadius: tokens.radius.sm,
    padding: 6,
    marginTop: tokens.spacing.sm,
    alignSelf: 'flex-start',
    maxWidth: '100%',
  },
  productThumb: {
    width: 40,
    height: 40,
    borderRadius: tokens.radius.xs,
    backgroundColor: tokens.colors.surface,
  },
  productInfo: { flex: 1, minWidth: 0 },
  productTitle: { color: tokens.colors.white, fontSize: tokens.typography.caption.fontSize, fontWeight: '600' },
  productPrice: { color: tokens.colors.brand.primary, fontSize: tokens.typography.body.fontSize, fontWeight: '800', marginTop: 1 },
  productCta: {
    backgroundColor: tokens.colors.brand.primary,
    borderRadius: tokens.radius.xs,
    paddingHorizontal: tokens.spacing.sm,
    paddingVertical: 6,
  },
  productCtaText: { color: tokens.colors.white, fontSize: tokens.typography.caption.fontSize, fontWeight: '800' },
});
