import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  Modal,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { tokens } from '@/theme/tokens';
import { useNavigation } from '@/navigation/NavigationContext';
import { useTikTokVideos } from '@/hooks/useTikTokVideos';
import { useTikTokConnect } from '@/hooks/useTikTokConnect';
import { TikTokEmbed } from '@/components/tiktok/TikTokEmbed';
import type { TikTokVideoItem } from '@/services/tiktokOAuth';

function formatCount(n?: number): string {
  if (!n) return '0';
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1).replace('.0', '')}M`;
  if (n >= 1000) return `${(n / 1000).toFixed(1).replace('.0', '')}k`;
  return String(n);
}

function formatDuration(s?: number): string | null {
  if (!s || s <= 0) return null;
  const m = Math.floor(s / 60);
  const sec = Math.round(s % 60);
  return `${m}:${sec.toString().padStart(2, '0')}`;
}

/**
 * "Mes vidéos TikTok" — lists the connected user's own TikTok videos via the
 * Display API (scope video.list) and plays them through the official embed.
 * It never claims to search arbitrary TikTok content (not possible with this
 * app's scopes) and degrades honestly for every non-connected / scope state.
 */
export const TikTokVideosScreen: React.FC = () => {
  const insets = useSafeAreaInsets();
  const nav = useNavigation();
  const tiktok = useTikTokConnect();
  const { loading, loadingMore, videos, hasMore, errorCode, errorMessage, reload, loadMore } =
    useTikTokVideos();

  const [selected, setSelected] = useState<TikTokVideoItem | null>(null);

  const Header = (
    <View style={styles.header}>
      <TouchableOpacity onPress={() => nav.back()} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
        <Text style={styles.backIcon}>←</Text>
      </TouchableOpacity>
      <Text style={styles.headerTitle}>Mes vidéos TikTok</Text>
      <View style={styles.placeholder} />
    </View>
  );

  /** Centered state (loading / error / empty) with an optional CTA. */
  const renderState = (
    emoji: string,
    title: string,
    sub: string,
    cta?: { label: string; onPress: () => void },
  ) => (
    <View style={styles.stateWrap}>
      <Text style={styles.stateEmoji}>{emoji}</Text>
      <Text style={styles.stateTitle}>{title}</Text>
      <Text style={styles.stateSub}>{sub}</Text>
      {cta ? (
        <TouchableOpacity style={styles.ctaBtn} onPress={cta.onPress}>
          <Text style={styles.ctaBtnText}>{cta.label}</Text>
        </TouchableOpacity>
      ) : null}
    </View>
  );

  let body: React.ReactNode;

  if (loading || tiktok.loading) {
    body = (
      <View style={styles.stateWrap}>
        <ActivityIndicator color={tokens.colors.brand.primary} size="large" />
        <Text style={styles.stateSub}>Chargement…</Text>
      </View>
    );
  } else if (errorCode === 'NOT_CONFIGURED') {
    body = renderState(
      '⚙️',
      'TikTok non configuré',
      "L'intégration TikTok n'est pas configurée sur le serveur. Ajoute les clés de l'app TikTok pour activer la connexion.",
    );
  } else if (errorCode === 'NOT_CONNECTED') {
    body = renderState(
      '🔗',
      'Compte TikTok non connecté',
      'Connecte ton compte TikTok pour voir tes vidéos publiées.',
      { label: 'Connecter mon compte TikTok', onPress: tiktok.connect },
    );
  } else if (errorCode === 'RECONNECT_REQUIRED') {
    body = renderState(
      '↻',
      'Reconnexion nécessaire',
      'Ta session TikTok a expiré. Reconnecte ton compte pour continuer.',
      { label: 'Reconnecter', onPress: tiktok.connect },
    );
  } else if (errorCode === 'SCOPE_MISSING') {
    body = renderState(
      '🔒',
      'Accès vidéos non autorisé',
      errorMessage ??
        "Ton compte n'a pas accordé l'accès à la liste des vidéos (scope video.list). Reconnecte-toi en acceptant cette permission.",
      { label: 'Reconnecter', onPress: tiktok.connect },
    );
  } else if (errorCode === 'NETWORK') {
    body = renderState(
      '📡',
      'Backend injoignable',
      'Impossible de joindre le serveur TikTok. Lance le backend puis réessaie.',
      { label: 'Réessayer', onPress: reload },
    );
  } else if (errorCode) {
    body = renderState('⚠️', 'Erreur', errorMessage ?? 'Une erreur est survenue.', {
      label: 'Réessayer',
      onPress: reload,
    });
  } else if (videos.length === 0) {
    body = renderState(
      '🎬',
      'Aucune vidéo',
      "Ce compte TikTok n'a pas encore de vidéo publique, ou elles ne sont pas accessibles via l'API.",
    );
  } else {
    body = (
      <ScrollView contentContainerStyle={styles.grid} showsVerticalScrollIndicator={false}>
        {videos.map((v) => {
          const dur = formatDuration(v.duration);
          return (
            <TouchableOpacity
              key={v.id}
              style={styles.card}
              activeOpacity={0.85}
              onPress={() => setSelected(v)}
            >
              <View style={styles.thumbWrap}>
                {v.cover_image_url ? (
                  <Image source={{ uri: v.cover_image_url }} style={styles.thumb} />
                ) : (
                  <View style={[styles.thumb, styles.thumbEmpty]}>
                    <Text style={styles.thumbEmptyIcon}>▶</Text>
                  </View>
                )}
                {dur ? (
                  <View style={styles.durationPill}>
                    <Text style={styles.durationText}>{dur}</Text>
                  </View>
                ) : null}
                <View style={styles.viewsPill}>
                  <Text style={styles.viewsText}>▶ {formatCount(v.view_count)}</Text>
                </View>
              </View>
              <Text style={styles.cardTitle} numberOfLines={2}>
                {v.title || v.video_description || 'Sans titre'}
              </Text>
              <View style={styles.statsRow}>
                <Text style={styles.statText}>♥ {formatCount(v.like_count)}</Text>
                <Text style={styles.statText}>💬 {formatCount(v.comment_count)}</Text>
                <Text style={styles.statText}>↗ {formatCount(v.share_count)}</Text>
              </View>
            </TouchableOpacity>
          );
        })}

        {hasMore ? (
          <TouchableOpacity style={styles.loadMore} onPress={loadMore} disabled={loadingMore}>
            {loadingMore ? (
              <ActivityIndicator color={tokens.colors.white} />
            ) : (
              <Text style={styles.loadMoreText}>Charger plus</Text>
            )}
          </TouchableOpacity>
        ) : null}
      </ScrollView>
    );
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {Header}
      {body}

      <Modal
        visible={!!selected}
        transparent
        animationType="fade"
        onRequestClose={() => setSelected(null)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <View style={styles.modalHead}>
              <Text style={styles.modalTitle} numberOfLines={1}>
                {selected?.title || selected?.video_description || 'Vidéo TikTok'}
              </Text>
              <TouchableOpacity onPress={() => setSelected(null)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <Text style={styles.modalClose}>✕</Text>
              </TouchableOpacity>
            </View>
            <TikTokEmbed embedLink={selected?.embed_link} shareUrl={selected?.share_url} />
          </View>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: tokens.colors.bg },
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
  headerTitle: { color: tokens.colors.white, fontSize: tokens.typography.title.fontSize, fontWeight: '800' },
  placeholder: { width: 28 },

  stateWrap: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: tokens.spacing.sm,
    paddingHorizontal: tokens.spacing.xl,
  },
  stateEmoji: { fontSize: 52 },
  stateTitle: { color: tokens.colors.white, fontSize: tokens.typography.title.fontSize, fontWeight: '700' },
  stateSub: { color: tokens.colors.text.secondary, fontSize: tokens.typography.body.fontSize, textAlign: 'center', lineHeight: 19 },
  ctaBtn: {
    marginTop: tokens.spacing.md,
    backgroundColor: tokens.colors.brand.primary,
    borderRadius: tokens.radius.sm,
    paddingHorizontal: tokens.spacing.xl,
    paddingVertical: tokens.spacing.md,
  },
  ctaBtnText: { color: tokens.colors.white, fontSize: tokens.typography.body.fontSize, fontWeight: '700' },

  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: tokens.spacing.sm,
    padding: tokens.spacing.md,
    paddingBottom: tokens.spacing.xxl,
  },
  card: { width: '47.6%', flexGrow: 1, gap: 6 },
  thumbWrap: {
    position: 'relative',
    width: '100%',
    aspectRatio: 9 / 16,
    borderRadius: tokens.radius.md,
    overflow: 'hidden',
    backgroundColor: tokens.colors.surface,
  },
  thumb: { width: '100%', height: '100%' },
  thumbEmpty: { justifyContent: 'center', alignItems: 'center' },
  thumbEmptyIcon: { color: tokens.colors.text.tertiary, fontSize: 32 },
  durationPill: {
    position: 'absolute',
    top: 6,
    right: 6,
    backgroundColor: 'rgba(0,0,0,0.7)',
    borderRadius: tokens.radius.sm,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  durationText: { color: tokens.colors.white, fontSize: tokens.typography.caption.fontSize, fontWeight: '600' },
  viewsPill: {
    position: 'absolute',
    bottom: 6,
    left: 6,
    backgroundColor: 'rgba(0,0,0,0.55)',
    borderRadius: tokens.radius.sm,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  viewsText: { color: tokens.colors.white, fontSize: tokens.typography.caption.fontSize, fontWeight: '700' },
  cardTitle: { color: tokens.colors.white, fontSize: tokens.typography.body.fontSize, lineHeight: 17 },
  statsRow: { flexDirection: 'row', gap: tokens.spacing.sm },
  statText: { color: tokens.colors.text.secondary, fontSize: tokens.typography.caption.fontSize },

  loadMore: {
    width: '100%',
    marginTop: tokens.spacing.sm,
    backgroundColor: tokens.colors.elevated,
    borderRadius: tokens.radius.sm,
    paddingVertical: tokens.spacing.md,
    alignItems: 'center',
  },
  loadMoreText: { color: tokens.colors.white, fontSize: tokens.typography.body.fontSize, fontWeight: '700' },

  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.85)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: tokens.spacing.md,
  },
  modalCard: {
    width: '100%',
    maxWidth: 420,
    backgroundColor: tokens.colors.bg,
    borderRadius: tokens.radius.lg,
    padding: tokens.spacing.md,
    gap: tokens.spacing.sm,
  },
  modalHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  modalTitle: { color: tokens.colors.white, fontSize: tokens.typography.body.fontSize, fontWeight: '700', flex: 1, marginRight: tokens.spacing.sm },
  modalClose: { color: tokens.colors.white, fontSize: 22 },
});

export default TikTokVideosScreen;
