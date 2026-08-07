import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  TextInput,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { tokens } from '@/theme/tokens';
import { useNavigation, useRouteParams } from '@/navigation/NavigationContext';
import { useSessionStore } from '@/store/sessionStore';
import { feedService } from '@/services/feedService';
import type { Comment, Video } from '@/types';

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

type Tab = 'comments' | 'creator';

type ReplyTarget = { id: string; username: string };

export const CommentsScreen: React.FC = () => {
  const insets = useSafeAreaInsets();
  const nav = useNavigation();
  const { postId, count } = useRouteParams<{ postId?: string; count?: number }>();
  const session = useSessionStore((s) => s);

  const [tab, setTab] = useState<Tab>('comments');
  const [query, setQuery] = useState('');
  const [text, setText] = useState('');
  const [comments, setComments] = useState<Comment[]>([]);
  const [creatorVideos, setCreatorVideos] = useState<Video[]>([]);
  const [creatorUsername, setCreatorUsername] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [replyTo, setReplyTo] = useState<ReplyTarget | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [loadingReplies, setLoadingReplies] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<TextInput | null>(null);
  const scrollRef = useRef<ScrollView | null>(null);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      if (!postId) {
        setError('Vidéo introuvable.');
        setLoading(false);
        return;
      }

      setLoading(true);
      setError(null);
      try {
        const [commentsResponse, video] = await Promise.all([
          feedService.getComments(postId, { limit: 50 }),
          feedService.getVideoById(postId),
        ]);
        if (cancelled) return;

        setComments(commentsResponse.comments);
        setCreatorUsername(video.user.username);

        try {
          const videos = await feedService.getUserVideos(video.user.username, { limit: 18 });
          if (!cancelled) setCreatorVideos(videos);
        } catch {
          if (!cancelled) setCreatorVideos([]);
        }
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
  }, [postId]);

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

  const total = count ?? comments.reduce((sum, comment) => sum + 1 + comment.repliesCount, 0);

  const submit = async () => {
    const value = text.trim();
    if (!postId || !value || submitting) return;

    setSubmitting(true);
    setError(null);
    try {
      const created = await feedService.postComment(postId, value, replyTo?.id);
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

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.tabsHeader}>
        <TouchableOpacity onPress={() => nav.back()} style={styles.closeBtn} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <Text style={styles.closeText}>✕</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.tabBtn} onPress={() => setTab('comments')}>
          <Text style={[styles.tabText, tab === 'comments' && styles.tabTextActive]}>Commentaires ({total})</Text>
          {tab === 'comments' && <View style={styles.tabUnderline} />}
        </TouchableOpacity>
        <TouchableOpacity style={styles.tabBtn} onPress={() => setTab('creator')}>
          <Text style={[styles.tabText, tab === 'creator' && styles.tabTextActive]}>Vidéos du créateur</Text>
          {tab === 'creator' && <View style={styles.tabUnderline} />}
        </TouchableOpacity>
      </View>

      {tab === 'comments' ? (
        <>
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
                  <Text style={styles.emptyText}>{query ? 'Aucun commentaire ne correspond.' : 'Aucun commentaire pour le moment.'}</Text>
                </View>
              ) : (
                filtered.map(renderComment)
              )}
            </ScrollView>
          )}

          <View style={[styles.inputBar, { paddingBottom: insets.bottom || tokens.spacing.sm }]}>
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
                placeholder={replyTo ? `Répondre à @${replyTo.username}…` : 'Ajouter un commentaire…'}
                placeholderTextColor={tokens.colors.text.tertiary}
                value={text}
                onChangeText={setText}
                onSubmitEditing={() => void submit()}
                returnKeyType="send"
                blurOnSubmit={false}
                editable={!submitting}
              />
            </View>
            <TouchableOpacity
              style={[styles.sendBtn, text.trim().length > 0 && styles.sendBtnActive]}
              onPress={() => void submit()}
              disabled={text.trim().length === 0 || submitting}
            >
              <Text style={styles.sendIcon}>{submitting ? '…' : '➤'}</Text>
            </TouchableOpacity>
          </View>
        </>
      ) : (
        <CreatorVideosTab videos={creatorVideos} username={creatorUsername} />
      )}
    </View>
  );
};

