import React, { useCallback, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { tokens } from '@/theme/tokens';
import { Video } from '@/types';

interface RightActionBarProps {
  video: Video;
  onLike: () => void;
  onComment: () => void;
  onShare: () => void;
  onSave: () => void;
  onAvatarPress: () => void;
  onMore: () => void;
  readOnly?: boolean;
}

const AnimatedTouchable = Animated.createAnimatedComponent(TouchableOpacity);

export const RightActionBar: React.FC<RightActionBarProps> = ({
  video,
  onLike,
  onComment,
  onShare,
  onSave,
  onAvatarPress,
  onMore,
  readOnly = false,
}) => {
  const likeScale = useSharedValue(1);
  const saveScale = useSharedValue(1);
  const [shareCopied, setShareCopied] = useState(false);

  const handleLike = useCallback(() => {
    likeScale.value = withSequence(
      withSpring(1.4, { stiffness: 400, damping: 10 }),
      withSpring(1, tokens.animation.likeSpring)
    );
    onLike();
  }, [likeScale, onLike]);

  const handleSave = useCallback(() => {
    saveScale.value = withSequence(
      withTiming(0.8, { duration: 100 }),
      withSpring(1, { stiffness: 300, damping: 12 })
    );
    onSave();
  }, [saveScale, onSave]);

  const handleShare = useCallback(() => {
    onShare();
    setShareCopied(true);
    setTimeout(() => setShareCopied(false), 1600);
  }, [onShare]);

  const likeAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: likeScale.value }],
  }));

  const saveAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: saveScale.value }],
  }));

  const formatCount = (count: number): string => {
    if (count >= 1000000) return `${(count / 1000000).toFixed(1)}M`;
    if (count >= 1000) return `${(count / 1000).toFixed(1)}K`;
    return count.toString();
  };

  return (
    <View style={styles.container}>
      <TouchableOpacity style={styles.avatarContainer} onPress={onAvatarPress}>
        <Image source={{ uri: video.user.avatarUrl }} style={styles.avatar} />
        {!readOnly && !video.user.isFollowing && <View style={styles.followBadge}><Text style={styles.followBadgeText}>+</Text></View>}
      </TouchableOpacity>

      {!readOnly ? (
        <AnimatedTouchable style={[styles.actionButton, likeAnimatedStyle]} onPress={handleLike}>
          <Text style={[styles.actionIcon, video.isLiked && styles.likedIcon]}>♥</Text>
          <Text style={styles.actionCount}>{formatCount(video.likesCount)}</Text>
        </AnimatedTouchable>
      ) : null}

      <TouchableOpacity
        style={styles.actionButton}
        onPress={onComment}
        accessibilityRole="button"
        accessibilityLabel="Ouvrir les commentaires"
      >
        <Text style={styles.actionIcon}>💬</Text>
        <Text style={styles.actionCount}>{formatCount(video.commentsCount)}</Text>
      </TouchableOpacity>

      {!readOnly ? (
        <AnimatedTouchable style={[styles.actionButton, saveAnimatedStyle]} onPress={handleSave}>
          <Text style={[styles.actionIcon, video.isSaved && styles.savedIcon]}>🔖</Text>
          <Text style={styles.actionCount}>{formatCount(video.savesCount)}</Text>
        </AnimatedTouchable>
      ) : null}

      <TouchableOpacity style={styles.actionButton} onPress={handleShare}>
        <Text style={styles.actionIcon}>{shareCopied ? '✓' : '↗'}</Text>
        <Text style={styles.actionCount}>{shareCopied ? 'Copié' : formatCount(video.sharesCount)}</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.actionButton}
        onPress={onMore}
        accessibilityLabel={readOnly ? "Ouvrir la source TikTok" : "Sécurité et signalement"}
      >
        <Text style={styles.moreIcon}>{readOnly ? '↗' : '•••'}</Text>
      </TouchableOpacity>

      {video.sound && (
        <div className="disc-spin" style={{
          width: 40,
          height: 40,
          borderRadius: 20,
          overflow: 'hidden',
          marginTop: tokens.spacing.sm,
          borderWidth: 6,
          borderStyle: 'solid',
          borderColor: tokens.colors.elevated,
        }}>
          <img src={video.sound.coverUrl} style={{
            width: '100%',
            height: '100%',
            objectFit: 'cover',
          }} alt="" />
        </div>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    right: tokens.spacing.sm,
    bottom: 100,
    alignItems: 'center',
    gap: tokens.spacing.md,
  },
  avatarContainer: {
    marginBottom: tokens.spacing.md,
    position: 'relative',
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: tokens.radius.full,
    borderWidth: 2,
    borderColor: tokens.colors.white,
  },
  followBadge: {
    position: 'absolute',
    bottom: -6,
    alignSelf: 'center',
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: tokens.colors.brand.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  followBadgeText: {
    color: tokens.colors.white,
    fontSize: 14,
    fontWeight: '700',
  },
  actionButton: {
    alignItems: 'center',
    gap: 2,
  },
  actionIcon: {
    fontSize: tokens.feed.rightBarIconSize,
    color: tokens.colors.white,
  },
  moreIcon: {
    color: tokens.colors.white,
    fontSize: 22,
    fontWeight: '900',
    letterSpacing: 1,
  },
  likedIcon: {
    color: tokens.colors.action.like,
  },
  savedIcon: {
    color: tokens.colors.action.tip,
  },
  actionCount: {
    color: tokens.colors.white,
    fontSize: tokens.typography.caption.fontSize,
    fontWeight: '600',
  },
  soundDisc: {
    width: 40,
    height: 40,
    borderRadius: 20,
    overflow: 'hidden',
    marginTop: tokens.spacing.sm,
    borderWidth: 6,
    borderColor: tokens.colors.elevated,
  },
  soundDiscImage: {
    width: '100%',
    height: '100%',
  },
  soundDiscSpin: {
    animationKeyframes: {
      '0%': { transform: [{ rotate: '0deg' }] },
      '100%': { transform: [{ rotate: '360deg' }] },
    },
    animationDuration: '3000ms',
    animationIterationCount: 'infinite',
    animationTimingFunction: 'linear',
  } as any,
});
