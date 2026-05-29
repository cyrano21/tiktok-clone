import React, { useMemo, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Image } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { tokens } from '@/theme/tokens';
import { useNavigation } from '@/navigation/NavigationContext';
import { useSessionStore } from '@/store/sessionStore';
import { useOrderStore, STATUS_LABEL } from '@/store/orderStore';
import { getSellerById, getProductsBySeller, setProductOnSale, formatPrice, formatCount } from '@/services/demoShop';

type Tab = 'products' | 'orders';

export const SellerDashboardScreen: React.FC = () => {
  const insets = useSafeAreaInsets();
  const nav = useNavigation();
  const sellerId = useSessionStore((s) => s.sellerId);
  const seller = getSellerById(sellerId);
  const orders = useOrderStore((s) => s.orders);
  const advanceStatus = useOrderStore((s) => s.advanceStatus);

  const [tab, setTab] = useState<Tab>('products');
  const [, force] = useState(0);

  const products = useMemo(() => getProductsBySeller(sellerId), [sellerId, force]);
  const sellerOrders = useMemo(
    () => orders.filter((o) => o.items.some((it) => it.sellerId === sellerId)),
    [orders, sellerId]
  );

  const revenue = sellerOrders.reduce(
    (sum, o) => sum + o.items.filter((it) => it.sellerId === sellerId).reduce((s, it) => s + it.unitPrice * it.quantity, 0),
    0
  );
  const unitsSold = sellerOrders.reduce(
    (sum, o) => sum + o.items.filter((it) => it.sellerId === sellerId).reduce((s, it) => s + it.quantity, 0),
    0
  );

  const toggleSale = (id: string, current: boolean) => {
    setProductOnSale(id, !current);
    force((n) => n + 1);
  };

  const formatDate = (iso: string) => new Date(iso).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' });

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => nav.back()} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <Text style={styles.backIcon}>←</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Ma boutique</Text>
        <TouchableOpacity onPress={() => nav.push('shop.seller', { sellerId })}>
          <Text style={styles.viewShop}>Voir</Text>
        </TouchableOpacity>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: tokens.spacing.xxl }}>
        {/* Seller identity */}
        <View style={styles.identity}>
          <Image source={{ uri: seller?.avatar }} style={styles.avatar} />
          <View style={{ flex: 1 }}>
            <Text style={styles.shopName}>{seller?.name} {seller?.verified ? '✔️' : ''}</Text>
            <Text style={styles.shopMeta}>★ {seller?.rating.toFixed(1)} · {formatCount(seller?.followers ?? 0)} abonnés</Text>
          </View>
        </View>

        {/* KPIs */}
        <View style={styles.kpiRow}>
          <View style={styles.kpiCard}>
            <Text style={styles.kpiValue}>{formatPrice(revenue)}</Text>
            <Text style={styles.kpiLabel}>Revenus</Text>
          </View>
          <View style={styles.kpiCard}>
            <Text style={styles.kpiValue}>{sellerOrders.length}</Text>
            <Text style={styles.kpiLabel}>Commandes</Text>
          </View>
          <View style={styles.kpiCard}>
            <Text style={styles.kpiValue}>{unitsSold}</Text>
            <Text style={styles.kpiLabel}>Unités vendues</Text>
          </View>
        </View>

        {/* Quick actions */}
        <View style={styles.actionsRow}>
          <TouchableOpacity style={styles.actionPrimary} onPress={() => nav.push('shop.product.editor')}>
            <Text style={styles.actionPrimaryText}>＋ Ajouter un produit</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.actionSecondary} onPress={() => nav.push('studio.editor')}>
            <Text style={styles.actionSecondaryText}>🎬 Créer une vidéo</Text>
          </TouchableOpacity>
        </View>

        {/* Tabs */}
        <View style={styles.tabRow}>
          <TouchableOpacity style={[styles.tab, tab === 'products' && styles.tabActive]} onPress={() => setTab('products')}>
            <Text style={[styles.tabText, tab === 'products' && styles.tabTextActive]}>Produits ({products.length})</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.tab, tab === 'orders' && styles.tabActive]} onPress={() => setTab('orders')}>
            <Text style={[styles.tabText, tab === 'orders' && styles.tabTextActive]}>Commandes ({sellerOrders.length})</Text>
          </TouchableOpacity>
        </View>

        {tab === 'products' ? (
          <View style={styles.section}>
            {products.map((p) => (
              <View key={p.id} style={styles.prodRow}>
                <Image source={{ uri: p.images[0] }} style={styles.prodImage} />
                <View style={styles.prodBody}>
                  <Text style={styles.prodTitle} numberOfLines={1}>{p.title}</Text>
                  <Text style={styles.prodPrice}>{formatPrice(p.price)} · {formatCount(p.soldCount)} vendus</Text>
                  <View style={styles.prodActions}>
                    <TouchableOpacity style={styles.miniBtn} onPress={() => nav.push('shop.product.editor', { productId: p.id })}>
                      <Text style={styles.miniBtnText}>Modifier</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.miniBtn} onPress={() => nav.push('studio.editor', { productId: p.id, sellerId })}>
                      <Text style={styles.miniBtnText}>🎬 Vidéo</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.miniBtn, p.onSale ? styles.saleOn : styles.saleOff]}
                      onPress={() => toggleSale(p.id, p.onSale)}
                    >
                      <Text style={[styles.miniBtnText, p.onSale ? styles.saleOnText : styles.saleOffText]}>
                        {p.onSale ? 'En vente' : 'Hors ligne'}
                      </Text>
                    </TouchableOpacity>
                  </View>
                </View>
              </View>
            ))}
          </View>
        ) : (
          <View style={styles.section}>
            {sellerOrders.length === 0 ? (
              <Text style={styles.emptyText}>Aucune commande reçue pour le moment.</Text>
            ) : (
              sellerOrders.map((o) => (
                <View key={o.id} style={styles.orderRow}>
                  <View style={styles.orderHead}>
                    <Text style={styles.orderId}>{o.id}</Text>
                    <Text style={styles.orderDate}>{formatDate(o.createdAt)}</Text>
                  </View>
                  {o.items.filter((it) => it.sellerId === sellerId).map((it) => (
                    <Text key={it.productId + it.variantLabel} style={styles.orderItem} numberOfLines={1}>
                      • {it.title} ({it.variantLabel}) x{it.quantity}
                    </Text>
                  ))}
                  <View style={styles.orderFoot}>
                    <Text style={styles.orderStatus}>{STATUS_LABEL[o.status]}</Text>
                    <TouchableOpacity style={styles.advanceBtn} onPress={() => advanceStatus(o.id)}>
                      <Text style={styles.advanceText}>Faire avancer →</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              ))
            )}
          </View>
        )}
      </ScrollView>
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
  viewShop: { color: tokens.colors.brand.primary, fontSize: tokens.typography.body.fontSize, fontWeight: '700' },
  identity: { flexDirection: 'row', alignItems: 'center', gap: tokens.spacing.md, padding: tokens.spacing.md },
  avatar: { width: 52, height: 52, borderRadius: 26, backgroundColor: tokens.colors.surface },
  shopName: { color: tokens.colors.white, fontSize: tokens.typography.subhead.fontSize, fontWeight: '800' },
  shopMeta: { color: tokens.colors.text.secondary, fontSize: tokens.typography.caption.fontSize, marginTop: 2 },
  kpiRow: { flexDirection: 'row', gap: tokens.spacing.sm, paddingHorizontal: tokens.spacing.md },
  kpiCard: { flex: 1, backgroundColor: tokens.colors.elevated, borderRadius: tokens.radius.md, padding: tokens.spacing.md, alignItems: 'center', gap: 4 },
  kpiValue: { color: tokens.colors.white, fontSize: tokens.typography.subhead.fontSize, fontWeight: '800' },
  kpiLabel: { color: tokens.colors.text.secondary, fontSize: tokens.typography.caption.fontSize },
  actionsRow: { flexDirection: 'row', gap: tokens.spacing.sm, paddingHorizontal: tokens.spacing.md, marginTop: tokens.spacing.md },
  actionPrimary: { flex: 1, height: 46, borderRadius: tokens.radius.sm, backgroundColor: tokens.colors.brand.primary, justifyContent: 'center', alignItems: 'center' },
  actionPrimaryText: { color: tokens.colors.white, fontSize: tokens.typography.body.fontSize, fontWeight: '800' },
  actionSecondary: { flex: 1, height: 46, borderRadius: tokens.radius.sm, borderWidth: 1, borderColor: tokens.colors.surface, justifyContent: 'center', alignItems: 'center' },
  actionSecondaryText: { color: tokens.colors.white, fontSize: tokens.typography.body.fontSize, fontWeight: '700' },
  tabRow: { flexDirection: 'row', marginTop: tokens.spacing.lg, borderBottomWidth: 0.5, borderBottomColor: tokens.colors.surface },
  tab: { flex: 1, alignItems: 'center', paddingVertical: tokens.spacing.md, borderBottomWidth: 2, borderBottomColor: 'transparent' },
  tabActive: { borderBottomColor: tokens.colors.white },
  tabText: { color: tokens.colors.text.secondary, fontSize: tokens.typography.body.fontSize, fontWeight: '500' },
  tabTextActive: { color: tokens.colors.white, fontWeight: '700' },
  section: { padding: tokens.spacing.md, gap: tokens.spacing.md },
  prodRow: { flexDirection: 'row', gap: tokens.spacing.sm, backgroundColor: tokens.colors.elevated, borderRadius: tokens.radius.md, padding: tokens.spacing.sm },
  prodImage: { width: 64, height: 64, borderRadius: tokens.radius.sm, backgroundColor: tokens.colors.surface },
  prodBody: { flex: 1, gap: 4 },
  prodTitle: { color: tokens.colors.white, fontSize: tokens.typography.body.fontSize, fontWeight: '600' },
  prodPrice: { color: tokens.colors.text.secondary, fontSize: tokens.typography.caption.fontSize },
  prodActions: { flexDirection: 'row', gap: tokens.spacing.xs, marginTop: 2, flexWrap: 'wrap' },
  miniBtn: { paddingHorizontal: tokens.spacing.sm, paddingVertical: 5, borderRadius: tokens.radius.xs, backgroundColor: tokens.colors.surface },
  miniBtnText: { color: tokens.colors.white, fontSize: tokens.typography.caption.fontSize, fontWeight: '600' },
  saleOn: { backgroundColor: tokens.colors.semantic.success + '22' },
  saleOnText: { color: tokens.colors.semantic.success },
  saleOff: { backgroundColor: tokens.colors.text.tertiary + '22' },
  saleOffText: { color: tokens.colors.text.tertiary },
  orderRow: { backgroundColor: tokens.colors.elevated, borderRadius: tokens.radius.md, padding: tokens.spacing.md, gap: 4 },
  orderHead: { flexDirection: 'row', justifyContent: 'space-between' },
  orderId: { color: tokens.colors.white, fontSize: tokens.typography.body.fontSize, fontWeight: '800' },
  orderDate: { color: tokens.colors.text.tertiary, fontSize: tokens.typography.caption.fontSize },
  orderItem: { color: tokens.colors.text.secondary, fontSize: tokens.typography.caption.fontSize },
  orderFoot: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: tokens.spacing.xs },
  orderStatus: { color: tokens.colors.brand.secondary, fontSize: tokens.typography.body.fontSize, fontWeight: '700' },
  advanceBtn: { paddingHorizontal: tokens.spacing.sm, paddingVertical: 6, borderRadius: tokens.radius.xs, backgroundColor: tokens.colors.brand.primary },
  advanceText: { color: tokens.colors.white, fontSize: tokens.typography.caption.fontSize, fontWeight: '700' },
  emptyText: { color: tokens.colors.text.secondary, fontSize: tokens.typography.body.fontSize, textAlign: 'center', paddingVertical: tokens.spacing.xl },
});
