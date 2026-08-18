import React, { useCallback, useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, FlatList, Dimensions, Image, TouchableOpacity, RefreshControl, LayoutChangeEvent, ViewToken } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { tokens } from '@/theme/tokens';
import { useNavigation } from '@/navigation/NavigationContext';
import { VideoPlayer } from '@/components/core/VideoPlayer';
import { CommerceProduct, getCommerceProducts } from '@/services/orchidyProducts';
import { formatPrice, formatCount } from '@/services/demoShop';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

interface ProductFeedItemProps {
  product: CommerceProduct;
  isActive: boolean;
  itemHeight: number;
  onOpen: (productId: string) => void;
}

function productVideoUrl(product: CommerceProduct): string | null {
  const primary = product.primaryVideo as { url?: unknown } | null | undefined;
  const url = typeof primary?.url === 'string' ? primary.url : '';
  if (url && /^https?:\/\//i.test(url)) return url;
  if (Array.isArray(product.videos)) {
    for (const video of product.videos) {
      const entry = video as { url?: unknown } | string | null | undefined;
      const candidate = typeof entry === 'string' ? entry : entry?.url;
      if (typeof candidate === 'string' && /^https?:\/\//i.test(candidate)) return candidate;
    }
  }
  const direct = typeof (product as any).videoUrl === 'string' ? (product as any).videoUrl : '';
  return direct && /^https?:\/\//i.test(direct) ? direct : null;
}

const ProductFeedCard: React.FC<ProductFeedItemProps> = ({ product, isActive, itemHeight, onOpen }) => {
  const videoUrl = productVideoUrl(product);
  const discount =
    product.originalPrice > product.price
      ? Math.round(100 - (product.price / product.originalPrice) * 100)
      : 0;
  const image = product.images[0] || '/logo_orky.png';

  return (
    <View style={[styles.card, { height: itemHeight }]}>
      {videoUrl ? (
        <View style={styles.mediaWrap}>
          <VideoPlayer uri={videoUrl} isActive={isActive} isMuted resizeMode="cover" />
        </View>
      ) : (
        <Image source={{ uri: image }} style={styles.mediaImage} resizeMode="cover" />
      )}

      <View style={styles.overlay} pointerEvents="box-none">
        <View style={styles.topRow}>
          <View style={styles.feedBadge}><Text style={styles.feedBadgeText}>🔥 Produit du moment</Text></View>
          {product.videoAvailable ? <View style={styles.videoBadge}><Text style={styles.videoBadgeText}>▶ Vidéo produit</Text></View> : null}
        </View>

        <View style={styles.bottomBlock} pointerEvents="box-none">
          <View style={styles.priceRow}>
            <Text style={styles.price}>{formatPrice(product.price, product.currency)}</Text>
            {discount > 0 ? <Text style={styles.original}>{formatPrice(product.originalPrice, product.currency)}</Text> : null}
            {discount > 0 ? <View style={styles.discountTag}><Text style={styles.discountText}>-{discount}%</Text></View> : null}
          </View>

          <Text style={styles.title} numberOfLines={2}>{product.title}</Text>

          <View style={styles.metaRow}>
            <Text style={styles.metaText}>★ {product.rating ? product.rating.toFixed(1) : '—'}</Text>
            {product.soldCount > 0 ? <Text style={styles.metaText}>· {formatCount(product.soldCount)} vendus</Text> : null}
            {product.orderable ? <Text style={[styles.metaText, styles.inStock]}>· En stock</Text> : null}
          </View>

          <View style={styles.shopRow}>
            <Image source={{ uri: product.shopAvatar }} style={styles.shopAvatar} />
            <Text style={styles.shopName} numberOfLines={1}>{product.shopName}</Text>
            {product.freeShipping ? <Text style={styles.shipPill}>Livraison offerte</Text> : null}
          </View>

          <TouchableOpacity style={styles.buyButton} activeOpacity={0.9} onPress={() => onOpen(product.id)}>
            <Text style={styles.buyButtonText}>🛍️ Acheter sur Orchidy</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
};

export const ProductsFeedScreen: React.FC = () => {
  const insets = useSafeAreaInsets();
  const nav = useNavigation();
  const flatListRef = useRef<FlatList>(null);
  const [products, setProducts] = useState<CommerceProduct[]>([]);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [containerHeight, setContainerHeight] = useState(Dimensions.get('window').height);

  const loadPage = useCallback(async (targetPage: number, append: boolean) => {
    try {
      const items = await getCommerceProducts({ sort: 'bestseller', limit: 10, page: targetPage });
      setProducts((previous) => (append ? [...previous, ...items] : items));
      setHasMore(items.length >= 10);
      setPage(targetPage);
    } catch {
      // Keep the current content; the refresh control lets the user retry.
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadPage(1, false);
  }, [loadPage]);

  const onViewableItemsChanged = useRef(({ viewableItems }: { viewableItems: ViewToken[] }) => {
    if (viewableItems.length > 0 && viewableItems[0].index != null) {
      setCurrentIndex(viewableItems[0].index);
    }
  }).current;

  const viewabilityConfig = useRef({ itemVisiblePercentThreshold: 80, minimumViewTime: 100 }).current;

  const handleRefresh = useCallback(() => {
    setRefreshing(true);
    loadPage(1, false);
  }, [loadPage]);

  const handleEndReached = useCallback(() => {
    if (hasMore && !loading && !refreshing) {
      loadPage(page + 1, true);
    }
  }, [hasMore, loading, refreshing, page, loadPage]);

  const renderItem = useCallback(
    ({ item, index }: { item: CommerceProduct; index: number }) => (
      <ProductFeedCard
        product={item}
        isActive={index === currentIndex}
        itemHeight={containerHeight}
        onOpen={(productId) => nav.push('shop.product', { productId })}
      />
    ),
    [currentIndex, containerHeight, nav],
  );

  const keyExtractor = useCallback((item: CommerceProduct) => item.id, []);

  const getItemLayout = useCallback(
    (_: unknown, index: number) => ({ length: containerHeight, offset: containerHeight * index, index }),
    [containerHeight],
  );

  const handleLayout = useCallback((e: LayoutChangeEvent) => {
    const h = e.nativeEvent.layout.height;
    if (h > 0) setContainerHeight(h);
  }, []);

  return (
    <View style={styles.container} onLayout={handleLayout}>
      <View style={[styles.header, { paddingTop: insets.top + 6 }]}>
        <Text style={styles.headerTitle}>🔥 Produits du moment</Text>
        <Text style={styles.headerSubtitle}>Les meilleurs produits Orchidy, en vidéo</Text>
      </View>

      <FlatList
        ref={flatListRef}
        data={products}
        renderItem={renderItem}
        keyExtractor={keyExtractor}
        pagingEnabled
        showsVerticalScrollIndicator={false}
        snapToInterval={containerHeight}
        snapToAlignment="start"
        decelerationRate="fast"
        getItemLayout={getItemLayout}
        onViewableItemsChanged={onViewableItemsChanged}
        viewabilityConfig={viewabilityConfig}
        onEndReached={handleEndReached}
        onEndReachedThreshold={0.5}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={tokens.colors.white} />
        }
        removeClippedSubviews
        maxToRenderPerBatch={3}
        windowSize={5}
        initialNumToRender={2}
      />

      {loading && products.length === 0 && (
        <View style={styles.loadingOverlay}>
          <Text style={styles.loadingText}>Chargement des produits du moment…</Text>
        </View>
      )}

      {!loading && products.length === 0 && (
        <View style={styles.loadingOverlay}>
          <Text style={styles.loadingText}>Aucun produit disponible pour le moment.</Text>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: tokens.colors.black,
  },
  header: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 10,
    paddingHorizontal: tokens.spacing.md,
    paddingBottom: 10,
    backgroundColor: 'rgba(9, 9, 15, 0.55)',
  },
  headerTitle: {
    color: tokens.colors.white,
    fontSize: 20,
    fontWeight: '800',
  },
  headerSubtitle: {
    color: tokens.colors.text.secondary,
    fontSize: tokens.typography.caption.fontSize,
    marginTop: 2,
  },
  card: {
    width: SCREEN_WIDTH,
    backgroundColor: tokens.colors.black,
  },
  mediaWrap: {
    ...StyleSheet.absoluteFillObject,
  },
  mediaImage: {
    width: '100%',
    height: '100%',
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'space-between',
    paddingHorizontal: tokens.spacing.md,
    paddingBottom: 96,
    paddingTop: 96,
  },
  topRow: {
    flexDirection: 'row',
    gap: 8,
    flexWrap: 'wrap',
  },
  feedBadge: {
    backgroundColor: tokens.colors.brand.primary,
    borderRadius: tokens.radius.full,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  feedBadgeText: {
    color: tokens.colors.white,
    fontWeight: '800',
    fontSize: tokens.typography.caption.fontSize,
  },
  videoBadge: {
    backgroundColor: 'rgba(255, 255, 255, 0.18)',
    borderRadius: tokens.radius.full,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  videoBadgeText: {
    color: tokens.colors.white,
    fontWeight: '700',
    fontSize: tokens.typography.caption.fontSize,
  },
  bottomBlock: {
    gap: 8,
  },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 8,
  },
  price: {
    color: tokens.colors.white,
    fontSize: 30,
    fontWeight: '900',
  },
  original: {
    color: tokens.colors.text.secondary,
    fontSize: tokens.typography.body.fontSize,
    textDecorationLine: 'line-through',
  },
  discountTag: {
    backgroundColor: tokens.colors.semantic.success,
    borderRadius: tokens.radius.xs,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  discountText: {
    color: tokens.colors.black,
    fontWeight: '800',
    fontSize: tokens.typography.caption.fontSize,
  },
  title: {
    color: tokens.colors.white,
    fontSize: tokens.typography.subhead.fontSize,
    fontWeight: '700',
    lineHeight: 21,
    textShadowColor: 'rgba(0,0,0,0.6)',
    textShadowRadius: 4,
  },
  metaRow: {
    flexDirection: 'row',
    gap: 4,
  },
  metaText: {
    color: tokens.colors.text.secondary,
    fontSize: tokens.typography.caption.fontSize,
    fontWeight: '600',
  },
  inStock: {
    color: tokens.colors.semantic.success,
  },
  shopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  shopAvatar: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: tokens.colors.elevated,
  },
  shopName: {
    color: tokens.colors.white,
    fontSize: tokens.typography.caption.fontSize,
    fontWeight: '700',
    flexShrink: 1,
  },
  shipPill: {
    color: tokens.colors.brand.primary,
    fontSize: tokens.typography.caption.fontSize,
    fontWeight: '700',
  },
  buyButton: {
    marginTop: 4,
    backgroundColor: tokens.colors.brand.primary,
    borderRadius: tokens.radius.sm,
    paddingVertical: 14,
    alignItems: 'center',
  },
  buyButtonText: {
    color: tokens.colors.white,
    fontWeight: '800',
    fontSize: tokens.typography.body.fontSize,
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: tokens.colors.black,
  },
  loadingText: {
    color: tokens.colors.text.secondary,
    fontSize: tokens.typography.body.fontSize,
  },
});
