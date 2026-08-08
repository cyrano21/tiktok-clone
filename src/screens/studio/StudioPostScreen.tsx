import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Image, TextInput } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { tokens } from '@/theme/tokens';
import { useNavigation, useRouteParams } from '@/navigation/NavigationContext';
import { useStudioStore } from '@/store/studioStore';
import { getProductById, formatPrice } from '@/services/demoShop';
import { MiniBarChart } from '@/components/studio/MiniBarChart';
import { CommentSheet } from '@/components/video/CommentSheet';
import type { Video } from '@/types';

function formatShort(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1).replace('.0', '')}M`;
  if (n >= 1000) return `${(n / 1000).toFixed(1).replace('.0', '')}k`;
  return String(Math.round(n));
}

const DAY_LABELS = ['L', 'M', 'M', 'J', 'V', 'S', 'D'];

export const StudioPostScreen: React.FC = () => {
  const insets = useSafeAreaInsets();
  const nav = useNavigation();
  const { postId } = useRouteParams<{ postId?: string }>();
  const post = useStudioStore((s) => (postId ? s.getPost(postId) : undefined));
  const updateCaption = useStudioStore((s) => s.updateCaption);
  const removePost = useStudioStore((s) => s.removePost);

  const [editing, setEditing] = useState(false);
  const [commentsOpen, setCommentsOpen] = useState(false);
  const [caption, setCaption] = useState(post?.caption ?? '');

  if (!post) {
    return (
      <View style={[styles.container, styles.center, { paddingTop: insets.top }]}>
        <Text style={styles.missing}>Publication introuvable</Text>
        <TouchableOpacity onPress={() => nav.back()}><Text style={styles.link}>Retour</Text></TouchableOpacity>
      </View>
    );
  }

  const product = post.productId ? getProductById(post.productId) : undefined;
  const studioVideo: Video = {
    id: post.id,
    user: {
      id: post.sellerId ?? 'studio-owner',
      username: 'orky_creator',
      displayName: 'Créateur ORKY',
      avatarUrl: '',
      bio: '',
      followersCount: 0,
      followingCount: 0,
      likesCount: post.metrics.likes,
      videosCount: 1,
      isVerified: false,
      isFollowing: false,
      isFollowedBy: false,
      createdAt: post.createdAt,
    },
    videoUrl: post.sourceUrl,
    thumbnailUrl: post.thumbnailUrl,
    description: post.caption,
    likesCount: post.metrics.likes,
    commentsCount: post.metrics.comments,
    sharesCount: post.metrics.shares,
    savesCount: 0,
    viewsCount: post.metrics.views,
    duration: 0,
    isLiked: false,
    isSaved: false,
    hashtags: [],
    sound: null,
    location: null,
    createdAt: post.createdAt,
    allowComments: true,
    allowDuet: false,
    allowStitch: false,
  };

  const saveCaption = () => {
    updateCaption(post.id, caption.trim());
    setEditing(false);
  };

  const handleDelete = () => {
    removePost(post.id);
    nav.back();
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => nav.back()} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <Text style={styles.backIcon}>←</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Statistiques vidéo</Text>
        <View style={styles.placeholder} />
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: tokens.spacing.xxl }}>
        {/* Preview + caption */}
        <View style={styles.previewRow}>
          <Image source={{ uri: post.thumbnailUrl }} style={styles.preview} />
          <View style={styles.captionCol}>
            {editing ? (
              <>
                <TextInput
                  style={styles.captionInput}
                  value={caption}
                  onChangeText={setCaption}
                  multiline
                  placeholder="Légende…"
                  placeholderTextColor={tokens.colors.text.tertiary}
                />
                <TouchableOpacity style={styles.saveBtn} onPress={saveCaption}>
                  <Text style={styles.saveBtnText}>Enregistrer</Text>
                </TouchableOpacity>
              </>
            ) : (
              <>
                <Text style={styles.caption}>{post.caption || 'Sans légende'}</Text>
                <Text style={styles.date}>{new Date(post.createdAt).toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' })}</Text>
                <TouchableOpacity style={styles.editLink} onPress={() => { setCaption(post.caption); setEditing(true); }}>
                  <Text style={styles.editLinkText}>✏️ Modifier la légende</Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        </View>

        {/* Product link */}
        {product && (
          <TouchableOpacity style={styles.productLink} onPress={() => nav.push('shop.product', { productId: product.id })}>
            <Image source={{ uri: product.images[0] }} style={styles.productThumb} />
            <View style={{ flex: 1 }}>
              <Text style={styles.productTitle} numberOfLines={1}>{product.title}</Text>
              <Text style={styles.productPrice}>{formatPrice(product.price)}</Text>
            </View>
            <Text style={styles.productCta}>Voir ›</Text>
          </TouchableOpacity>
        )}

        {/* Metric tiles */}
        <View style={styles.tiles}>
          <View style={styles.tile}><Text style={styles.tileValue}>{formatShort(post.metrics.views)}</Text><Text style={styles.tileLabel}>Vues</Text></View>
          <View style={styles.tile}><Text style={styles.tileValue}>{formatShort(post.metrics.likes)}</Text><Text style={styles.tileLabel}>J'aime</Text></View>
          <View style={styles.tile}><Text style={styles.tileValue}>{formatShort(post.metrics.comments)}</Text><Text style={styles.tileLabel}>Comm.</Text></View>
          <View style={styles.tile}><Text style={styles.tileValue}>{formatShort(post.metrics.shares)}</Text><Text style={styles.tileLabel}>Partages</Text></View>
        </View>

        {/* Views chart */}
        <View style={styles.card}>
          <Text style={styles.cardLabel}>Vues · 7 derniers jours</Text>
          <MiniBarChart data={post.metrics.dailyViews} labels={DAY_LABELS} height={130} />
        </View>

        {/* Actions */}
        <View style={styles.actions}>
          <TouchableOpacity style={styles.actionBtn} onPress={() => setCommentsOpen(true)}>
            <Text style={styles.actionIcon}>💬</Text>
            <Text style={styles.actionText}>Commentaires</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.actionBtn} onPress={() => nav.push('studio.editor', post.productId ? { productId: post.productId } : undefined)}>
            <Text style={styles.actionIcon}>🎬</Text>
            <Text style={styles.actionText}>Nouvelle vidéo</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.actionBtn, styles.deleteBtn]} onPress={handleDelete}>
            <Text style={styles.actionIcon}>🗑️</Text>
            <Text style={[styles.actionText, styles.deleteText]}>Supprimer</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

      {commentsOpen && (
        <CommentSheet
          video={studioVideo}
          onClose={() => setCommentsOpen(false)}
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: tokens.colors.bg },
  center: { justifyContent: 'center', alignItems: 'center', gap: tokens.spacing.md },
  missing: { color: tokens.colors.white, fontSize: tokens.typography.subhead.fontSize },
  link: { color: tokens.colors.brand.primary, fontWeight: '700' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: tokens.spacing.md,
    paddingVertical: tokens.spacing.sm,
    borderBottomWidth: 0.5,
    borderBottomColor: tokens.colors.surface,
  },
  backIcon: { color: tokens.colors.white, fontSize: 24, width: 28 },
  headerTitle: { color: tokens.colors.white, fontSize: tokens.typography.title.fontSize, fontWeight: '700' },
  placeholder: { width: 28 },
  previewRow: { flexDirection: 'row', gap: tokens.spacing.md, padding: tokens.spacing.md },
  preview: { width: 96, height: 128, borderRadius: tokens.radius.sm, backgroundColor: tokens.colors.surface },
  captionCol: { flex: 1, gap: tokens.spacing.xs },
  caption: { color: tokens.colors.white, fontSize: tokens.typography.body.fontSize, lineHeight: 20 },
  date: { color: tokens.colors.text.tertiary, fontSize: tokens.typography.caption.fontSize },
  editLink: { marginTop: tokens.spacing.xs },
  editLinkText: { color: tokens.colors.brand.primary, fontSize: tokens.typography.body.fontSize, fontWeight: '600' },
  captionInput: { backgroundColor: tokens.colors.elevated, borderRadius: tokens.radius.sm, color: tokens.colors.white, fontSize: tokens.typography.body.fontSize, padding: tokens.spacing.sm, minHeight: 60, textAlignVertical: 'top' },
  saveBtn: { marginTop: tokens.spacing.xs, backgroundColor: tokens.colors.brand.primary, borderRadius: tokens.radius.xs, paddingVertical: tokens.spacing.sm, alignItems: 'center' },
  saveBtnText: { color: tokens.colors.white, fontSize: tokens.typography.body.fontSize, fontWeight: '700' },
  productLink: { flexDirection: 'row', alignItems: 'center', gap: tokens.spacing.sm, marginHorizontal: tokens.spacing.md, backgroundColor: tokens.colors.elevated, borderRadius: tokens.radius.md, padding: tokens.spacing.sm },
  productThumb: { width: 40, height: 40, borderRadius: tokens.radius.xs, backgroundColor: tokens.colors.surface },
  productTitle: { color: tokens.colors.white, fontSize: tokens.typography.caption.fontSize, fontWeight: '600' },
  productPrice: { color: tokens.colors.brand.primary, fontSize: tokens.typography.body.fontSize, fontWeight: '800' },
  productCta: { color: tokens.colors.brand.primary, fontSize: tokens.typography.body.fontSize, fontWeight: '700' },
  tiles: { flexDirection: 'row', gap: tokens.spacing.sm, paddingHorizontal: tokens.spacing.md, marginTop: tokens.spacing.md },
  tile: { flex: 1, backgroundColor: tokens.colors.elevated, borderRadius: tokens.radius.sm, paddingVertical: tokens.spacing.md, alignItems: 'center', gap: 2 },
  tileValue: { color: tokens.colors.white, fontSize: tokens.typography.body.fontSize, fontWeight: '800' },
  tileLabel: { color: tokens.colors.text.secondary, fontSize: 10 },
  card: { marginHorizontal: tokens.spacing.md, marginTop: tokens.spacing.md, backgroundColor: tokens.colors.elevated, borderRadius: tokens.radius.md, padding: tokens.spacing.md, gap: tokens.spacing.sm },
  cardLabel: { color: tokens.colors.text.secondary, fontSize: tokens.typography.body.fontSize, fontWeight: '600' },
  actions: { flexDirection: 'row', gap: tokens.spacing.sm, paddingHorizontal: tokens.spacing.md, marginTop: tokens.spacing.lg },
  actionBtn: { flex: 1, backgroundColor: tokens.colors.elevated, borderRadius: tokens.radius.sm, paddingVertical: tokens.spacing.md, alignItems: 'center', gap: 4 },
  actionIcon: { fontSize: 20 },
  actionText: { color: tokens.colors.white, fontSize: tokens.typography.caption.fontSize, fontWeight: '600' },
  deleteBtn: { backgroundColor: tokens.colors.semantic.error + '1A' },
  deleteText: { color: tokens.colors.semantic.error },
});
