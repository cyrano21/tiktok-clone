import React, { useMemo, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Image, FlatList, Dimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { tokens } from '@/theme/tokens';
import { useNavigation, useRouteParams } from '@/navigation/NavigationContext';
import { useStudioStore } from '@/store/studioStore';
import {
  getSellerById,
  getProductsBySeller,
  Product,
  formatPrice,
  formatCount,
} from '@/services/demoShop';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const GRID_W = (Math.min(SCREEN_WIDTH, 430) - tokens.spacing.md * 2 - tokens.spacing.sm) / 2;

type Tab = 'products' | 'videos';

export const SellerShopScreen: React.FC = () => {
  const insets = useSafeAreaInsets();
  const nav = useNavigation();
  const { sellerId } = useRouteParams<{ sellerId?: string }>();
  const seller = sellerId ? getSellerById(sellerId) : undefined;
  const products = useMemo(() => (sellerId ? getProductsBySeller(sellerId).filter((p) => p.onSale) : []), [sellerId]);
  const videos = useStudioStore((s) => (sellerId ? s.postsBySeller(sellerId) : []));
  const [tab, setTab] = useState<Tab>('products');
  const [following, setFollowing] = useState(false);

  if (!seller) {
    return (
      <View style={[styles.container, styles.center, { paddingTop: insets.top }]}>
        <Text style={styles.missing}>Boutique introuvable</Text>
        <TouchableOpacity onPress={() => nav.back()}><Text style={styles.link}>Retour</Text></TouchableOpacity>
      </View>
    );
  }

  const renderProduct = ({ item }: { item: Product }) => {
    const discount = Math.round(100 - (item.price / item.originalPrice) * 100);
    return (
      <TouchableOpacity style={styles.card} activeOpacity={0.85} onPress={() => nav.push('shop.product', { productId: item.id })}>
        <View style={styles.cardImageWrap}>
          <Image source={{ uri: item.images[0] }} style={styles.cardImage} />
          {discount > 0 && <View style={styles.discount}><Text style={styles.discountText}>-{discount}%</Text></View>}
        </View>
        <Text style={styles.cardTitle} numberOfLines={2}>{item.title}</Text>
        <Text style={styles.cardPrice}>{formatPrice(item.price)}</Text>
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: tokens.spacing.xxl }}>
        {/* Cover + back */}
        <View>
          <Image source={{ uri: seller.cover }} style={styles.cover} />
          <View style={[styles.coverOverlay]} />
          <TouchableOpacity style={[styles.backBtn, { top: insets.top + 8 }]} onPress={() => nav.back()}>
            <Text style={styles.backBtnText}>←</Text>
          </TouchableOpacity>
        </View>

        {/* Identity */}
        <View style={styles.identity}>
          <Image source={{ uri: seller.avatar }} style={styles.avatar} />
          <Text style={styles.name}>{seller.name} {seller.verified ? '✔️' : ''}</Text>
          <Text style={styles.bio}>{seller.bio}</Text>
          <View style={styles.statsRow}>
            <View style={styles.stat}><Text style={styles.statValue}>★ {seller.rating.toFixed(1)}</Text><Text style={styles.statLabel}>Note</Text></View>
            <View style={styles.stat}><Text style={styles.statValue}>{formatCount(seller.followers)}</Text><Text style={styles.statLabel}>Abonnés</Text></View>
            <View style={styles.stat}><Text style={styles.statValue}>{products.length}</Text><Text style={styles.statLabel}>Produits</Text></View>
          </View>
          <TouchableOpacity
            style={[styles.followBtn, following && styles.followingBtn]}
            onPress={() => setFollowing((f) => !f)}
          >
            <Text style={[styles.followText, following && styles.followingText]}>{following ? 'Abonné' : "S'abonner"}</Text>
          </TouchableOpacity>
        </View>

        {/* Tabs */}
        <View style={styles.tabRow}>
          <TouchableOpacity style={[styles.tab, tab === 'products' && styles.tabActive]} onPress={() => setTab('products')}>
            <Text style={[styles.tabText, tab === 'products' && styles.tabTextActive]}>🛍️ Produits</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.tab, tab === 'videos' && styles.tabActive]} onPress={() => setTab('videos')}>
            <Text style={[styles.tabText, tab === 'videos' && styles.tabTextActive]}>🎬 Vidéos</Text>
          </TouchableOpacity>
        </View>

        {tab === 'products' ? (
          <FlatList
            data={products}
            renderItem={renderProduct}
            keyExtractor={(item) => item.id}
            numColumns={2}
            scrollEnabled={false}
            columnWrapperStyle={styles.gridRow}
            contentContainerStyle={styles.grid}
          />
        ) : (
          <View style={styles.videosWrap}>
            {videos.length === 0 ? (
              <Text style={styles.emptyText}>Pas encore de vidéo produit. Crée-en une depuis ta boutique.</Text>
            ) : (
              <View style={styles.videoGrid}>
                {videos.map((v) => (
                  <TouchableOpacity
                    key={v.id}
                    style={styles.videoCell}
                    onPress={() => v.productId && nav.push('shop.product', { productId: v.productId })}
                  >
                    <Image source={{ uri: v.thumbnailUrl }} style={styles.videoThumb} />
                    <View style={styles.videoBadge}><Text style={styles.videoBadgeText}>▶</Text></View>
                    {v.overlayText ? <Text style={styles.videoOverlay} numberOfLines={1}>{v.overlayText}</Text> : null}
                  </TouchableOpacity>
                ))}
              </View>
            )}
          </View>
        )}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: tokens.colors.bg },
  center: { justifyContent: 'center', alignItems: 'center', gap: tokens.spacing.md },
  missing: { color: tokens.colors.white, fontSize: tokens.typography.subhead.fontSize },
  link: { color: tokens.colors.brand.primary, fontWeight: '700' },
  cover: { width: '100%', height: 160, backgroundColor: tokens.colors.surface },
  coverOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.25)' },
  backBtn: { position: 'absolute', left: tokens.spacing.md, width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center' },
  backBtnText: { color: tokens.colors.white, fontSize: 18 },
  identity: { alignItems: 'center', paddingHorizontal: tokens.spacing.lg, marginTop: -36 },
  avatar: { width: 72, height: 72, borderRadius: 36, borderWidth: 3, borderColor: tokens.colors.bg, backgroundColor: tokens.colors.surface },
  name: { color: tokens.colors.white, fontSize: tokens.typography.title.fontSize, fontWeight: '800', marginTop: tokens.spacing.sm },
  bio: { color: tokens.colors.text.secondary, fontSize: tokens.typography.body.fontSize, textAlign: 'center', marginTop: tokens.spacing.xs },
  statsRow: { flexDirection: 'row', gap: tokens.spacing.xl, marginTop: tokens.spacing.md },
  stat: { alignItems: 'center' },
  statValue: { color: tokens.colors.white, fontSize: tokens.typography.subhead.fontSize, fontWeight: '700' },
  statLabel: { color: tokens.colors.text.secondary, fontSize: tokens.typography.caption.fontSize },
  followBtn: { marginTop: tokens.spacing.md, backgroundColor: tokens.colors.brand.primary, borderRadius: tokens.radius.sm, paddingHorizontal: tokens.spacing.xxl, paddingVertical: tokens.spacing.sm },
  followingBtn: { backgroundColor: 'transparent', borderWidth: 1, borderColor: tokens.colors.surface },
  followText: { color: tokens.colors.white, fontSize: tokens.typography.body.fontSize, fontWeight: '700' },
  followingText: { color: tokens.colors.text.secondary },
  tabRow: { flexDirection: 'row', marginTop: tokens.spacing.lg, borderBottomWidth: 0.5, borderBottomColor: tokens.colors.surface },
  tab: { flex: 1, alignItems: 'center', paddingVertical: tokens.spacing.md, borderBottomWidth: 2, borderBottomColor: 'transparent' },
  tabActive: { borderBottomColor: tokens.colors.white },
  tabText: { color: tokens.colors.text.secondary, fontSize: tokens.typography.body.fontSize, fontWeight: '500' },
  tabTextActive: { color: tokens.colors.white, fontWeight: '700' },
  grid: { padding: tokens.spacing.md },
  gridRow: { gap: tokens.spacing.sm, marginBottom: tokens.spacing.sm },
  card: { width: GRID_W, backgroundColor: tokens.colors.elevated, borderRadius: tokens.radius.md, overflow: 'hidden', paddingBottom: tokens.spacing.sm },
  cardImageWrap: { width: '100%', aspectRatio: 3 / 4, backgroundColor: tokens.colors.surface },
  cardImage: { width: '100%', height: '100%' },
  discount: { position: 'absolute', top: tokens.spacing.sm, left: tokens.spacing.sm, backgroundColor: tokens.colors.brand.primary, borderRadius: tokens.radius.xs, paddingHorizontal: 6, paddingVertical: 2 },
  discountText: { color: tokens.colors.white, fontSize: 11, fontWeight: '800' },
  cardTitle: { color: tokens.colors.white, fontSize: tokens.typography.body.fontSize, lineHeight: 18, paddingHorizontal: tokens.spacing.sm, paddingTop: tokens.spacing.sm, minHeight: 36 },
  cardPrice: { color: tokens.colors.brand.primary, fontSize: tokens.typography.subhead.fontSize, fontWeight: '800', paddingHorizontal: tokens.spacing.sm, marginTop: 2 },
  videosWrap: { padding: tokens.spacing.md },
  videoGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 2 },
  videoCell: { width: (Math.min(SCREEN_WIDTH, 430) - tokens.spacing.md * 2 - 4) / 3, aspectRatio: 9 / 16, backgroundColor: tokens.colors.surface, borderRadius: tokens.radius.xs, overflow: 'hidden', justifyContent: 'flex-end' },
  videoThumb: { ...StyleSheet.absoluteFillObject, width: '100%', height: '100%' },
  videoBadge: { position: 'absolute', top: 6, right: 6, width: 22, height: 22, borderRadius: 11, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center' },
  videoBadgeText: { color: tokens.colors.white, fontSize: 10 },
  videoOverlay: { color: tokens.colors.white, fontSize: 10, fontWeight: '700', padding: 4, backgroundColor: 'rgba(0,0,0,0.4)' },
  emptyText: { color: tokens.colors.text.secondary, fontSize: tokens.typography.body.fontSize, textAlign: 'center', paddingVertical: tokens.spacing.xl },
});
