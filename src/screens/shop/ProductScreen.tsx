import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Image, Dimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { tokens } from '@/theme/tokens';
import { useNavigation, useRouteParams } from '@/navigation/NavigationContext';
import { useCartStore } from '@/store/cartStore';
import { formatPrice, formatCount } from '@/services/demoShop';
import { CommerceProduct, getCommerceProductById } from '@/services/orchidyProducts';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const IMG_WIDTH = Math.min(SCREEN_WIDTH, 430);

function openExternalProduct(url?: string) {
  if (!url || typeof window === 'undefined') return;
  window.open(url, '_blank', 'noopener,noreferrer');
}

export const ProductScreen: React.FC = () => {
  const insets = useSafeAreaInsets();
  const nav = useNavigation();
  const { productId } = useRouteParams<{ productId?: string }>();
  const [product, setProduct] = useState<CommerceProduct | undefined>();
  const [loading, setLoading] = useState(Boolean(productId));
  const addToCart = useCartStore((s) => s.addToCart);
  const cartCount = useCartStore((s) => s.totalItems());
  const [imageIndex, setImageIndex] = useState(0);
  const [variantId, setVariantId] = useState('');
  const [quantity, setQuantity] = useState(1);
  const [added, setAdded] = useState(false);

  useEffect(() => {
    let mounted = true;
    setLoading(Boolean(productId));
    if (!productId) {
      setProduct(undefined);
      setLoading(false);
      return () => { mounted = false; };
    }
    void getCommerceProductById(productId)
      .then((resolved) => {
        if (!mounted) return;
        setProduct(resolved);
        setVariantId(resolved?.variants[0]?.id ?? 'default');
      })
      .finally(() => { if (mounted) setLoading(false); });
    return () => { mounted = false; };
  }, [productId]);

  if (loading) {
    return <View style={[styles.container, styles.center, { paddingTop: insets.top }]}><Text style={styles.missing}>Chargement du produit…</Text></View>;
  }
  if (!product) {
    return <View style={[styles.container, styles.center, { paddingTop: insets.top }]}><Text style={styles.missing}>Produit introuvable</Text><TouchableOpacity style={styles.backLink} onPress={() => nav.back()}><Text style={styles.backLinkText}>Retour</Text></TouchableOpacity></View>;
  }

  const discount = product.originalPrice > product.price ? Math.round(100 - (product.price / product.originalPrice) * 100) : 0;
  const isOrchidyProduct = product.source === 'orchidy';
  const orderable = product.orderable !== false && (isOrchidyProduct || process.env.NEXT_PUBLIC_USE_DEMO === 'true');
  const selectedVariant = product.variants.find((v) => v.id === variantId) ?? product.variants[0];

  const handleAdd = (goToCart: boolean) => {
    if (!orderable) return;
    addToCart(product, selectedVariant?.id || 'default', quantity);
    if (goToCart) nav.push('shop.cart');
    else {
      setAdded(true);
      setTimeout(() => setAdded(false), 1600);
    }
  };

  const createVideo = () => {
    if (!isOrchidyProduct || !product.externalId) return;
    nav.push('studio.editor', {
      productId: product.id,
      orchidyCatalogItemId: product.externalId,
      variantKey: selectedVariant?.id && selectedVariant.id !== 'default' ? selectedVariant.id : undefined,
    });
  };

  return (
    <View style={styles.container}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        <View>
          <ScrollView horizontal pagingEnabled showsHorizontalScrollIndicator={false} onScroll={(e) => setImageIndex(Math.round(e.nativeEvent.contentOffset.x / IMG_WIDTH))} scrollEventThrottle={16}>
            {product.images.map((uri, i) => <Image key={`${uri}-${i}`} source={{ uri }} style={styles.heroImage} />)}
          </ScrollView>
          <View style={[styles.topBar, { top: insets.top + 8 }]}>
            <TouchableOpacity style={styles.circleBtn} onPress={() => nav.back()}><Text style={styles.circleBtnText}>←</Text></TouchableOpacity>
            <TouchableOpacity style={styles.circleBtn} onPress={() => nav.push('shop.cart')}><Text style={styles.circleBtnText}>🛒</Text>{cartCount > 0 ? <View style={styles.miniBadge}><Text style={styles.miniBadgeText}>{cartCount > 99 ? '99+' : cartCount}</Text></View> : null}</TouchableOpacity>
          </View>
          {product.images.length > 1 ? <View style={styles.dots}>{product.images.map((_, i) => <View key={i} style={[styles.dot, i === imageIndex && styles.dotActive]} />)}</View> : null}
        </View>

        <View style={styles.priceBlock}>
          <View style={styles.sourceRow}><Text style={[styles.sourcePill, isOrchidyProduct && styles.sourcePillActive]}>{isOrchidyProduct ? 'Produit Orchidy réel' : 'Produit démo'}</Text>{isOrchidyProduct ? <Text style={styles.videoOptional}>Vidéo shoppable possible</Text> : null}</View>
          <View style={styles.priceLine}><Text style={styles.price}>{formatPrice(product.price, product.currency)}</Text>{product.originalPrice > product.price ? <Text style={styles.original}>{formatPrice(product.originalPrice, product.currency)}</Text> : null}{discount > 0 ? <View style={styles.discountTag}><Text style={styles.discountTagText}>-{discount}%</Text></View> : null}</View>
          <Text style={styles.title}>{product.title}</Text>
          <View style={styles.statsRow}><Text style={styles.statRating}>★ {product.rating ? product.rating.toFixed(1) : '—'}</Text><Text style={styles.statDot}>·</Text><Text style={styles.statText}>{formatCount(product.reviewsCount)} avis</Text><Text style={styles.statDot}>·</Text><Text style={styles.statText}>{formatCount(product.soldCount)} vendus</Text></View>
          {product.availabilityLabel ? <Text style={styles.availability}>{product.availabilityLabel}</Text> : null}
        </View>

        <View style={styles.shopBlock}>
          <Image source={{ uri: product.shopAvatar }} style={styles.shopAvatar} />
          <View style={{ flex: 1 }}><Text style={styles.shopName}>{product.shopName}</Text><Text style={styles.shopMeta}>{isOrchidyProduct ? 'Boutique Orchidy' : 'Boutique de démonstration'}</Text></View>
          {isOrchidyProduct ? <TouchableOpacity style={styles.visitBtn} onPress={() => openExternalProduct(product.externalUrl)}><Text style={styles.visitBtnText}>Voir sur Orchidy ↗</Text></TouchableOpacity> : null}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Variante : <Text style={styles.sectionValue}>{selectedVariant?.label ?? 'Standard'}</Text></Text>
          <View style={styles.variantRow}>{product.variants.map((v) => <TouchableOpacity key={v.id} style={[styles.variantChip, variantId === v.id && styles.variantChipActive]} onPress={() => setVariantId(v.id)}><Text style={[styles.variantText, variantId === v.id && styles.variantTextActive]}>{v.label}</Text></TouchableOpacity>)}</View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Quantité</Text>
          <View style={styles.qtyRow}><TouchableOpacity style={[styles.qtyBtn, quantity <= 1 && styles.qtyBtnDisabled]} onPress={() => setQuantity((q) => Math.max(1, q - 1))} disabled={quantity <= 1}><Text style={styles.qtyBtnText}>−</Text></TouchableOpacity><Text style={styles.qtyValue}>{quantity}</Text><TouchableOpacity style={styles.qtyBtn} onPress={() => setQuantity((q) => Math.min(25, q + 1))}><Text style={styles.qtyBtnText}>+</Text></TouchableOpacity></View>
        </View>

        {isOrchidyProduct ? <View style={styles.videoCard}><Text style={styles.videoTitle}>Associer ce produit à une vidéo ORKY</Text><Text style={styles.videoText}>La vidéo stockera uniquement l’identifiant catalogue. Le prix, le stock, la devise et le paiement resteront contrôlés par Orchidy.</Text><TouchableOpacity style={styles.videoBtn} onPress={createVideo}><Text style={styles.videoBtnText}>🎬 Créer une vidéo shoppable</Text></TouchableOpacity></View> : null}

        <View style={styles.section}><Text style={styles.sectionTitle}>Description</Text><Text style={styles.description}>{product.description}</Text></View>
      </ScrollView>

      <View style={[styles.actionBar, { paddingBottom: Math.max(insets.bottom, tokens.spacing.sm) }]}>
        <TouchableOpacity style={[styles.addBtn, !orderable && styles.btnDisabled]} onPress={() => handleAdd(false)} disabled={!orderable}><Text style={styles.addBtnText}>{added ? '✓ Ajouté' : orderable ? 'Ajouter au panier' : 'Indisponible'}</Text></TouchableOpacity>
        <TouchableOpacity style={[styles.buyBtn, !orderable && styles.btnDisabled]} disabled={!orderable} onPress={() => handleAdd(true)}><Text style={styles.buyBtnText}>{isOrchidyProduct ? 'Acheter via Orchidy' : 'Mode démo'}</Text></TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: tokens.colors.bg }, center: { justifyContent: 'center', alignItems: 'center', gap: tokens.spacing.md }, missing: { color: tokens.colors.white, fontSize: tokens.typography.subhead.fontSize }, backLink: { paddingHorizontal: tokens.spacing.lg, paddingVertical: tokens.spacing.sm, backgroundColor: tokens.colors.brand.primary, borderRadius: tokens.radius.sm }, backLinkText: { color: tokens.colors.white, fontWeight: '700' }, scrollContent: { paddingBottom: 132 },
  heroImage: { width: IMG_WIDTH, aspectRatio: 1, backgroundColor: tokens.colors.surface }, topBar: { position: 'absolute', left: 0, right: 0, flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: tokens.spacing.md }, circleBtn: { width: 38, height: 38, borderRadius: 19, backgroundColor: 'rgba(0,0,0,.56)', justifyContent: 'center', alignItems: 'center' }, circleBtnText: { color: tokens.colors.white, fontSize: 18 }, miniBadge: { position: 'absolute', top: -2, right: -2, minWidth: 16, height: 16, paddingHorizontal: 3, borderRadius: 8, backgroundColor: tokens.colors.brand.primary, alignItems: 'center', justifyContent: 'center' }, miniBadgeText: { color: tokens.colors.white, fontSize: 9, fontWeight: '800' }, dots: { position: 'absolute', bottom: tokens.spacing.sm, alignSelf: 'center', flexDirection: 'row', gap: 5 }, dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: 'rgba(255,255,255,.4)' }, dotActive: { backgroundColor: tokens.colors.white, width: 16 },
  priceBlock: { padding: tokens.spacing.md, gap: tokens.spacing.sm }, sourceRow: { flexDirection: 'row', alignItems: 'center', gap: tokens.spacing.sm, flexWrap: 'wrap' }, sourcePill: { color: tokens.colors.text.secondary, fontSize: tokens.typography.caption.fontSize, fontWeight: '700', backgroundColor: tokens.colors.elevated, paddingHorizontal: 8, paddingVertical: 4, borderRadius: tokens.radius.full }, sourcePillActive: { color: tokens.colors.white, backgroundColor: tokens.colors.brand.secondary }, videoOptional: { color: tokens.colors.text.tertiary, fontSize: tokens.typography.caption.fontSize }, priceLine: { flexDirection: 'row', alignItems: 'baseline', gap: tokens.spacing.sm }, price: { color: tokens.colors.brand.primary, fontSize: tokens.typography.display.fontSize, fontWeight: '800' }, original: { color: tokens.colors.text.tertiary, fontSize: tokens.typography.body.fontSize, textDecorationLine: 'line-through' }, discountTag: { backgroundColor: tokens.colors.brand.primary + '22', borderRadius: tokens.radius.xs, paddingHorizontal: 6, paddingVertical: 2 }, discountTagText: { color: tokens.colors.brand.primary, fontSize: tokens.typography.caption.fontSize, fontWeight: '800' }, title: { color: tokens.colors.white, fontSize: tokens.typography.subhead.fontSize, fontWeight: '600', lineHeight: 22 }, statsRow: { flexDirection: 'row', alignItems: 'center', gap: 6 }, statRating: { color: tokens.colors.action.tip, fontSize: tokens.typography.body.fontSize, fontWeight: '700' }, statDot: { color: tokens.colors.text.tertiary }, statText: { color: tokens.colors.text.secondary, fontSize: tokens.typography.body.fontSize }, availability: { color: tokens.colors.semantic.success, fontSize: tokens.typography.caption.fontSize, fontWeight: '700' },
  shopBlock: { flexDirection: 'row', alignItems: 'center', gap: tokens.spacing.sm, marginHorizontal: tokens.spacing.md, padding: tokens.spacing.sm, backgroundColor: tokens.colors.elevated, borderRadius: tokens.radius.md }, shopAvatar: { width: 40, height: 40, borderRadius: 20, backgroundColor: tokens.colors.surface }, shopName: { color: tokens.colors.white, fontSize: tokens.typography.body.fontSize, fontWeight: '700' }, shopMeta: { color: tokens.colors.text.secondary, fontSize: tokens.typography.caption.fontSize, marginTop: 2 }, visitBtn: { borderWidth: 1, borderColor: tokens.colors.surface, borderRadius: tokens.radius.sm, paddingHorizontal: tokens.spacing.sm, paddingVertical: 7 }, visitBtnText: { color: tokens.colors.white, fontSize: tokens.typography.caption.fontSize, fontWeight: '600' },
  section: { paddingHorizontal: tokens.spacing.md, paddingTop: tokens.spacing.lg, gap: tokens.spacing.sm }, sectionTitle: { color: tokens.colors.white, fontSize: tokens.typography.body.fontSize, fontWeight: '700' }, sectionValue: { color: tokens.colors.text.secondary, fontWeight: '500' }, variantRow: { flexDirection: 'row', flexWrap: 'wrap', gap: tokens.spacing.sm }, variantChip: { paddingHorizontal: tokens.spacing.md, paddingVertical: 8, borderRadius: tokens.radius.sm, borderWidth: 1, borderColor: tokens.colors.surface, backgroundColor: tokens.colors.elevated }, variantChipActive: { borderColor: tokens.colors.brand.primary, backgroundColor: tokens.colors.brand.primary + '1A' }, variantText: { color: tokens.colors.text.secondary, fontSize: tokens.typography.body.fontSize }, variantTextActive: { color: tokens.colors.brand.primary, fontWeight: '700' }, qtyRow: { flexDirection: 'row', alignItems: 'center', gap: tokens.spacing.md }, qtyBtn: { width: 36, height: 36, borderRadius: tokens.radius.sm, backgroundColor: tokens.colors.elevated, alignItems: 'center', justifyContent: 'center' }, qtyBtnDisabled: { opacity: .4 }, qtyBtnText: { color: tokens.colors.white, fontSize: 20 }, qtyValue: { color: tokens.colors.white, minWidth: 32, textAlign: 'center', fontWeight: '800' }, description: { color: tokens.colors.text.secondary, fontSize: tokens.typography.body.fontSize, lineHeight: 20 },
  videoCard: { margin: tokens.spacing.md, padding: tokens.spacing.md, borderRadius: tokens.radius.md, backgroundColor: '#171329', borderWidth: 1, borderColor: '#3B2D65', gap: 7 }, videoTitle: { color: tokens.colors.white, fontSize: tokens.typography.subhead.fontSize, fontWeight: '800' }, videoText: { color: tokens.colors.text.secondary, fontSize: tokens.typography.caption.fontSize, lineHeight: 17 }, videoBtn: { marginTop: 4, backgroundColor: tokens.colors.brand.primary, borderRadius: tokens.radius.sm, paddingVertical: 12, alignItems: 'center' }, videoBtnText: { color: tokens.colors.white, fontWeight: '800' },
  actionBar: { position: 'absolute', left: 0, right: 0, bottom: 0, flexDirection: 'row', gap: tokens.spacing.sm, paddingHorizontal: tokens.spacing.md, paddingTop: tokens.spacing.sm, backgroundColor: tokens.colors.bg, borderTopWidth: .5, borderTopColor: tokens.colors.surface }, addBtn: { flex: 1, minHeight: 48, borderRadius: tokens.radius.sm, borderWidth: 1, borderColor: tokens.colors.brand.primary, alignItems: 'center', justifyContent: 'center' }, addBtnText: { color: tokens.colors.brand.primary, fontWeight: '800' }, buyBtn: { flex: 1, minHeight: 48, borderRadius: tokens.radius.sm, backgroundColor: tokens.colors.brand.primary, alignItems: 'center', justifyContent: 'center' }, buyBtnText: { color: tokens.colors.white, fontWeight: '800' }, btnDisabled: { opacity: .45 },
});
