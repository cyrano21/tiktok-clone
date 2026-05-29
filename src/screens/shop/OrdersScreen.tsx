import React, { useMemo, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Image } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { tokens } from '@/theme/tokens';
import { useNavigation } from '@/navigation/NavigationContext';
import { useOrderStore, Order, OrderStatus, STATUS_LABEL } from '@/store/orderStore';
import { useSessionStore } from '@/store/sessionStore';
import { formatPrice } from '@/services/demoShop';

const STATUS_COLOR: Record<OrderStatus, string> = {
  confirmed: tokens.colors.text.link,
  preparing: tokens.colors.semantic.warning,
  shipped: tokens.colors.brand.secondary,
  delivered: tokens.colors.semantic.success,
};

type Filter = 'all' | OrderStatus;

const FILTERS: { id: Filter; label: string }[] = [
  { id: 'all', label: 'Toutes' },
  { id: 'confirmed', label: 'Confirmées' },
  { id: 'preparing', label: 'En préparation' },
  { id: 'shipped', label: 'Expédiées' },
  { id: 'delivered', label: 'Livrées' },
];

export const OrdersScreen: React.FC = () => {
  const insets = useSafeAreaInsets();
  const nav = useNavigation();
  const buyerId = useSessionStore((s) => s.userId);
  const orders = useOrderStore((s) => s.orders);
  const buyerOrders = useMemo(() => orders.filter((o) => o.buyerId === buyerId), [orders, buyerId]);
  const [filter, setFilter] = useState<Filter>('all');

  const visible = useMemo(
    () => (filter === 'all' ? buyerOrders : buyerOrders.filter((o) => o.status === filter)),
    [buyerOrders, filter]
  );

  const formatDate = (iso: string) =>
    new Date(iso).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' });

  const renderOrder = (order: Order) => (
    <View key={order.id} style={styles.card}>
      <View style={styles.cardHeader}>
        <View>
          <Text style={styles.orderId}>{order.id}</Text>
          <Text style={styles.orderDate}>{formatDate(order.createdAt)}</Text>
        </View>
        <View style={[styles.statusPill, { backgroundColor: STATUS_COLOR[order.status] + '22' }]}>
          <Text style={[styles.statusText, { color: STATUS_COLOR[order.status] }]}>{STATUS_LABEL[order.status]}</Text>
        </View>
      </View>

      {order.items.map((it) => (
        <View key={it.productId + it.variantLabel} style={styles.itemRow}>
          <Image source={{ uri: it.image }} style={styles.itemImage} />
          <View style={styles.itemBody}>
            <Text style={styles.itemTitle} numberOfLines={2}>{it.title}</Text>
            <Text style={styles.itemMeta}>{it.variantLabel} · {it.shopName}</Text>
            <Text style={styles.itemQty}>x{it.quantity} · {formatPrice(it.unitPrice)}</Text>
          </View>
        </View>
      ))}

      <View style={styles.cardFooter}>
        <Text style={styles.totalLabel}>Total</Text>
        <Text style={styles.totalValue}>{formatPrice(order.total)}</Text>
      </View>
    </View>
  );

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => nav.back()} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <Text style={styles.backIcon}>←</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Mes commandes</Text>
        <View style={styles.placeholder} />
      </View>

      <View style={styles.filtersWrap}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filtersContent}>
          {FILTERS.map((f) => (
            <TouchableOpacity
              key={f.id}
              style={[styles.filterChip, filter === f.id && styles.filterChipActive]}
              onPress={() => setFilter(f.id)}
            >
              <Text style={[styles.filterText, filter === f.id && styles.filterTextActive]}>{f.label}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {visible.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyEmoji}>📦</Text>
          <Text style={styles.emptyTitle}>Aucune commande</Text>
          <Text style={styles.emptySub}>Tes achats apparaîtront ici avec leur suivi.</Text>
          <TouchableOpacity style={styles.shopBtn} onPress={() => nav.reset('shop')}>
            <Text style={styles.shopBtnText}>Découvrir le Shop</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.list} showsVerticalScrollIndicator={false}>
          {visible.map(renderOrder)}
        </ScrollView>
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
  filtersWrap: { borderBottomWidth: 0.5, borderBottomColor: tokens.colors.surface },
  filtersContent: { paddingHorizontal: tokens.spacing.md, paddingVertical: tokens.spacing.sm, gap: tokens.spacing.sm },
  filterChip: { paddingHorizontal: tokens.spacing.md, paddingVertical: 6, borderRadius: tokens.radius.full, backgroundColor: tokens.colors.elevated },
  filterChipActive: { backgroundColor: tokens.colors.white },
  filterText: { color: tokens.colors.text.secondary, fontSize: tokens.typography.body.fontSize, fontWeight: '500' },
  filterTextActive: { color: tokens.colors.black, fontWeight: '700' },
  list: { padding: tokens.spacing.md, gap: tokens.spacing.md },
  card: { backgroundColor: tokens.colors.elevated, borderRadius: tokens.radius.md, padding: tokens.spacing.md, gap: tokens.spacing.sm },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  orderId: { color: tokens.colors.white, fontSize: tokens.typography.body.fontSize, fontWeight: '800' },
  orderDate: { color: tokens.colors.text.tertiary, fontSize: tokens.typography.caption.fontSize, marginTop: 2 },
  statusPill: { borderRadius: tokens.radius.full, paddingHorizontal: tokens.spacing.sm, paddingVertical: 4 },
  statusText: { fontSize: tokens.typography.caption.fontSize, fontWeight: '700' },
  itemRow: { flexDirection: 'row', gap: tokens.spacing.sm, paddingTop: tokens.spacing.xs },
  itemImage: { width: 56, height: 56, borderRadius: tokens.radius.sm, backgroundColor: tokens.colors.surface },
  itemBody: { flex: 1 },
  itemTitle: { color: tokens.colors.white, fontSize: tokens.typography.body.fontSize, lineHeight: 18 },
  itemMeta: { color: tokens.colors.text.secondary, fontSize: tokens.typography.caption.fontSize, marginTop: 2 },
  itemQty: { color: tokens.colors.text.secondary, fontSize: tokens.typography.caption.fontSize, marginTop: 2 },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopWidth: 0.5,
    borderTopColor: tokens.colors.surface,
    paddingTop: tokens.spacing.sm,
  },
  totalLabel: { color: tokens.colors.text.secondary, fontSize: tokens.typography.body.fontSize },
  totalValue: { color: tokens.colors.brand.primary, fontSize: tokens.typography.subhead.fontSize, fontWeight: '800' },
  empty: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: tokens.spacing.sm, paddingHorizontal: tokens.spacing.xl },
  emptyEmoji: { fontSize: 56 },
  emptyTitle: { color: tokens.colors.white, fontSize: tokens.typography.title.fontSize, fontWeight: '700' },
  emptySub: { color: tokens.colors.text.secondary, fontSize: tokens.typography.body.fontSize, textAlign: 'center' },
  shopBtn: { marginTop: tokens.spacing.md, backgroundColor: tokens.colors.brand.primary, borderRadius: tokens.radius.sm, paddingHorizontal: tokens.spacing.xl, paddingVertical: tokens.spacing.md },
  shopBtnText: { color: tokens.colors.white, fontSize: tokens.typography.body.fontSize, fontWeight: '700' },
});
