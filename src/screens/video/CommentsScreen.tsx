import React, { useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Image, TextInput } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { tokens } from '@/theme/tokens';
import { useNavigation, useRouteParams } from '@/navigation/NavigationContext';
import { useCommentsStore, Comment, Reply, CommentUser } from '@/store/commentsStore';
import { useSessionStore } from '@/store/sessionStore';

function formatLikes(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1).replace('.0', '')}M`;
  if (n >= 1000) return `${(n / 1000).toFixed(1).replace('.0', '')}k`;
  return String(n);
}

type Tab = 'comments' | 'creator';

export const CommentsScreen: React.FC = () => {
  const insets = useSafeAreaInsets();
  const nav = useNavigation();
  const { postId = 'default', count } = useRouteParams<{ postId?: string; count?: number }>();

  const ensureSeed = useCommentsStore((s) => s.ensureSeed);
  const thread = useCommentsStore((s) => s.getThread(postId));
  const total = useCommentsStore((s) => s.count(postId));
  const addComment = useCommentsStore((s) => s.addComment);
  const addReply = useCommentsStore((s) => s.addReply);
  const toggleLike = useCommentsStore((s) => s.toggleLike);

  const session = useSessionStore((s) => s);
  const me: CommentUser = { username: session.username, avatarUrl: session.avatarUrl, badge: 'Moi' };

  const [tab, setTab] = useState<Tab>('comments');
  const [query, setQuery] = useState('');
  const [text, setText] = useState('');
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [replyTo, setReplyTo] = useState<{ id: string; username: string } | null>(null);
  const inputRef = useRef<TextInput | null>(null);
  const scrollRef = useRef<ScrollView | null>(null);

  useEffect(() => {
    ensureSeed(postId);
  }, [postId, ensureSeed]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return thread;
    return thread.filter(
      (c) =>
        c.text.toLowerCase().includes(q) ||
        c.user.username.toLowerCase().includes(q) ||
        c.replies.some((r) => r.text.toLowerCase().includes(q) || r.user.username.toLowerCase().includes(q))
    );
  }, [thread, query]);

  const submit = () => {
    if (!text.trim()) return;
    if (replyTo) {
      addReply(postId, replyTo.id, text, me);
      setExpanded((e) => ({ ...e, [replyTo.id]: true }));
      setReplyTo(null);
    } else {
      addComment(postId, text, me);
      scrollRef.current?.scrollTo({ y: 0, animated: true });
    }
    setText('');
  };

  const startReply = (commentId: string, username: string) => {
    setReplyTo({ id: commentId, username });
    inputRef.current?.focus();
  };

  const renderReply = (postId2: string, commentId: string, r: Reply) => (
    <View key={r.id} style={styles.replyRow}>
      <Image source={{ uri: r.user.avatarUrl }} style={styles.replyAvatar} />
      <View style={styles.commentBody}>
        <Text style={styles.username}>
          {r.user.username}
          {r.user.badge ? <Text style={styles.badge}>  {r.user.badge}</Text> : null}
        </Text>
        <Text style={styles.commentText}>{r.text}</Text>
        <View style={styles.metaRow}>
          <Text style={styles.metaTime}>{r.createdAtLabel}</Text>
          <TouchableOpacity onPress={() => startReply(commentId, r.user.username)}>
            <Text style={styles.metaReply}>Répondre</Text>
          </TouchableOpacity>
        </View>
      </View>
      <TouchableOpacity style={styles.likeCol} onPress={() => toggleLike(postId2, commentId, r.id)}>
        <Text style={[styles.heart, r.isLiked && styles.heartActive]}>{r.isLiked ? '♥' : '♡'}</Text>
        <Text style={styles.likeCount}>{formatLikes(r.likes)}</Text>
      </TouchableOpacity>
    </View>
  );

  const renderComment = (c: Comment) => {
    const isOpen = expanded[c.id];
    const visibleReplies = isOpen ? c.replies : [];
    return (
      <View key={c.id} style={styles.commentRow}>
        <Image source={{ uri: c.user.avatarUrl }} style={styles.avatar} />
        <View style={styles.commentBody}>
          <Text style={styles.username}>
            {c.user.username}
            {c.user.badge ? <Text style={styles.badge}>  {c.user.badge}</Text> : null}
            {c.pinned ? <Text style={styles.pinned}>  📌 Épinglé</Text> : null}
          </Text>
          <Text style={styles.commentText}>{c.text}</Text>
          <View style={styles.metaRow}>
            <Text style={styles.metaTime}>{c.createdAtLabel}</Text>
            <TouchableOpacity onPress={() => startReply(c.id, c.user.username)}>
              <Text style={styles.metaReply}>Répondre</Text>
            </TouchableOpacity>
          </View>

          {visibleReplies.map((r) => renderReply(postId, c.id, r))}

          {c.replies.length > 0 && (
            <TouchableOpacity
              style={styles.toggleReplies}
              onPress={() => setExpanded((e) => ({ ...e, [c.id]: !isOpen }))}
            >
              <View style={styles.toggleLine} />
              <Text style={styles.toggleRepliesText}>
                {isOpen ? 'Masquer' : `Voir ${c.replies.length} réponse${c.replies.length > 1 ? 's' : ''}`}
                {isOpen ? ' ▲' : ' ▼'}
              </Text>
            </TouchableOpacity>
          )}
        </View>
        <TouchableOpacity style={styles.likeCol} onPress={() => toggleLike(postId, c.id)}>
          <Text style={[styles.heart, c.isLiked && styles.heartActive]}>{c.isLiked ? '♥' : '♡'}</Text>
          <Text style={styles.likeCount}>{formatLikes(c.likes)}</Text>
        </TouchableOpacity>
      </View>
    );
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Tabs header */}
      <View style={styles.tabsHeader}>
        <TouchableOpacity onPress={() => nav.back()} style={styles.closeBtn} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <Text style={styles.closeText}>✕</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.tabBtn} onPress={() => setTab('comments')}>
          <Text style={[styles.tabText, tab === 'comments' && styles.tabTextActive]}>
            Commentaires ({total || count || 0})
          </Text>
          {tab === 'comments' && <View style={styles.tabUnderline} />}
        </TouchableOpacity>
        <TouchableOpacity style={styles.tabBtn} onPress={() => setTab('creator')}>
          <Text style={[styles.tabText, tab === 'creator' && styles.tabTextActive]}>Vidéos du créateur</Text>
          {tab === 'creator' && <View style={styles.tabUnderline} />}
        </TouchableOpacity>
      </View>

      {tab === 'comments' ? (
        <>
          {/* Search */}
          <View style={styles.searchBar}>
            <Text style={styles.searchIcon}>🔍</Text>
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

          <ScrollView ref={scrollRef} style={styles.list} showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: tokens.spacing.lg }}>
            {filtered.length === 0 ? (
              <View style={styles.empty}>
                <Text style={styles.emptyText}>Aucun commentaire ne correspond.</Text>
              </View>
            ) : (
              filtered.map(renderComment)
            )}
          </ScrollView>

          {/* Input bar */}
          <View style={[styles.inputBar, { paddingBottom: insets.bottom || tokens.spacing.sm }]}>
            <Image source={{ uri: session.avatarUrl }} style={styles.inputAvatar} />
            <View style={styles.inputWrap}>
              {replyTo && (
                <View style={styles.replyingChip}>
                  <Text style={styles.replyingText}>Réponse à @{replyTo.username}</Text>
                  <TouchableOpacity onPress={() => setReplyTo(null)}><Text style={styles.replyingClose}>✕</Text></TouchableOpacity>
                </View>
              )}
              <TextInput
                ref={inputRef}
                style={styles.input}
                placeholder={replyTo ? `Répondre à @${replyTo.username}…` : 'Ajouter un commentaire…'}
                placeholderTextColor={tokens.colors.text.tertiary}
                value={text}
                onChangeText={setText}
                onSubmitEditing={submit}
                returnKeyType="send"
                blurOnSubmit={false}
              />
            </View>
            <TouchableOpacity
              style={[styles.sendBtn, text.trim().length > 0 && styles.sendBtnActive]}
              onPress={submit}
              disabled={text.trim().length === 0}
            >
              <Text style={styles.sendIcon}>➤</Text>
            </TouchableOpacity>
          </View>
        </>
      ) : (
        <CreatorVideosTab />
      )}
    </View>
  );
};

const CreatorVideosTab: React.FC = () => {
  const nav = useNavigation();
  const thumbs = Array.from({ length: 9 }, (_, i) => `https://picsum.photos/seed/creatorvid${i}/200/300`);
  return (
    <ScrollView contentContainerStyle={styles.creatorGrid} showsVerticalScrollIndicator={false}>
      <View style={styles.creatorGridInner}>
        {thumbs.map((t, i) => (
          <TouchableOpacity key={i} style={styles.creatorCell} onPress={() => nav.back()}>
            <Image source={{ uri: t }} style={styles.creatorImg} />
            <Text style={styles.creatorViews}>▶ {(Math.random() * 900 + 100).toFixed(0)}k</Text>
          </TouchableOpacity>
        ))}
      </View>
    </ScrollView>
  );
};

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
  searchIcon: { fontSize: 13 },
  searchInput: { flex: 1, color: tokens.colors.white, fontSize: tokens.typography.body.fontSize },
  searchClear: { color: tokens.colors.text.tertiary, fontSize: 14 },
  list: { flex: 1, paddingHorizontal: tokens.spacing.md },
  commentRow: { flexDirection: 'row', gap: tokens.spacing.sm, paddingVertical: tokens.spacing.sm },
  avatar: { width: 36, height: 36, borderRadius: 18, backgroundColor: tokens.colors.surface },
  commentBody: { flex: 1, gap: 3 },
  username: { color: tokens.colors.text.secondary, fontSize: tokens.typography.caption.fontSize, fontWeight: '600' },
  badge: { color: tokens.colors.brand.secondary, fontSize: 10, fontWeight: '700' },
  pinned: { color: tokens.colors.action.tip, fontSize: 10, fontWeight: '700' },
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
  creatorGridInner: { flexDirection: 'row', flexWrap: 'wrap', gap: 2 },
  creatorCell: { width: '33%', flexGrow: 1, aspectRatio: 9 / 16, backgroundColor: tokens.colors.surface, borderRadius: tokens.radius.xs, overflow: 'hidden', justifyContent: 'flex-end' },
  creatorImg: { ...StyleSheet.absoluteFillObject, width: '100%', height: '100%' },
  creatorViews: { color: tokens.colors.white, fontSize: tokens.typography.caption.fontSize, fontWeight: '700', padding: 4, backgroundColor: 'rgba(0,0,0,0.35)' },
});
