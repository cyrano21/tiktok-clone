import React, { useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image } from 'react-native';
import Animated, { useSharedValue, useAnimatedStyle, withSpring, withSequence, withTiming } from 'react-native-reanimated';
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

export const RightActionBar: React.FC<RightActionBarProps> = ({ video, onLike, onComment, onShare, onSave, onAvatarPress, onMore, readOnly = false }) => {
  const likeScale = useSharedValue(1);
  const saveScale = useSharedValue(1);

  const handleLike = useCallback(() => {
    if (readOnly) return;
    likeScale.value = withSequence(withSpring(1.4, { stiffness: 400, damping: 10 }), withSpring(1, tokens.animation.likeSpring));
    onLike();
  }, [likeScale, onLike, readOnly]);

  const handleSave = useCallback(() => {
    if (readOnly) return;
    saveScale.value = withSequence(withTiming(0.8, { duration: 100 }), withSpring(1, { stiffness: 300, damping: 12 }));
    onSave();
  }, [saveScale, onSave, readOnly]);

  const likeAnimatedStyle = useAnimatedStyle(() => ({ transform: [{ scale: likeScale.value }] }));
  const saveAnimatedStyle = useAnimatedStyle(() => ({ transform: [{ scale: saveScale.value }] }));
  const formatCount = (count: number): string => count >= 1_000_000 ? `${(count / 1_000_000).toFixed(1)}M` : count >= 1000 ? `${(count / 1000).toFixed(1)}K` : count.toString();

  return (
    <View style={styles.container}>
      <TouchableOpacity style={styles.avatarContainer} onPress={onAvatarPress} disabled={readOnly}>
        {video.user.avatarUrl ? <Image source={{ uri: video.user.avatarUrl }} style={styles.avatar} /> : <View style={[styles.avatar, styles.avatarFallback]} />}
        {!readOnly && !video.user.isFollowing ? <View style={styles.followBadge}><Text style={styles.followBadgeText}>+</Text></View> : null}
      </TouchableOpacity>

      <AnimatedTouchable style={[styles.actionButton, likeAnimatedStyle, readOnly && styles.disabled]} onPress={handleLike} disabled={readOnly} accessibilityLabel={readOnly ? 'Like indisponible pour une référence externe' : 'Aimer'}>
        <Text style={[styles.actionIcon, video.isLiked && styles.likedIcon]}>♥</Text><Text style={styles.actionCount}>{formatCount(video.likesCount)}</Text>
      </AnimatedTouchable>

      <TouchableOpacity style={styles.actionButton} onPress={onComment}><Text style={styles.actionIcon}>💬</Text><Text style={styles.actionCount}>{formatCount(video.commentsCount)}</Text></TouchableOpacity>

      <AnimatedTouchable style={[styles.actionButton, saveAnimatedStyle, readOnly && styles.disabled]} onPress={handleSave} disabled={readOnly} accessibilityLabel={readOnly ? 'Sauvegarde indisponible pour une référence externe' : 'Sauvegarder'}>
        <Text style={[styles.actionIcon, video.isSaved && styles.savedIcon]}>🔖</Text><Text style={styles.actionCount}>{formatCount(video.savesCount)}</Text>
      </AnimatedTouchable>

      <TouchableOpacity style={styles.actionButton} onPress={onShare}><Text style={styles.actionIcon}>↗</Text><Text style={styles.actionCount}>{formatCount(video.sharesCount)}</Text></TouchableOpacity>

      {!readOnly ? <TouchableOpacity style={styles.actionButton} onPress={onMore} accessibilityLabel="Sécurité et signalement"><Text style={styles.moreIcon}>•••</Text></TouchableOpacity> : <View style={styles.readOnlyBadge}><Text style={styles.readOnlyText}>EXT</Text></View>}

      {video.sound ? <div className="disc-spin" style={{ width: 40, height: 40, borderRadius: 20, overflow: 'hidden', marginTop: tokens.spacing.sm, borderWidth: 6, borderStyle: 'solid', borderColor: tokens.colors.elevated }}><img src={video.sound.coverUrl} style={{ width: '100%', height: '100%', objectFit: 'cover' }} alt="" /></div> : null}
    </View>
  );
};

const styles = StyleSheet.create({
  container: { position: 'absolute', right: tokens.spacing.sm, bottom: 100, alignItems: 'center', gap: tokens.spacing.md },
  avatarContainer: { marginBottom: tokens.spacing.md, position: 'relative' },
  avatar: { width: 48, height: 48, borderRadius: tokens.radius.full, borderWidth: 2, borderColor: tokens.colors.white },
  avatarFallback: { backgroundColor: tokens.colors.elevated },
  followBadge: { position: 'absolute', bottom: -6, alignSelf: 'center', width: 20, height: 20, borderRadius: 10, backgroundColor: tokens.colors.brand.primary, justifyContent: 'center', alignItems: 'center' },
  followBadgeText: { color: tokens.colors.white, fontSize: 14, fontWeight: '700' },
  actionButton: { alignItems: 'center', gap: 2 },
  disabled: { opacity: 0.45 },
  actionIcon: { fontSize: tokens.feed.rightBarIconSize, color: tokens.colors.white },
  moreIcon: { color: tokens.colors.white, fontSize: 22, fontWeight: '900', letterSpacing: 1 },
  likedIcon: { color: tokens.colors.action.like },
  savedIcon: { color: tokens.colors.action.tip },
  actionCount: { color: tokens.colors.white, fontSize: tokens.typography.caption.fontSize, fontWeight: '600' },
  readOnlyBadge: { minWidth: 34, borderRadius: 999, backgroundColor: 'rgba(255,255,255,0.14)', paddingHorizontal: 7, paddingVertical: 5, alignItems: 'center' },
  readOnlyText: { color: tokens.colors.text.secondary, fontSize: 9, fontWeight: '900', letterSpacing: 1 },
});
