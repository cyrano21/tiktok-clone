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
  onFollow?: () => void;
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
  onFollow,
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
  const observedCount = (key: keyof NonNullable<Video['metricAvailability']>, count: number): string | null => {
    // Native ORKY videos predate metricAvailability and their counters are
    // canonical. External observations must explicitly provide a counter before
    // it is rendered; a zero here must not look like an observed provider value.
    if (readOnly && video.metricAvailability?.[key] === false) return null;
    return formatCount(count);
  };

  return (
    <View style={styles.container}>
      <View style={styles.avatarContainer}>
        <TouchableOpacity onPress={onAvatarPress} accessibilityRole="button" accessibilityLabel={`Ouvrir le profil de @${video.user.username}`}>
          <Image source={{ uri: video.user.avatarUrl }} style={styles.avatar} />
        </TouchableOpacity>
        {!readOnly && !video.user.isFollowing && (
          <TouchableOpacity
            style={styles.followBadge}
            onPress={onFollow}
            accessibilityRole="button"
            accessibilityLabel={`Suivre @${video.user.username}`}
          >
            <Text style={styles.followBadgeText}>+</Text>
          </TouchableOpacity>
        )}
      </View>

      <AnimatedTouchable
        style={[styles.actionButton, likeAnimatedStyle, readOnly && styles.readOnlyAction]}
        onPress={readOnly ? undefined : handleLike}
        disabled={readOnly}
        accessibilityLabel={readOnly ? 'Likes observés (lecture seule)' : 'Aimer la vidéo'}
      >
        <Text style={[styles.actionIcon, video.isLiked && styles.likedIcon]}>♥</Text>
        {observedCount('likes', video.likesCount) !== null ? <Text style={styles.actionCount}>{observedCount('likes', video.likesCount)}</Text> : null}
      </AnimatedTouchable>

      <TouchableOpacity
        style={styles.actionButton}
        onPress={onComment}
        accessibilityRole="button"
        accessibilityLabel="Ouvrir les commentaires"
      >
        <Text style={styles.actionIcon}>💬</Text>
        {observedCount('comments', video.commentsCount) !== null ? <Text style={styles.actionCount}>{observedCount('comments', video.commentsCount)}</Text> : null}
      </TouchableOpacity>

      <AnimatedTouchable
        style={[styles.actionButton, saveAnimatedStyle, readOnly && styles.readOnlyAction]}
        onPress={readOnly ? undefined : handleSave}
        disabled={readOnly}
        accessibilityLabel={readOnly ? 'Enregistrements observés (lecture seule)' : 'Enregistrer la vidéo'}
      >
        <Text style={[styles.actionIcon, video.isSaved && styles.savedIcon]}>🔖</Text>
        {observedCount('saves', video.savesCount) !== null ? <Text style={styles.actionCount}>{observedCount('saves', video.savesCount)}</Text> : null}
      </AnimatedTouchable>

      <TouchableOpacity style={styles.actionButton} onPress={handleShare}>
        <Text style={styles.actionIcon}>{shareCopied ? '✓' : '↗'}</Text>
        <Text style={styles.actionCount}>{shareCopied ? 'Copié' : (observedCount('shares', video.sharesCount) ?? 'Partager')}</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.actionButton}
        onPress={onMore}
        accessibilityLabel={readOnly ? "Ouvrir la source TikTok" : "Sécurité et signalement"}
      >
        <Text style={styles.moreIcon}>{readOnly ? '↗' : '•••'}</Text>
      </TouchableOpacity>

      {video.sound && (
        <View style={styles.soundDisc} accessibilityLabel={`Son ${video.sound.title}`}>
          <Image source={{ uri: video.sound.coverUrl }} style={styles.soundDiscImage} />
        </View>
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
  readOnlyAction: {
    opacity: 0.92,
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
