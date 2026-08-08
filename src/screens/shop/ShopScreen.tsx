import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, FlatList, Image, Dimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { tokens } from '@/theme/tokens';
import { useNavigation } from '@/navigation/NavigationContext';
import { useCartStore } from '@/store/cartStore';
import {
  SHOP_CATEGORIES,
  ProductCategory,
  formatPrice,
  formatCount,
} from '@/services/demoShop';
import { CommerceProduct, getCommerceProducts } from '@/services/orchidyProducts';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const COLUMN_GAP = tokens.spacing.sm;
const H_PADDING = tokens.spacing.md;
const CARD_WIDTH = (Math.min(SCREEN_WIDTH, 430) - H_PADDING * 2 - COLUMN_GAP) / 2;

export const ShopScreen: React.FC = () => {
  const insets = useSafeAreaInsets();
  const nav = useNavigation();
  const cartCount = useCartStore((s) => s.totalItems());
  const [category, setCategory] = useState<ProductCategory>('all');
  const [products, setProducts] = useState<CommerceProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [source, setSource] = useState<'orchidy' | 'demo'>('demo');

  useEffect(() => {
    let mounted = true;
    setLoading(true);
    getCommerceProducts({ category, limit: 24 })
      .then((items) => {
        if (!mounted) return;
        setProducts(items);
        setSource(items.some((item) => item.source === 'orchidy') ? 'orchidy' : 'demo');
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });
    return () => { mounted = false; };
  }, [category]);

  const subtitle = useMemo(() => {
    if (loading) return 'Chargement du catalogue…';
    if (source === 'orchidy') return 'Produits réels Orchidy';
    return 'Démo locale — catalogue Orchidy indisponible';
  }, [loading, source]);

  const renderProduct = ({ item }: { item: CommerceProduct }) => {
    const discount = item.originalPrice > item.price
      ? Math.round(100 - (item.price / item.originalPrice) * 100)
      : 0;
    return (
      <TouchableOpacity
        style={styles.card}
        activeOpacity={0.85}
        onPress={() => nav.push('shop.product', { productId: item.id })}
      >
        <View style={styles.imageWrap}>
          <Image source={{ uri: item.images[0] }} style={styles.image} />
          {item.source === 'orchidy' && (
            <View style={styles.sourceBadge}>
              <Text style={styles.sourceText}>Orchidy</Text>
            </View>
          )}
          {discount > 0 && (
            <View style={styles.discountBadge}>
              <Text style={styles.discountText}>-{discount}%</Text>
            </View>
          )}
          {item.freeShipping && (
            <View style={styles.shipBadge}>
              <Text style={styles.shipText}>Livraison offerte</Text>
            </View>
          )}
        </View>

        <View style={styles.cardBody}>
          <Text style={styles.cardTitle} numberOfLines={2}>{item.title}</Text>
          <View style={styles.priceRow}>
            <Text style={styles.price}>{formatPrice(item.price, item.currency)}</Text>
            {item.originalPrice > item.price && (
              <Text style={styles.original}>{formatPrice(item.originalPrice, item.currency)}</Text>
            )}
          </View>
          <View style={styles.metaRow}>
            <Text style={styles.rating}>★ {item.rating ? item.rating.toFixed(1) : '—'}</Text>
            <Text style={styles.sold}>{formatCount(item.soldCount)} vendus</Text>
          </View>
          <View style={styles.shopRow}>
            <Image source={{ uri: item.shopAvatar }} style={styles.shopAvatar} />
            <Text style={styles.shopName} numberOfLines={1}>{item.shopName}</Text>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>Shop</Text>
          <Text style={styles.headerSubtitle}>{subtitle}</Text>
        </View>
        <TouchableOpacity style={styles.cartButton} onPress={() => nav.push('shop.cart')}>
          <Text style={styles.cartIcon}>🛒</Text>
          {cartCount > 0 && (
            <View style={styles.cartBadge}>
              <Text style={styles.cartBadgeText}>{cartCount > 99 ? '99+' : cartCount}</Text>
            </View>
          )}
        </TouchableOpacity>
      </View>

      <View style={styles.searchBar}>
        <Text style={styles.searchIcon}>🔍</Text>
        <Text style={styles.searchPlaceholder}>Rechercher un produit</Text>
      </View>

      <View style={styles.catWrap}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.catContent}>
          {SHOP_CATEGORIES.map((c) => (
            <TouchableOpacity
              key={c.id}
              style={[styles.catChip, category === c.id && styles.catChipActive]}
              onPress={() => setCategory(c.id)}
            >
              <Text style={styles.catIcon}>{c.icon}</Text>
              <Text style={[styles.catLabel, category === c.id && styles.catLabelActive]}>{c.label}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {loading && products.length === 0 ? (
        <View style={styles.loadingBlock}>
          <Text style={styles.loadingText}>Connexion au catalogue Orchidy…</Text>
        </View>
      ) : (
        <FlatList
          data={products}
          renderItem={renderProduct}
          keyExtractor={(item) => item.id}
          numColumns={2}
          columnWrapperStyle={styles.row}
          contentContainerStyle={styles.grid}
          showsVerticalScrollIndicator={false}
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: tokens.colors.bg },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: H_PADDING,
    paddingVertical: tokens.spacing.sm,
  },
  headerTitle: { color: tokens.colors.white, fontSize: tokens.typography.headline.fontSize, fontWeight: '800' },
  headerSubtitle: { color: tokens.colors.text.tertiary, fontSize: tokens.typography.caption.fontSize, marginTop: 2 },
  cartButton: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  cartIcon: { fontSize: 24 },
  cartBadge: {
    position: 'absolute',
    top: 2,
    right: 0,
    minWidth: 18,
    height: 18,
    paddingHorizontal: 4,
    borderRadius: 9,
    backgroundColor: tokens.colors.brand.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cartBadgeText: { color: tokens.colors.white, fontSize: 10, fontWeight: '800' },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.spacing.sm,
    marginHorizontal: H_PADDING,
    backgroundColor: tokens.colors.elevated,
    borderRadius: tokens.radius.full,
    paddingHorizontal: tokens.spacing.md,
    height: 38,
  },
  searchIcon: { fontSize: 14 },
  searchPlaceholder: { color: tokens.colors.text.tertiary, fontSize: tokens.typography.body.fontSize },
  catWrap: { marginTop: tokens.spacing.sm },
  catContent: { paddingHorizontal: H_PADDING, gap: tokens.spacing.sm, paddingVertical: tokens.spacing.sm },
  catChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: tokens.spacing.md,
    paddingVertical: 8,
    borderRadius: tokens.radius.full,
    backgroundColor: tokens.colors.elevated,
  },
  catChipActive: { backgroundColor: tokens.colors.brand.primary },
  catIcon: { fontSize: 15 },
  catLabel: { color: tokens.colors.text.secondary, fontSize: tokens.typography.body.fontSize, fontWeight: '500' },
  catLabelActive: { color: tokens.colors.white, fontWeight: '700' },
  loadingBlock: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: H_PADDING },
  loadingText: { color: tokens.colors.text.secondary, fontSize: tokens.typography.body.fontSize },
  grid: { paddingHorizontal: H_PADDING, paddingBottom: 110 },
  row: { gap: COLUMN_GAP, marginBottom: COLUMN_GAP },
  card: {
    width: CARD_WIDTH,
    backgroundColor: tokens.colors.elevated,
    borderRadius: tokens.radius.md,
    overflow: 'hidden',
  },
  imageWrap: { width: '100%', aspectRatio: 3 / 4, position: 'relative', backgroundColor: tokens.colors.surface },
  image: { width: '100%', height: '100%' },
  sourceBadge: {
    position: 'absolute',
    top: tokens.spacing.sm,
    right: tokens.spacing.sm,
    backgroundColor: tokens.colors.brand.secondary,
    borderRadius: tokens.radius.xs,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  sourceText: { color: tokens.colors.white, fontSize: 9, fontWeight: '800' },
  discountBadge: {
    position: 'absolute',
    top: tokens.spacing.sm,
    left: tokens.spacing.sm,
    backgroundColor: tokens.colors.brand.primary,
    borderRadius: tokens.radius.xs,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  discountText: { color: tokens.colors.white, fontSize: 11, fontWeight: '800' },
  shipBadge: {
    position: 'absolute',
    bottom: tokens.spacing.sm,
    left: tokens.spacing.sm,
    backgroundColor: 'rgba(0,0,0,0.6)',
    borderRadius: tokens.radius.xs,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  shipText: { color: tokens.colors.white, fontSize: 9, fontWeight: '600' },
  cardBody: { padding: tokens.spacing.sm, gap: 4 },
  cardTitle: { color: tokens.colors.white, fontSize: tokens.typography.body.fontSize, lineHeight: 18, minHeight: 36 },
  priceRow: { flexDirection: 'row', alignItems: 'baseline', gap: 6 },
  price: { color: tokens.colors.brand.primary, fontSize: tokens.typography.subhead.fontSize, fontWeight: '800' },
  original: { color: tokens.colors.text.tertiary, fontSize: tokens.typography.caption.fontSize, textDecorationLine: 'line-through' },
  metaRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  rating: { color: tokens.colors.action.tip, fontSize: tokens.typography.caption.fontSize, fontWeight: '600' },
  sold: { color: tokens.colors.text.secondary, fontSize: tokens.typography.caption.fontSize },
  shopRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 2 },
  shopAvatar: { width: 16, height: 16, borderRadius: 8, backgroundColor: tokens.colors.surface },
  shopName: { color: tokens.colors.text.secondary, fontSize: tokens.typography.caption.fontSize, flex: 1 },
});
