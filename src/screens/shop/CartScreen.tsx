import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Image } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { tokens } from '@/theme/tokens';
import { useNavigation } from '@/navigation/NavigationContext';
import { useCartStore, CartLine } from '@/store/cartStore';
import { formatPrice } from '@/services/demoShop';
import { getCachedCommerceProduct } from '@/services/orchidyProducts';
import { createOrchidyCheckoutHandoff } from '@/services/orchidyCheckout';

export const CartScreen: React.FC = () => {
  const insets = useSafeAreaInsets();
  const nav = useNavigation();

  const lines = useCartStore((s) => s.lines);
  const setQuantity = useCartStore((s) => s.setQuantity);
  const removeLine = useCartStore((s) => s.removeLine);
  const subtotal = useCartStore((s) => s.subtotal());
  const shipping = useCartStore((s) => s.shippingTotal());
  const total = useCartStore((s) => s.total());
  const [checkoutBusy, setCheckoutBusy] = useState(false);
  const [checkoutError, setCheckoutError] = useState<string | null>(null);

  const orchidyLines = lines.filter((line) => line.productSnapshot.source === 'orchidy');
  const hasOrchidyProducts = orchidyLines.length > 0;
  const hasDemoProducts = lines.some((line) => line.productSnapshot.source !== 'orchidy');
  const canFinalizeOnOrchidy =
    lines.length > 0 &&
    orchidyLines.length === lines.length &&
    orchidyLines.every((line) => line.productSnapshot.orderable !== false);

  const startOrchidyCheckout = async () => {
    if (!canFinalizeOnOrchidy || checkoutBusy) return;
    setCheckoutBusy(true);
    setCheckoutError(null);
    try {
      const handoff = await createOrchidyCheckoutHandoff(orchidyLines);
      if (typeof window === 'undefined') throw new Error('Redirection indisponible dans cet environnement.');
      // Never clear the ORKY cart here. Orchidy first validates and creates a one-time
      // authenticated handoff. Keeping the cart allows retrying a stock/price correction.
      window.location.assign(handoff.checkoutUrl);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Le checkout Orchidy est indisponible.';
      setCheckoutError(message);
      setCheckoutBusy(false);
    }
  };

  const renderLine = (line: CartLine) => {
    const product = getCachedCommerceProduct(line.productId) || line.productSnapshot;
    if (!product) return null;
    return (
      <View key={line.key} style={styles.line}>
        <Image source={{ uri: product.images[0] }} style={styles.lineImage} />
        <View style={styles.lineBody}>
          <Text style={styles.lineTitle} numberOfLines={2}>{product.title}</Text>
          <Text style={styles.lineVariant}>
            {line.variantLabel}{product.source === 'orchidy' ? ' · Orchidy' : ' · Démo'}
          </Text>
          <View style={styles.lineBottom}>
            <Text style={styles.linePrice}>{formatPrice(product.price, product.currency)}</Text>
            <View style={styles.qtyRow}>
              <TouchableOpacity style={styles.qtyBtn} onPress={() => setQuantity(line.key, line.quantity - 1)}>
                <Text style={styles.qtyBtnText}>−</Text>
              </TouchableOpacity>
              <Text style={styles.qtyValue}>{line.quantity}</Text>
              <TouchableOpacity style={styles.qtyBtn} onPress={() => setQuantity(line.key, line.quantity + 1)}>
                <Text style={styles.qtyBtnText}>+</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
        <TouchableOpacity style={styles.removeBtn} onPress={() => removeLine(line.key)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Text style={styles.removeText}>✕</Text>
        </TouchableOpacity>
      </View>
    );
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => nav.back()} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <Text style={styles.backIcon}>←</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Panier{lines.length > 0 ? ` (${lines.length})` : ''}</Text>
        <View style={styles.placeholder} />
      </View>

      {lines.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyEmoji}>🛒</Text>
          <Text style={styles.emptyTitle}>Ton panier est vide</Text>
          <Text style={styles.emptySub}>Découvre des produits Orchidy et des vidéos shoppables</Text>
          <TouchableOpacity style={styles.shopBtn} onPress={() => nav.reset('shop')}>
            <Text style={styles.shopBtnText}>Aller au Shop</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <>
          <ScrollView contentContainerStyle={styles.list} showsVerticalScrollIndicator={false}>
            {hasOrchidyProducts && (
              <View style={styles.orchidyNotice}>
                <Text style={styles.orchidyNoticeTitle}>Checkout sécurisé par Orchidy</Text>
                <Text style={styles.orchidyNoticeText}>
                  ORKY transmet uniquement les identifiants, variantes, options et quantités. Orchidy recalcule prix, stock, devise et livraison avant tout paiement.
                </Text>
              </View>
            )}
            {hasDemoProducts && (
              <View style={styles.demoNotice}>
                <Text style={styles.demoNoticeTitle}>Contenu de démonstration — aucun paiement</Text>
                <Text style={styles.orchidyNoticeText}>
                  Les produits démo sont uniquement destinés à explorer l’interface. Ils ne peuvent jamais être commandés ni envoyés au checkout Orchidy.
                </Text>
              </View>
            )}
            {lines.map(renderLine)}
          </ScrollView>

          <View style={[styles.summary, { paddingBottom: Math.max(insets.bottom, tokens.spacing.md) }]}>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Sous-total estimé dans ORKY</Text>
              <Text style={styles.summaryValue}>{formatPrice(subtotal)}</Text>
            </View>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Livraison estimée</Text>
              <Text style={[styles.summaryValue, shipping === 0 && styles.freeShip]}>
                {shipping === 0 ? 'Offerte' : formatPrice(shipping)}
              </Text>
            </View>
            <View style={styles.divider} />
            <View style={styles.summaryRow}>
              <Text style={styles.totalLabel}>Estimation ORKY</Text>
              <Text style={styles.totalValue}>{formatPrice(total)}</Text>
            </View>
            {hasOrchidyProducts && (
              <Text style={styles.checkoutHint}>
                Le montant final affiché par Orchidy fait foi après revalidation du catalogue et de la livraison.
              </Text>
            )}
            {checkoutError ? <Text style={styles.checkoutError}>{checkoutError}</Text> : null}
            <TouchableOpacity
              style={[styles.checkoutBtn, (!canFinalizeOnOrchidy || checkoutBusy) && styles.checkoutDisabled]}
              disabled={!canFinalizeOnOrchidy || checkoutBusy}
              onPress={startOrchidyCheckout}
            >
              <Text style={styles.checkoutText}>
                {checkoutBusy
                  ? 'Vérification Orchidy…'
                  : canFinalizeOnOrchidy
                    ? 'Continuer vers le paiement Orchidy'
                    : hasOrchidyProducts
                      ? 'Retirer les lignes non éligibles'
                      : 'Paiement indisponible en mode démo'}
              </Text>
            </TouchableOpacity>
          </View>
        </>
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
    paddingHorizontal: tokens.spacing.md,
    paddingVertical: tokens.spacing.sm,
    borderBottomWidth: 0.5,
    borderBottomColor: tokens.colors.surface,
  },
  backIcon: { color: tokens.colors.white, fontSize: 24, width: 28 },
  headerTitle: { color: tokens.colors.white, fontSize: tokens.typography.title.fontSize, fontWeight: '700' },
  placeholder: { width: 28 },
  list: { padding: tokens.spacing.md, gap: tokens.spacing.md, paddingBottom: 150 },
  orchidyNotice: { backgroundColor: tokens.colors.brand.primary + '18', borderRadius: tokens.radius.md, padding: tokens.spacing.md, gap: 4 },
  orchidyNoticeTitle: { color: tokens.colors.white, fontSize: tokens.typography.body.fontSize, fontWeight: '800' },
  orchidyNoticeText: { color: tokens.colors.text.secondary, fontSize: tokens.typography.caption.fontSize, lineHeight: 17 },
  demoNotice: { backgroundColor: tokens.colors.semantic.warning + '18', borderRadius: tokens.radius.md, padding: tokens.spacing.md, gap: 4 },
  demoNoticeTitle: { color: tokens.colors.semantic.warning, fontSize: tokens.typography.body.fontSize, fontWeight: '800' },
  line: { flexDirection: 'row', gap: tokens.spacing.sm, backgroundColor: tokens.colors.elevated, borderRadius: tokens.radius.md, padding: tokens.spacing.sm },
  lineImage: { width: 84, height: 84, borderRadius: tokens.radius.sm, backgroundColor: tokens.colors.surface },
  lineBody: { flex: 1, justifyContent: 'space-between' },
  lineTitle: { color: tokens.colors.white, fontSize: tokens.typography.body.fontSize, lineHeight: 18 },
  lineVariant: { color: tokens.colors.text.secondary, fontSize: tokens.typography.caption.fontSize, marginTop: 2 },
  lineBottom: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: tokens.spacing.xs },
  linePrice: { color: tokens.colors.brand.primary, fontSize: tokens.typography.subhead.fontSize, fontWeight: '800' },
  qtyRow: { flexDirection: 'row', alignItems: 'center', gap: tokens.spacing.sm },
  qtyBtn: { width: 28, height: 28, borderRadius: tokens.radius.xs, backgroundColor: tokens.colors.surface, justifyContent: 'center', alignItems: 'center' },
  qtyBtnText: { color: tokens.colors.white, fontSize: 16, fontWeight: '700' },
  qtyValue: { color: tokens.colors.white, fontSize: tokens.typography.body.fontSize, fontWeight: '700', minWidth: 22, textAlign: 'center' },
  removeBtn: { padding: 4 },
  removeText: { color: tokens.colors.text.tertiary, fontSize: 16 },
  summary: { paddingHorizontal: tokens.spacing.md, paddingTop: tokens.spacing.md, borderTopWidth: 0.5, borderTopColor: tokens.colors.surface, backgroundColor: tokens.colors.bg, gap: tokens.spacing.xs },
  summaryRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  summaryLabel: { color: tokens.colors.text.secondary, fontSize: tokens.typography.body.fontSize },
  summaryValue: { color: tokens.colors.white, fontSize: tokens.typography.body.fontSize, fontWeight: '600' },
  freeShip: { color: tokens.colors.semantic.success, fontWeight: '700' },
  divider: { height: 0.5, backgroundColor: tokens.colors.surface, marginVertical: tokens.spacing.xs },
  totalLabel: { color: tokens.colors.white, fontSize: tokens.typography.subhead.fontSize, fontWeight: '700' },
  totalValue: { color: tokens.colors.brand.primary, fontSize: tokens.typography.title.fontSize, fontWeight: '800' },
  checkoutHint: { color: tokens.colors.text.secondary, fontSize: tokens.typography.caption.fontSize, lineHeight: 17 },
  checkoutError: { color: tokens.colors.semantic.error, fontSize: tokens.typography.caption.fontSize, lineHeight: 17, fontWeight: '700' },
  checkoutBtn: { height: 50, borderRadius: tokens.radius.sm, backgroundColor: tokens.colors.brand.primary, justifyContent: 'center', alignItems: 'center', marginTop: tokens.spacing.sm },
  checkoutDisabled: { opacity: 0.45 },
  checkoutText: { color: tokens.colors.white, fontSize: tokens.typography.subhead.fontSize, fontWeight: '800' },
  empty: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: tokens.spacing.sm, paddingHorizontal: tokens.spacing.xl },
  emptyEmoji: { fontSize: 56 },
  emptyTitle: { color: tokens.colors.white, fontSize: tokens.typography.title.fontSize, fontWeight: '700' },
  emptySub: { color: tokens.colors.text.secondary, fontSize: tokens.typography.body.fontSize, textAlign: 'center' },
  shopBtn: { marginTop: tokens.spacing.md, backgroundColor: tokens.colors.brand.primary, borderRadius: tokens.radius.sm, paddingHorizontal: tokens.spacing.xl, paddingVertical: tokens.spacing.md },
  shopBtnText: { color: tokens.colors.white, fontSize: tokens.typography.body.fontSize, fontWeight: '700' },
});