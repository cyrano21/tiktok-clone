import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Image, Dimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { tokens } from '@/theme/tokens';
import { useNavigation, useRouteParams } from '@/navigation/NavigationContext';
import { useCartStore } from '@/store/cartStore';
import { getProductById, formatPrice, formatCount } from '@/services/demoShop';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const IMG_WIDTH = Math.min(SCREEN_WIDTH, 430);

export const ProductScreen: React.FC = () => {
  const insets = useSafeAreaInsets();
  const nav = useNavigation();
  const { productId } = useRouteParams<{ productId?: string }>();
  const product = productId ? getProductById(productId) : undefined;

  const addToCart = useCartStore((s) => s.addToCart);
  const cartCount = useCartStore((s) => s.totalItems());

  const [imageIndex, setImageIndex] = useState(0);
  const [variantId, setVariantId] = useState(product?.variants[0]?.id ?? '');
  const [quantity, setQuantity] = useState(1);
  const [added, setAdded] = useState(false);

  if (!product) {
    return (
      <View style={[styles.container, styles.center, { paddingTop: insets.top }]}>
        <Text style={styles.missing}>Produit introuvable</Text>
        <TouchableOpacity style={styles.backLink} onPress={() => nav.back()}>
          <Text style={styles.backLinkText}>Retour</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const discount = Math.round(100 - (product.price / product.originalPrice) * 100);

  const handleAdd = (goToCart: boolean) => {
    addToCart(product, variantId, quantity);
    if (goToCart) {
      nav.push('shop.cart');
    } else {
      setAdded(true);
      setTimeout(() => setAdded(false), 1600);
    }
  };

  const onScrollImages = (e: { nativeEvent: { contentOffset: { x: number } } }) => {
    const idx = Math.round(e.nativeEvent.contentOffset.x / IMG_WIDTH);
    if (idx !== imageIndex) setImageIndex(idx);
  };

  return (
    <View style={styles.container}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 96 }}>
        {/* Image carousel */}
        <View>
          <ScrollView
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            onScroll={onScrollImages}
            scrollEventThrottle={16}
          >
            {product.images.map((uri, i) => (
              <Image key={i} source={{ uri }} style={styles.heroImage} />
            ))}
          </ScrollView>

          <View style={[styles.topBar, { top: insets.top + 8 }]} pointerEvents="box-none">
            <TouchableOpacity style={styles.circleBtn} onPress={() => nav.back()}>
              <Text style={styles.circleBtnText}>←</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.circleBtn} onPress={() => nav.push('shop.cart')}>
              <Text style={styles.circleBtnText}>🛒</Text>
              {cartCount > 0 && (
                <View style={styles.miniBadge}>
                  <Text style={styles.miniBadgeText}>{cartCount > 99 ? '99+' : cartCount}</Text>
                </View>
              )}
            </TouchableOpacity>
          </View>

          {product.images.length > 1 && (
            <View style={styles.dots}>
              {product.images.map((_, i) => (
                <View key={i} style={[styles.dot, i === imageIndex && styles.dotActive]} />
              ))}
            </View>
          )}
        </View>

        {/* Price block */}
        <View style={styles.priceBlock}>
          <View style={styles.priceLine}>
            <Text style={styles.price}>{formatPrice(product.price, product.currency)}</Text>
            <Text style={styles.original}>{formatPrice(product.originalPrice, product.currency)}</Text>
            {discount > 0 && (
              <View style={styles.discountTag}>
                <Text style={styles.discountTagText}>-{discount}%</Text>
              </View>
            )}
          </View>
          <Text style={styles.title}>{product.title}</Text>
          <View style={styles.statsRow}>
            <Text style={styles.statRating}>★ {product.rating.toFixed(1)}</Text>
            <Text style={styles.statDot}>·</Text>
            <Text style={styles.statText}>{formatCount(product.reviewsCount)} avis</Text>
            <Text style={styles.statDot}>·</Text>
            <Text style={styles.statText}>{formatCount(product.soldCount)} vendus</Text>
          </View>
          {product.badges.length > 0 && (
            <View style={styles.badgeRow}>
              {product.badges.map((b) => (
                <View key={b} style={styles.badge}>
                  <Text style={styles.badgeText}>{b}</Text>
                </View>
              ))}
            </View>
          )}
        </View>

        {/* Shop row */}
        <View style={styles.shopBlock}>
          <Image source={{ uri: product.shopAvatar }} style={styles.shopAvatar} />
          <View style={{ flex: 1 }}>
            <Text style={styles.shopName}>{product.shopName}</Text>
            <Text style={styles.shopMeta}>Boutique officielle · ★ 4.9</Text>
          </View>
          <TouchableOpacity style={styles.visitBtn} onPress={() => nav.push('shop.seller', { sellerId: product.sellerId })}>
            <Text style={styles.visitBtnText}>Visiter</Text>
          </TouchableOpacity>
        </View>

        {/* Variants */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>
            Variante : <Text style={styles.sectionValue}>{product.variants.find((v) => v.id === variantId)?.label}</Text>
          </Text>
          <View style={styles.variantRow}>
            {product.variants.map((v) => (
              <TouchableOpacity
                key={v.id}
                style={[styles.variantChip, variantId === v.id && styles.variantChipActive]}
                onPress={() => setVariantId(v.id)}
              >
                <Text style={[styles.variantText, variantId === v.id && styles.variantTextActive]}>{v.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Quantity */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Quantité</Text>
          <View style={styles.qtyRow}>
            <TouchableOpacity
              style={[styles.qtyBtn, quantity <= 1 && styles.qtyBtnDisabled]}
              onPress={() => setQuantity((q) => Math.max(1, q - 1))}
              disabled={quantity <= 1}
            >
              <Text style={styles.qtyBtnText}>−</Text>
            </TouchableOpacity>
            <Text style={styles.qtyValue}>{quantity}</Text>
            <TouchableOpacity style={styles.qtyBtn} onPress={() => setQuantity((q) => Math.min(99, q + 1))}>
              <Text style={styles.qtyBtnText}>+</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Description */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Description</Text>
          <Text style={styles.description}>{product.description}</Text>
        </View>
      </ScrollView>

      {/* Bottom action bar */}
      <View style={[styles.actionBar, { paddingBottom: insets.bottom || tokens.spacing.sm }]}>
        <TouchableOpacity style={styles.addBtn} onPress={() => handleAdd(false)}>
          <Text style={styles.addBtnText}>{added ? '✓ Ajouté' : 'Ajouter au panier'}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.buyBtn} onPress={() => handleAdd(true)}>
          <Text style={styles.buyBtnText}>Acheter</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: tokens.colors.bg },
  center: { justifyContent: 'center', alignItems: 'center', gap: tokens.spacing.md },
  missing: { color: tokens.colors.white, fontSize: tokens.typography.subhead.fontSize },
  backLink: { paddingHorizontal: tokens.spacing.lg, paddingVertical: tokens.spacing.sm, backgroundColor: tokens.colors.brand.primary, borderRadius: tokens.radius.sm },
  backLinkText: { color: tokens.colors.white, fontWeight: '700' },
  heroImage: { width: IMG_WIDTH, aspectRatio: 1, backgroundColor: tokens.colors.surface },
  topBar: {
    position: 'absolute',
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: tokens.spacing.md,
  },
  circleBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  circleBtnText: { color: tokens.colors.white, fontSize: 18 },
  miniBadge: {
    position: 'absolute',
    top: -2,
    right: -2,
    minWidth: 16,
    height: 16,
    paddingHorizontal: 3,
    borderRadius: 8,
    backgroundColor: tokens.colors.brand.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  miniBadgeText: { color: tokens.colors.white, fontSize: 9, fontWeight: '800' },
  dots: {
    position: 'absolute',
    bottom: tokens.spacing.sm,
    alignSelf: 'center',
    flexDirection: 'row',
    gap: 5,
  },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.4)' },
  dotActive: { backgroundColor: tokens.colors.white, width: 16 },
  priceBlock: { padding: tokens.spacing.md, gap: tokens.spacing.sm },
  priceLine: { flexDirection: 'row', alignItems: 'baseline', gap: tokens.spacing.sm },
  price: { color: tokens.colors.brand.primary, fontSize: tokens.typography.display.fontSize, fontWeight: '800' },
  original: { color: tokens.colors.text.tertiary, fontSize: tokens.typography.body.fontSize, textDecorationLine: 'line-through' },
  discountTag: { backgroundColor: tokens.colors.brand.primary + '22', borderRadius: tokens.radius.xs, paddingHorizontal: 6, paddingVertical: 2 },
  discountTagText: { color: tokens.colors.brand.primary, fontSize: tokens.typography.caption.fontSize, fontWeight: '800' },
  title: { color: tokens.colors.white, fontSize: tokens.typography.subhead.fontSize, fontWeight: '600', lineHeight: 22 },
  statsRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  statRating: { color: tokens.colors.action.tip, fontSize: tokens.typography.body.fontSize, fontWeight: '700' },
  statDot: { color: tokens.colors.text.tertiary },
  statText: { color: tokens.colors.text.secondary, fontSize: tokens.typography.body.fontSize },
  badgeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: tokens.spacing.xs },
  badge: { backgroundColor: tokens.colors.elevated, borderRadius: tokens.radius.xs, paddingHorizontal: tokens.spacing.sm, paddingVertical: 3 },
  badgeText: { color: tokens.colors.brand.secondary, fontSize: tokens.typography.caption.fontSize, fontWeight: '600' },
  shopBlock: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.spacing.sm,
    marginHorizontal: tokens.spacing.md,
    padding: tokens.spacing.sm,
    backgroundColor: tokens.colors.elevated,
    borderRadius: tokens.radius.md,
  },
  shopAvatar: { width: 40, height: 40, borderRadius: 20, backgroundColor: tokens.colors.surface },
  shopName: { color: tokens.colors.white, fontSize: tokens.typography.body.fontSize, fontWeight: '700' },
  shopMeta: { color: tokens.colors.text.secondary, fontSize: tokens.typography.caption.fontSize, marginTop: 2 },
  visitBtn: { borderWidth: 1, borderColor: tokens.colors.surface, borderRadius: tokens.radius.sm, paddingHorizontal: tokens.spacing.md, paddingVertical: 6 },
  visitBtnText: { color: tokens.colors.white, fontSize: tokens.typography.caption.fontSize, fontWeight: '600' },
  section: { paddingHorizontal: tokens.spacing.md, paddingTop: tokens.spacing.lg, gap: tokens.spacing.sm },
  sectionTitle: { color: tokens.colors.white, fontSize: tokens.typography.body.fontSize, fontWeight: '700' },
  sectionValue: { color: tokens.colors.text.secondary, fontWeight: '500' },
  variantRow: { flexDirection: 'row', flexWrap: 'wrap', gap: tokens.spacing.sm },
  variantChip: {
    paddingHorizontal: tokens.spacing.md,
    paddingVertical: 8,
    borderRadius: tokens.radius.sm,
    borderWidth: 1,
    borderColor: tokens.colors.surface,
    backgroundColor: tokens.colors.elevated,
  },
  variantChipActive: { borderColor: tokens.colors.brand.primary, backgroundColor: tokens.colors.brand.primary + '1A' },
  variantText: { color: tokens.colors.text.secondary, fontSize: tokens.typography.body.fontSize },
  variantTextActive: { color: tokens.colors.brand.primary, fontWeight: '700' },
  qtyRow: { flexDirection: 'row', alignItems: 'center', gap: tokens.spacing.md },
  qtyBtn: {
    width: 36,
    height: 36,
    borderRadius: tokens.radius.sm,
    backgroundColor: tokens.colors.elevated,
    justifyContent: 'center',
    alignItems: 'center',
  },
  qtyBtnDisabled: { opacity: 0.4 },
  qtyBtnText: { color: tokens.colors.white, fontSize: 20, fontWeight: '700' },
  qtyValue: { color: tokens.colors.white, fontSize: tokens.typography.subhead.fontSize, fontWeight: '700', minWidth: 28, textAlign: 'center' },
  description: { color: tokens.colors.text.secondary, fontSize: tokens.typography.body.fontSize, lineHeight: 21 },
  actionBar: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    flexDirection: 'row',
    gap: tokens.spacing.sm,
    paddingHorizontal: tokens.spacing.md,
    paddingTop: tokens.spacing.sm,
    backgroundColor: 'rgba(0,0,0,0.96)',
    borderTopWidth: 0.5,
    borderTopColor: tokens.colors.surface,
  },
  addBtn: {
    flex: 1,
    height: 48,
    borderRadius: tokens.radius.sm,
    borderWidth: 1,
    borderColor: tokens.colors.brand.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  addBtnText: { color: tokens.colors.brand.primary, fontSize: tokens.typography.body.fontSize, fontWeight: '700' },
  buyBtn: {
    flex: 1,
    height: 48,
    borderRadius: tokens.radius.sm,
    backgroundColor: tokens.colors.brand.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  buyBtnText: { color: tokens.colors.white, fontSize: tokens.typography.body.fontSize, fontWeight: '800' },
});