const CreatorVideosTab: React.FC<{ videos: Video[]; username: string | null }> = ({ videos, username }) => (
  <ScrollView contentContainerStyle={styles.creatorGrid} showsVerticalScrollIndicator={false}>
    {username && <Text style={styles.creatorTitle}>@{username}</Text>}
    {videos.length === 0 ? (
      <View style={styles.empty}>
        <Text style={styles.emptyText}>Aucune autre vidéo publique disponible.</Text>
      </View>
    ) : (
      <View style={styles.creatorGridInner}>
        {videos.map((video) => (
          <View key={video.id} style={styles.creatorCell}>
            {video.thumbnailUrl ? <Image source={{ uri: video.thumbnailUrl }} style={styles.creatorImg} /> : null}
            <Text style={styles.creatorViews}>▶ {formatLikes(video.viewsCount)}</Text>
          </View>
        ))}
      </View>
    )}
  </ScrollView>
);

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: tokens.colors.bg },
  tabsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: tokens.spacing.md,
    paddingVertical: tokens.spacing.sm,
    borderBottomWidth: 0.5,
    borderBottomColor: tokens.colors.surface,
    gap: tokens.spacing.md,
  },
  closeBtn: { width: 24 },
  closeText: { color: tokens.colors.white, fontSize: 20 },
  tabBtn: { alignItems: 'center' },
  tabText: { color: tokens.colors.text.secondary, fontSize: tokens.typography.body.fontSize, fontWeight: '600' },
  tabTextActive: { color: tokens.colors.white, fontWeight: '800' },
  tabUnderline: { marginTop: 6, height: 2, width: '70%', backgroundColor: tokens.colors.white, borderRadius: 1 },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.spacing.sm,
    margin: tokens.spacing.md,
    backgroundColor: tokens.colors.elevated,
    borderRadius: tokens.radius.full,
    paddingHorizontal: tokens.spacing.md,
    height: 38,
  },
  searchIcon: { color: tokens.colors.text.secondary, fontSize: 18 },
  searchInput: { flex: 1, color: tokens.colors.white, fontSize: tokens.typography.body.fontSize },
  searchClear: { color: tokens.colors.text.tertiary, fontSize: 14 },
  errorText: { color: tokens.colors.semantic.error, fontSize: tokens.typography.caption.fontSize, paddingHorizontal: tokens.spacing.md, paddingBottom: tokens.spacing.sm },
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
  inputWrap: { flex: 1, backgroundColor: tokens.colors.elevated, borderRadius: tokens.radius.lg, paddingHorizontal: tokens.spacing.md, minHeight: 38, justifyContent: 'center' },
  replyingChip: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingTop: 6 },
  replyingText: { color: tokens.colors.brand.secondary, fontSize: tokens.typography.caption.fontSize, fontWeight: '600' },
  replyingClose: { color: tokens.colors.text.tertiary, fontSize: 12 },
  input: { color: tokens.colors.white, fontSize: tokens.typography.body.fontSize, paddingVertical: tokens.spacing.sm },
  sendBtn: { width: 38, height: 38, borderRadius: 19, backgroundColor: tokens.colors.surface, justifyContent: 'center', alignItems: 'center' },
  sendBtnActive: { backgroundColor: tokens.colors.brand.primary },
  sendIcon: { color: tokens.colors.white, fontSize: 16 },
  creatorGrid: { padding: tokens.spacing.md },
  creatorTitle: { color: tokens.colors.white, fontSize: tokens.typography.subhead.fontSize, fontWeight: '700', marginBottom: tokens.spacing.md },
  creatorGridInner: { flexDirection: 'row', flexWrap: 'wrap', gap: 2 },
  creatorCell: { width: '33%', flexGrow: 1, aspectRatio: 9 / 16, backgroundColor: tokens.colors.surface, borderRadius: tokens.radius.xs, overflow: 'hidden', justifyContent: 'flex-end' },
  creatorImg: { ...StyleSheet.absoluteFillObject, width: '100%', height: '100%' },
  creatorViews: { color: tokens.colors.white, fontSize: tokens.typography.caption.fontSize, fontWeight: '700', padding: 4, backgroundColor: 'rgba(0,0,0,0.35)' },
});
