import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, Dimensions, TouchableOpacity, Image } from 'react-native';
import { tokens } from '@/theme/tokens';
import { Video } from '@/types';
import { VideoPlayer } from './VideoPlayer';
import { RightActionBar } from './RightActionBar';
import { DoubleTapHeart } from './DoubleTapHeart';
import { SafetySheet } from '@/components/shared/SafetySheet';
import { useDoubleTap } from '@/hooks/useDoubleTap';
import { useFeedStore } from '@/store/feedStore';
import { formatPrice, getProductById } from '@/services/demoShop';
import { CommerceProduct, getCommerceProductById } from '@/services/orchidyProducts';

interface FeedItemProps {
  video: Video;
  isActive: boolean;
  itemHeight?: number;
  externalPause?: boolean;
  onCommentPress: () => void;
  onSharePress: () => void;
  onProfilePress: (userId: string) => void;
  onProductPress?: (productId: string) => void;
}

const USE_DEMO = process.env.NEXT_PUBLIC_USE_DEMO === 'true';

export const FeedItem: React.FC<FeedItemProps> = ({ video, isActive, itemHeight, externalPause = false, onCommentPress, onSharePress, onProfilePress, onProductPress }) => {
  const { toggleLike, toggleSave } = useFeedStore();
  const [isPaused, setIsPaused] = useState(false);
  const [muted, setMuted] = useState(true);
  const [rate, setRate] = useState(1);
  const [heartVisible, setHeartVisible] = useState(false);
  const RATES = [1, 1.5, 2, 0.5];

  const cycleRate = useCallback(() => {
    const index = RATES.indexOf(rate);
    setRate(RATES[(index + 1) % RATES.length]);
  }, [rate]);

  const handleShare = useCallback(() => {
    const url = video.externalUrl
      || (typeof window !== 'undefined' ? `${window.location.origin}/v1/videos/${video.id}` : video.id);
    const fallback = () => {
      if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
        navigator.clipboard.writeText(url).catch(() => undefined);
      }
    };
    if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
      navigator.share({ title: video.description || 'Vidéo ORKY', url }).catch(() => fallback());
    } else {
      fallback();
    }
  }, [video]);
  const [heartPosition, setHeartPosition] = useState({ x: 0, y: 0 });
  const [safetyVisible, setSafetyVisible] = useState(false);
  const [blockedNotice, setBlockedNotice] = useState(false);
  const [commerceProduct, setCommerceProduct] = useState<CommerceProduct | null>(null);
  const readOnly = video.interactionMode === 'read_only' || video.sourceType === 'external_reference';
  const primaryMatch = useMemo(() => video.productMatches?.[0] ?? null, [video.productMatches]);

  useEffect(() => {
    let active = true;
    setCommerceProduct(null);
    if (primaryMatch?.orchidyCatalogItemId) {
      void getCommerceProductById(`orchidy:${primaryMatch.orchidyCatalogItemId}`).then((product) => {
        if (active && product?.source === 'orchidy') setCommerceProduct(product);
      }).catch(() => undefined);
    } else if (USE_DEMO && video.productId) {
      const demo = getProductById(video.productId);
      if (demo && active) setCommerceProduct({ ...demo, source: 'demo' } as CommerceProduct);
    }
    return () => { active = false; };
  }, [primaryMatch?.orchidyCatalogItemId, video.productId]);

  const handleDoubleTap = useCallback((event: { nativeEvent: { locationX: number; locationY: number } }) => {
    if (readOnly) return;
    const { locationX, locationY } = event.nativeEvent;
    setHeartPosition({ x: locationX, y: locationY });
    setHeartVisible(true);
    if (!video.isLiked) toggleLike(video.id);
  }, [readOnly, video.id, video.isLiked, toggleLike]);

  const handleSingleTap = useCallback(() => setIsPaused((prev) => !prev), []);
  const { onPress } = useDoubleTap({ onSingleTap: handleSingleTap, onDoubleTap: handleDoubleTap as (event: unknown) => void, maxDelay: 300, excludeRight: true });
  const containerStyle = itemHeight ? [styles.container, { height: itemHeight }] : styles.container;

  if (blockedNotice) {
    return <View style={[containerStyle, styles.blockedState]}><Text style={styles.blockedTitle}>Créateur bloqué</Text><Text style={styles.blockedText}>Cette vidéo ne sera plus proposée après actualisation du fil.</Text></View>;
  }

  return (
    <View style={containerStyle}>
      {video.thumbnailUrl ? <Image source={{ uri: video.thumbnailUrl }} style={styles.thumbnailBg} resizeMode="cover" /> : null}
      <VideoPlayer uri={video.videoUrl} isActive={isActive && !safetyVisible} isPaused={isPaused || safetyVisible || externalPause} isMuted={muted} rate={rate} onPress={onPress} />
      <DoubleTapHeart isVisible={heartVisible} x={heartPosition.x} y={heartPosition.y} onAnimationEnd={() => setHeartVisible(false)} />

      <View style={styles.playerControls}>
        <TouchableOpacity style={styles.playerControlBtn} onPress={() => setMuted((m) => !m)} accessibilityLabel={muted ? 'Activer le son' : 'Couper le son'}>
          <Text style={styles.playerControlIcon}>{muted ? '🔇' : '🔊'}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.playerControlBtn} onPress={cycleRate} accessibilityLabel="Vitesse de lecture">
          <Text style={styles.playerControlText}>{rate}x</Text>
        </TouchableOpacity>
      </View>

      <RightActionBar
        video={video}
        readOnly={readOnly}
        onLike={() => toggleLike(video.id)}
        onComment={onCommentPress}
        onShare={handleShare}
        onSave={() => toggleSave(video.id)}
        onAvatarPress={() => {
          if (readOnly) {
            // External creator: open their public TikTok profile instead of a fake ORKY page.
            if (typeof window !== 'undefined' && video.user.username) {
              window.open(`https://www.tiktok.com/@${video.user.username.replace(/^@/, '')}`, '_blank', 'noopener,noreferrer');
            }
          } else {
            onProfilePress(video.user.id);
          }
        }}
        onMore={() => setSafetyVisible(true)}
      />

      <View style={styles.infoOverlay}>
        {readOnly ? <View style={styles.externalPill}><Text style={styles.externalPillText}>RÉFÉRENCE EXTERNE · LECTURE SEULE</Text></View> : null}
        <TouchableOpacity disabled={readOnly} onPress={() => onProfilePress(video.user.id)}><Text style={styles.username}>@{video.user.username}</Text></TouchableOpacity>
        <Text style={styles.description} numberOfLines={2}>{video.description}</Text>

        {commerceProduct ? (
          <TouchableOpacity style={styles.productPill} activeOpacity={0.85} onPress={() => onProductPress?.(commerceProduct.id)}>
            <Image source={{ uri: commerceProduct.images[0] }} style={styles.productThumb} />
            <View style={styles.productInfo}>
              <Text style={styles.productTitle} numberOfLines={1}>{commerceProduct.title}</Text>
              <Text style={styles.productPrice}>{formatPrice(commerceProduct.price, commerceProduct.currency)}</Text>
              <Text style={styles.productSource}>{commerceProduct.source === 'orchidy' ? 'Produit Orchidy vérifié au checkout' : 'Produit démo'}</Text>
            </View>
            <View style={styles.productCta}><Text style={styles.productCtaText}>Voir</Text></View>
          </TouchableOpacity>
        ) : null}

        {video.hashtags.length > 0 ? <View style={styles.hashtagRow}>{video.hashtags.slice(0, 3).map((tag) => <Text key={tag.id} style={styles.hashtag}>#{tag.name}</Text>)}</View> : null}
        {video.sound ? <View style={styles.soundRow}><Text style={styles.soundIcon}>♪</Text><Text style={styles.soundText} numberOfLines={1}>{video.sound.title} - {video.sound.artist}</Text></View> : null}
      </View>

      <SafetySheet isVisible={safetyVisible} onClose={() => setSafetyVisible(false)} videoId={video.id} creatorId={video.user.id} creatorUsername={video.user.username} onBlocked={() => { setSafetyVisible(false); setBlockedNotice(true); }} />
    </View>
  );
};

const { height: SCREEN_HEIGHT } = Dimensions.get('window');
const styles = StyleSheet.create({
  container: { width: '100%', height: SCREEN_HEIGHT, backgroundColor: tokens.colors.black, overflow: 'hidden' },
  blockedState: { alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32, gap: 8 },
  blockedTitle: { color: tokens.colors.white, fontSize: 22, fontWeight: '800' },
  blockedText: { color: tokens.colors.text.secondary, textAlign: 'center', lineHeight: 20 },
  thumbnailBg: { ...StyleSheet.absoluteFillObject, width: '100%', height: '100%' },
  infoOverlay: { position: 'absolute', bottom: 90, left: tokens.feed.infoPadding, right: tokens.feed.rightBarWidth + tokens.spacing.lg, gap: tokens.spacing.xs },
  externalPill: { alignSelf: 'flex-start', borderRadius: 999, paddingHorizontal: 8, paddingVertical: 4, backgroundColor: 'rgba(0,0,0,0.65)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.18)' },
  playerControls: { position: 'absolute', left: tokens.feed.infoPadding, bottom: 54, flexDirection: 'row', gap: tokens.spacing.sm, zIndex: 20 },
  playerControlBtn: { minWidth: 40, height: 34, paddingHorizontal: 8, borderRadius: tokens.radius.full, backgroundColor: 'rgba(0,0,0,0.55)', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.18)' },
  playerControlIcon: { fontSize: 16, lineHeight: 20 },
  playerControlText: { color: tokens.colors.white, fontSize: tokens.typography.caption.fontSize, fontWeight: '800' },
  externalPillText: { color: tokens.colors.text.secondary, fontSize: 8, fontWeight: '900', letterSpacing: 0.8 },
  username: { color: tokens.colors.white, fontSize: tokens.typography.subhead.fontSize, fontWeight: '700' },
  description: { color: tokens.colors.white, fontSize: tokens.typography.body.fontSize, lineHeight: tokens.typography.body.lineHeight },
  hashtagRow: { flexDirection: 'row', flexWrap: 'wrap', gap: tokens.spacing.xs },
  hashtag: { color: tokens.colors.white, fontSize: tokens.typography.body.fontSize, fontWeight: '600' },
  soundRow: { flexDirection: 'row', alignItems: 'center', gap: tokens.spacing.xs, marginTop: tokens.spacing.xs },
  soundIcon: { color: tokens.colors.white, fontSize: 14 },
  soundText: { color: tokens.colors.white, fontSize: tokens.typography.body.fontSize, flex: 1 },
  productPill: { flexDirection: 'row', alignItems: 'center', gap: tokens.spacing.sm, backgroundColor: 'rgba(0,0,0,0.72)', borderRadius: tokens.radius.sm, padding: 7, marginTop: tokens.spacing.sm, alignSelf: 'flex-start', maxWidth: '100%', borderWidth: 1, borderColor: 'rgba(124,58,237,0.45)' },
  productThumb: { width: 44, height: 44, borderRadius: tokens.radius.xs, backgroundColor: tokens.colors.surface },
  productInfo: { flex: 1, minWidth: 0 },
  productTitle: { color: tokens.colors.white, fontSize: tokens.typography.caption.fontSize, fontWeight: '700' },
  productPrice: { color: tokens.colors.brand.secondary, fontSize: tokens.typography.body.fontSize, fontWeight: '800', marginTop: 1 },
  productSource: { color: tokens.colors.text.tertiary, fontSize: 9, marginTop: 1 },
  productCta: { backgroundColor: tokens.colors.brand.primary, borderRadius: tokens.radius.xs, paddingHorizontal: tokens.spacing.sm, paddingVertical: 7 },
  productCtaText: { color: tokens.colors.white, fontSize: tokens.typography.caption.fontSize, fontWeight: '800' },
});
