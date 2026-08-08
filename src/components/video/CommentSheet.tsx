import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  TextInput,
  Dimensions,
  Pressable,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { useSharedValue, useAnimatedStyle, withTiming, Easing } from 'react-native-reanimated';
import { tokens } from '@/theme/tokens';
import { useSessionStore } from '@/store/sessionStore';
import { feedService } from '@/services/feedService';
import { VideoPlayer } from '@/components/core/VideoPlayer';
import type { Comment, Video } from '@/types';

const { height: SCREEN_HEIGHT, width: SCREEN_WIDTH } = Dimensions.get('window');

const VIDEO_RATIO = 0.38; // La vidéo réduite occupe ~38 % de la hauteur, comme TikTok
const PANEL_RATIO = 0.62;

function formatLikes(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1).replace('.0', '')}M`;
  if (n >= 1000) return `${(n / 1000).toFixed(1).replace('.0', '')}k`;
  return String(n);
}

function formatTime(iso: string): string {
  const timestamp = new Date(iso).getTime();
  if (!Number.isFinite(timestamp)) return '';
  const seconds = Math.max(0, Math.floor((Date.now() - timestamp) / 1000));
  if (seconds < 60) return "À l'instant";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `Il y a ${minutes} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `Il y a ${hours} h`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `Il y a ${days} j`;
  return new Date(timestamp).toLocaleDateString('fr-FR');
}

type ReplyTarget = { id: string; username: string };

interface CommentSheetProps {
  video: Video;
  /** ID used by the real comments endpoint when it differs from the view model ID. */
  commentVideoId?: string;
  onClose: () => void;
}

export const CommentSheet: React.FC<CommentSheetProps> = ({ video, commentVideoId, onClose }) => {
  const insets = useSafeAreaInsets();
  const session = useSessionStore((s) => s);

  // Le panneau est positionné en bas par le layout. La valeur initiale à zéro
  // évite que React Native Web le laisse hors écran avant la première frame.
  const panelY = useSharedValue(0);
  const backdropOpacity = useSharedValue(0);

  const [query, setQuery] = useState('');
  const [text, setText] = useState('');
  const [comments, setComments] = useState<Comment[]>([]);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [replyTo, setReplyTo] = useState<ReplyTarget | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [loadingReplies, setLoadingReplies] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<TextInput | null>(null);
  const scrollRef = useRef<ScrollView | null>(null);

  const videoHeight = SCREEN_HEIGHT * VIDEO_RATIO;
  const panelHeight = SCREEN_HEIGHT * PANEL_RATIO;

  // Animation d'entrée : le panneau glisse depuis le bas, le backdrop s'assombrit
  useEffect(() => {
    panelY.value = 0;
    backdropOpacity.value = withTiming(0.85, { duration: 260 });
  }, [panelY, backdropOpacity]);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const response = await feedService.getComments(commentVideoId ?? video.id, { limit: 50 });
        if (cancelled) return;
        setComments(response.comments);
      } catch (requestError: any) {
        if (!cancelled) {
          setError(requestError?.response?.data?.message || requestError?.message || 'Impossible de charger les commentaires.');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, [commentVideoId, video.id]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return comments;
    return comments.filter(
      (comment) =>
        comment.text.toLowerCase().includes(q) ||
        comment.user.username.toLowerCase().includes(q) ||
        comment.replies.some(
          (reply) => reply.text.toLowerCase().includes(q) || reply.user.username.toLowerCase().includes(q)
        )
    );
  }, [comments, query]);

  const isReadOnly = video.id.startsWith('scraper-') || !video.videoUrl;
  const total = comments.length > 0 ? comments.length : video.commentsCount;


  const handleClose = useCallback(() => {
    panelY.value = withTiming(SCREEN_HEIGHT, { duration: 220, easing: Easing.in(Easing.ease) });
    backdropOpacity.value = withTiming(0, { duration: 220 });
    setTimeout(onClose, 200);
  }, [panelY, backdropOpacity, onClose]);

  const submit = async () => {
    const value = text.trim();
    if (!value || submitting || isReadOnly) return;

    setSubmitting(true);
    setError(null);
    try {
      const created = await feedService.postComment(commentVideoId ?? video.id, value, replyTo?.id);
      if (replyTo) {
        setComments((current) => current.map((comment) =>
          comment.id === replyTo.id
            ? {
                ...comment,
                replies: [...comment.replies, created],
                repliesCount: comment.repliesCount + 1,
              }
            : comment
        ));
        setExpanded((state) => ({ ...state, [replyTo.id]: true }));
        setReplyTo(null);
      } else {
        setComments((current) => [created, ...current]);
        scrollRef.current?.scrollTo({ y: 0, animated: true });
      }
      setText('');
    } catch (requestError: any) {
      setError(requestError?.response?.data?.message || requestError?.message || "Impossible d'envoyer le commentaire.");
    } finally {
      setSubmitting(false);
    }
  };

  const startReply = (commentId: string, username: string) => {
    setReplyTo({ id: commentId, username });
    inputRef.current?.focus();
  };

  const toggleLike = async (commentId: string, replyId?: string) => {
    if (isReadOnly) return;
    const targetId = replyId ?? commentId;
    try {
      const result = await feedService.toggleCommentLike(targetId);
      setComments((current) => current.map((comment) => {
        if (comment.id !== commentId) return comment;
        if (replyId) {
          return {
            ...comment,
            replies: comment.replies.map((reply) =>
              reply.id === replyId
                ? { ...reply, isLiked: result.liked, likesCount: result.likeCount }
                : reply
            ),
          };
        }
        return { ...comment, isLiked: result.liked, likesCount: result.likeCount };
      }));
    } catch (requestError: any) {
      setError(requestError?.response?.data?.message || requestError?.message || 'Impossible de modifier ce like.');
    }
  };

  const toggleReplies = async (comment: Comment) => {
    const isOpen = Boolean(expanded[comment.id]);
    if (isOpen) {
      setExpanded((state) => ({ ...state, [comment.id]: false }));
      return;
    }

    if (comment.replies.length === 0 && comment.repliesCount > 0) {
      setLoadingReplies(comment.id);
      try {
        const replies = await feedService.getCommentReplies(comment.id, { limit: 100 });
        setComments((current) => current.map((item) =>
          item.id === comment.id ? { ...item, replies, repliesCount: replies.length } : item
        ));
      } catch (requestError: any) {
        setError(requestError?.response?.data?.message || requestError?.message || 'Impossible de charger les réponses.');
        setLoadingReplies(null);
        return;
      }
      setLoadingReplies(null);
    }

    setExpanded((state) => ({ ...state, [comment.id]: true }));
  };

  const renderReply = (commentId: string, reply: Comment) => (
    <View key={reply.id} style={styles.replyRow}>
      <Image source={{ uri: reply.user.avatarUrl }} style={styles.replyAvatar} />
      <View style={styles.commentBody}>
        <Text style={styles.username}>@{reply.user.username}</Text>
        <Text style={styles.commentText}>{reply.text}</Text>
        <View style={styles.metaRow}>
          <Text style={styles.metaTime}>{formatTime(reply.createdAt)}</Text>
          <TouchableOpacity onPress={() => startReply(commentId, reply.user.username)}>
            <Text style={styles.metaReply}>Répondre</Text>
          </TouchableOpacity>
        </View>
      </View>
      <TouchableOpacity style={styles.likeCol} onPress={() => void toggleLike(commentId, reply.id)}>
        <Text style={[styles.heart, reply.isLiked && styles.heartActive]}>{reply.isLiked ? '♥' : '♡'}</Text>
        <Text style={styles.likeCount}>{formatLikes(reply.likesCount)}</Text>
      </TouchableOpacity>
    </View>
  );

  const renderComment = (comment: Comment) => {
    const isOpen = Boolean(expanded[comment.id]);
    return (
      <View key={comment.id} style={styles.commentRow}>
        <Image source={{ uri: comment.user.avatarUrl }} style={styles.avatar} />
        <View style={styles.commentBody}>
          <Text style={styles.username}>@{comment.user.username}</Text>
          <Text style={styles.commentText}>{comment.text}</Text>
          <View style={styles.metaRow}>
            <Text style={styles.metaTime}>{formatTime(comment.createdAt)}</Text>
            <TouchableOpacity onPress={() => startReply(comment.id, comment.user.username)}>
              <Text style={styles.metaReply}>Répondre</Text>
            </TouchableOpacity>
          </View>

          {isOpen && comment.replies.map((reply) => renderReply(comment.id, reply))}

          {comment.repliesCount > 0 && (
            <TouchableOpacity style={styles.toggleReplies} onPress={() => void toggleReplies(comment)}>
              <View style={styles.toggleLine} />
              <Text style={styles.toggleRepliesText}>
                {loadingReplies === comment.id
                  ? 'Chargement…'
                  : isOpen
                    ? 'Masquer les réponses ▲'
                    : `Voir ${comment.repliesCount} réponse${comment.repliesCount > 1 ? 's' : ''} ▼`}
              </Text>
            </TouchableOpacity>
          )}
        </View>
        <TouchableOpacity style={styles.likeCol} onPress={() => void toggleLike(comment.id)}>
          <Text style={[styles.heart, comment.isLiked && styles.heartActive]}>{comment.isLiked ? '♥' : '♡'}</Text>
          <Text style={styles.likeCount}>{formatLikes(comment.likesCount)}</Text>
        </TouchableOpacity>
      </View>
    );
  };

  const panelStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: panelY.value }],
  }));

  const backdropStyle = useAnimatedStyle(() => ({
    opacity: backdropOpacity.value,
  }));

  return (
    <View style={styles.overlay}>
      {/* Backdrop : tap pour fermer */}
      <Pressable style={StyleSheet.absoluteFillObject} onPress={handleClose} accessibilityRole="button" {...({ 'aria-label': 'Fermer les commentaires' } as any)}>
        <Animated.View style={[styles.backdrop, backdropStyle]} />
      </Pressable>

      {/* Vidéo réduite en haut — reste en lecture, entière */}
      <View style={[styles.miniVideoWrap, { height: videoHeight }]}>
        {video.videoUrl ? (
          <VideoPlayer uri={video.videoUrl} isActive isPaused={false} resizeMode="contain" />
        ) : (
          <Image source={{ uri: video.thumbnailUrl }} style={styles.miniImage} resizeMode="cover" />
        )}
        <View style={styles.miniOverlay}>
          <Text style={styles.miniUsername} numberOfLines={1}>@{video.user.username}</Text>
          <Text style={styles.miniDescription} numberOfLines={1}>{video.description}</Text>
        </View>
        <TouchableOpacity style={styles.closeBtn} onPress={handleClose} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <Text style={styles.closeText}>✕</Text>
        </TouchableOpacity>
      </View>

      {/* Panneau de commentaires */}
      <Animated.View style={[styles.panel, { height: panelHeight, paddingBottom: insets.bottom || tokens.spacing.sm }, panelStyle]}>
        <View style={styles.handle} />
        <View style={styles.tabsHeader}>
          <Text style={styles.tabTextActive}>Commentaires ({formatLikes(total)})</Text>
        </View>

        <View style={styles.searchBar}>
          <Text style={styles.searchIcon}>⌕</Text>
          <TextInput
            style={styles.searchInput}
            placeholder="Rechercher dans les commentaires"
            placeholderTextColor={tokens.colors.text.tertiary}
            value={query}
            onChangeText={setQuery}
          />
          {query.length > 0 && (
            <TouchableOpacity onPress={() => setQuery('')}>
              <Text style={styles.searchClear}>✕</Text>
            </TouchableOpacity>
          )}
        </View>

        {error && <Text style={styles.errorText}>{error}</Text>}

        {loading ? (
          <View style={styles.loading}>
            <ActivityIndicator color={tokens.colors.white} />
            <Text style={styles.emptyText}>Chargement des commentaires…</Text>
          </View>
        ) : (
          <ScrollView
            ref={scrollRef}
            style={styles.list}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ paddingBottom: tokens.spacing.lg }}
          >
            {filtered.length === 0 ? (
              <View style={styles.empty}>
                <Text style={styles.emptyText}>
                  {query
                    ? 'Aucun commentaire ne correspond.'
                    : error
                      ? 'Commentaires indisponibles — réessaie plus tard.'
                      : 'Aucun commentaire pour le moment.'}
                </Text>
              </View>
            ) : (
              filtered.map(renderComment)
            )}
          </ScrollView>
        )}

        <View style={styles.inputBar}>
          <Image source={{ uri: session.avatarUrl || undefined }} style={styles.inputAvatar} />
          <View style={styles.inputWrap}>
            {replyTo && (
              <View style={styles.replyingChip}>
                <Text style={styles.replyingText}>Réponse à @{replyTo.username}</Text>
                <TouchableOpacity onPress={() => setReplyTo(null)}>
                  <Text style={styles.replyingClose}>✕</Text>
                </TouchableOpacity>
              </View>
            )}
            <TextInput
              ref={inputRef}
              style={styles.input}
              placeholder={isReadOnly ? 'Commentaires en lecture seule' : replyTo ? `Répondre à @${replyTo.username}…` : 'Ajouter un commentaire…'}
              placeholderTextColor={tokens.colors.text.tertiary}
              value={text}
              onChangeText={setText}
              onSubmitEditing={() => void submit()}
              returnKeyType="send"
              blurOnSubmit={false}
              editable={!isReadOnly && !submitting}
            />
          </View>
          <TouchableOpacity
            style={[styles.sendBtn, text.trim().length > 0 && styles.sendBtnActive]}
            onPress={() => void submit()}
            disabled={isReadOnly || text.trim().length === 0 || submitting}
          >
            <Text style={styles.sendIcon}>{submitting ? '…' : '➤'}</Text>
          </TouchableOpacity>
        </View>
      </Animated.View>
    </View>
  );
};

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 1000,
    elevation: 1000,
    backgroundColor: 'transparent',
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: tokens.colors.black,
  },
  miniVideoWrap: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    width: SCREEN_WIDTH,
    backgroundColor: tokens.colors.black,
    overflow: 'hidden',
    zIndex: 1001,
    elevation: 1001,
  },
  miniImage: {
    ...StyleSheet.absoluteFillObject,
    width: '100%',
    height: '100%',
  },
  miniOverlay: {
    position: 'absolute',
    left: tokens.spacing.md,
    right: 56,
    bottom: tokens.spacing.md,
    gap: 2,
  },
  miniUsername: {
    color: tokens.colors.white,
    fontSize: tokens.typography.subhead.fontSize,
    fontWeight: '700',
  },
  miniDescription: {
    color: tokens.colors.white,
    fontSize: tokens.typography.caption.fontSize,
    opacity: 0.9,
  },
  closeBtn: {
    position: 'absolute',
    top: tokens.spacing.md,
    left: tokens.spacing.md,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeText: { color: tokens.colors.white, fontSize: 18, fontWeight: '700' },
  panel: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: tokens.colors.elevated,
    zIndex: 1002,
    elevation: 1002,
    borderTopLeftRadius: tokens.radius.lg,
    borderTopRightRadius: tokens.radius.lg,
    paddingTop: tokens.spacing.sm,
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: tokens.colors.surface,
    alignSelf: 'center',
    marginBottom: tokens.spacing.sm,
  },
  tabsHeader: {
    alignItems: 'center',
    paddingHorizontal: tokens.spacing.md,
    paddingBottom: tokens.spacing.sm,
  },
  tabTextActive: {
    color: tokens.colors.white,
    fontSize: tokens.typography.subhead.fontSize,
    fontWeight: '800',
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.spacing.sm,
    marginHorizontal: tokens.spacing.md,
    marginBottom: tokens.spacing.sm,
    backgroundColor: tokens.colors.surface,
    borderRadius: tokens.radius.full,
    paddingHorizontal: tokens.spacing.md,
    height: 38,
  },
  searchIcon: { color: tokens.colors.text.secondary, fontSize: 18 },
  searchInput: { flex: 1, color: tokens.colors.white, fontSize: tokens.typography.body.fontSize },
  searchClear: { color: tokens.colors.text.tertiary, fontSize: 14 },
  errorText: {
    color: tokens.colors.semantic.error,
    fontSize: tokens.typography.caption.fontSize,
    paddingHorizontal: tokens.spacing.md,
    paddingBottom: tokens.spacing.sm,
  },
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: tokens.spacing.sm },
  list: { flex: 1, paddingHorizontal: tokens.spacing.md },
  commentRow: { flexDirection: 'row', gap: tokens.spacing.sm, paddingVertical: tokens.spacing.sm },
  avatar: { width: 36, height: 36, borderRadius: 18, backgroundColor: tokens.colors.surface },
  commentBody: { flex: 1, gap: 3 },
  username: { color: tokens.colors.text.secondary, fontSize: tokens.typography.caption.fontSize, fontWeight: '600' },
  commentText: { color: tokens.colors.white, fontSize: tokens.typography.body.fontSize, lineHeight: 19 },
  metaRow: { flexDirection: 'row', gap: tokens.spacing.lg, marginTop: 2 },
  metaTime: { color: tokens.colors.text.tertiary, fontSize: tokens.typography.caption.fontSize },
  metaReply: { color: tokens.colors.text.tertiary, fontSize: tokens.typography.caption.fontSize, fontWeight: '700' },
  likeCol: { alignItems: 'center', gap: 2, width: 32 },
  heart: { color: tokens.colors.text.secondary, fontSize: 18 },
  heartActive: { color: tokens.colors.brand.primary },
  likeCount: { color: tokens.colors.text.tertiary, fontSize: 10 },
  replyRow: { flexDirection: 'row', gap: tokens.spacing.sm, marginTop: tokens.spacing.sm },
  replyAvatar: { width: 28, height: 28, borderRadius: 14, backgroundColor: tokens.colors.surface },
  toggleReplies: { flexDirection: 'row', alignItems: 'center', gap: tokens.spacing.sm, marginTop: tokens.spacing.sm },
  toggleLine: { width: 24, height: 1, backgroundColor: tokens.colors.surface },
  toggleRepliesText: { color: tokens.colors.text.secondary, fontSize: tokens.typography.caption.fontSize, fontWeight: '600' },
  empty: { alignItems: 'center', paddingVertical: tokens.spacing.xxl },
  emptyText: { color: tokens.colors.text.secondary, fontSize: tokens.typography.body.fontSize },
  inputBar: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: tokens.spacing.sm,
    paddingHorizontal: tokens.spacing.md,
    paddingTop: tokens.spacing.sm,
    borderTopWidth: 0.5,
    borderTopColor: tokens.colors.surface,
  },
  inputAvatar: { width: 32, height: 32, borderRadius: 16, backgroundColor: tokens.colors.surface },
  inputWrap: {
    flex: 1,
    backgroundColor: tokens.colors.surface,
    borderRadius: tokens.radius.lg,
    paddingHorizontal: tokens.spacing.md,
    minHeight: 38,
    justifyContent: 'center',
  },
  replyingChip: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingTop: 6 },
  replyingText: { color: tokens.colors.brand.secondary, fontSize: tokens.typography.caption.fontSize, fontWeight: '600' },
  replyingClose: { color: tokens.colors.text.tertiary, fontSize: 12 },
  input: { color: tokens.colors.white, fontSize: tokens.typography.body.fontSize, paddingVertical: tokens.spacing.sm },
  sendBtn: { width: 38, height: 38, borderRadius: 19, backgroundColor: tokens.colors.surface, justifyContent: 'center', alignItems: 'center' },
  sendBtnActive: { backgroundColor: tokens.colors.brand.primary },
  sendIcon: { color: tokens.colors.white, fontSize: 16 },
});
