import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, FlatList, Image, Dimensions, TextInput } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { tokens } from '@/theme/tokens';
import { useNavigation } from '@/navigation/NavigationContext';
import { useCartStore } from '@/store/cartStore';
import { SHOP_CATEGORIES, ProductCategory, formatPrice, formatCount } from '@/services/demoShop';
import { CommerceProduct, getCommerceProducts } from '@/services/orchidyProducts';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const COLUMN_GAP = tokens.spacing.sm;
const H_PADDING = tokens.spacing.md;
const CARD_WIDTH = (Math.min(SCREEN_WIDTH, 430) - H_PADDING * 2 - COLUMN_GAP) / 2;

type CatalogSource = 'orchidy' | 'demo' | 'unavailable';

export const ShopScreen: React.FC = () => {
  const insets = useSafeAreaInsets();
  const nav = useNavigation();
  const cartCount = useCartStore((s) => s.totalItems());
  const [category, setCategory] = useState<ProductCategory>('all');
  const [query, setQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [products, setProducts] = useState<CommerceProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [source, setSource] = useState<CatalogSource>('unavailable');
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedQuery(query.trim()), 300);
    return () => clearTimeout(timer);
  }, [query]);

  useEffect(() => {
    let mounted = true;
    setLoading(true);
    getCommerceProducts({ category, query: debouncedQuery || undefined, limit: 24, sort: debouncedQuery ? 'relevance' : 'newest' })
      .then((items) => {
        if (!mounted) return;
        setProducts(items);
        if (items.some((item) => item.source === 'orchidy')) setSource('orchidy');
        else if (items.length > 0) setSource('demo');
        else setSource('unavailable');
      })
      .finally(() => { if (mounted) setLoading(false); });
    return () => { mounted = false; };
  }, [category, debouncedQuery, reloadKey]);

  const subtitle = useMemo(() => {
    if (loading) return 'Chargement du catalogue…';
    if (source === 'orchidy') return debouncedQuery ? `Résultats Orchidy pour « ${debouncedQuery} »` : 'Produits réels Orchidy';
    if (source === 'demo') return 'Mode démonstration explicite — aucun paiement réel';
    return debouncedQuery ? 'Aucun résultat réel disponible' : 'Catalogue Orchidy temporairement indisponible';
  }, [loading, source, debouncedQuery]);

  const renderProduct = ({ item }: { item: CommerceProduct }) => {
    const discount = item.originalPrice > item.price ? Math.round(100 - (item.price / item.originalPrice) * 100) : 0;
    return (
      <TouchableOpacity style={styles.card} activeOpacity={0.85} onPress={() => nav.push('shop.product', { productId: item.id })}>
        <View style={styles.imageWrap}>
          <Image source={{ uri: item.images[0] }} style={styles.image} />
          <View style={[styles.sourceBadge, item.source !== 'orchidy' && styles.demoSourceBadge]}><Text style={styles.sourceText}>{item.source === 'orchidy' ? 'Orchidy' : 'Démo'}</Text></View>
          {discount > 0 ? <View style={styles.discountBadge}><Text style={styles.discountText}>-{discount}%</Text></View> : null}
          {item.freeShipping ? <View style={styles.shipBadge}><Text style={styles.shipText}>Livraison offerte</Text></View> : null}
        </View>
        <View style={styles.cardBody}>
          <Text style={styles.cardTitle} numberOfLines={2}>{item.title}</Text>
          <View style={styles.priceRow}><Text style={styles.price}>{formatPrice(item.price, item.currency)}</Text>{item.originalPrice > item.price ? <Text style={styles.original}>{formatPrice(item.originalPrice, item.currency)}</Text> : null}</View>
          <View style={styles.metaRow}><Text style={styles.rating}>★ {item.rating ? item.rating.toFixed(1) : '—'}</Text><Text style={styles.sold}>{formatCount(item.soldCount)} vendus</Text></View>
          <View style={styles.shopRow}><Image source={{ uri: item.shopAvatar }} style={styles.shopAvatar} /><Text style={styles.shopName} numberOfLines={1}>{item.shopName}</Text></View>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <View><Text style={styles.headerTitle}>Shop</Text><Text style={styles.headerSubtitle}>{subtitle}</Text></View>
        <TouchableOpacity style={styles.cartButton} onPress={() => nav.push('shop.cart')}><Text style={styles.cartIcon}>🛒</Text>{cartCount > 0 ? <View style={styles.cartBadge}><Text style={styles.cartBadgeText}>{cartCount > 99 ? '99+' : cartCount}</Text></View> : null}</TouchableOpacity>
      </View>

      <View style={styles.searchBar}>
        <Text style={styles.searchIcon}>⌕</Text>
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder="Rechercher dans le catalogue Orchidy"
          placeholderTextColor={tokens.colors.text.tertiary}
          style={styles.searchInput}
          returnKeyType="search"
          accessibilityLabel="Rechercher un produit Orchidy"
        />
        {query ? <TouchableOpacity onPress={() => setQuery('')} accessibilityLabel="Effacer la recherche"><Text style={styles.clearSearch}>×</Text></TouchableOpacity> : null}
      </View>

      <View style={styles.catWrap}><ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.catContent}>{SHOP_CATEGORIES.map((c) => <TouchableOpacity key={c.id} style={[styles.catChip, category === c.id && styles.catChipActive]} onPress={() => setCategory(c.id)}><Text style={styles.catIcon}>{c.icon}</Text><Text style={[styles.catLabel, category === c.id && styles.catLabelActive]}>{c.label}</Text></TouchableOpacity>)}</ScrollView></View>

      {loading && products.length === 0 ? <View style={styles.loadingBlock}><Text style={styles.loadingText}>Connexion au catalogue Orchidy…</Text></View>
        : source === 'unavailable' && products.length === 0 ? <View style={styles.unavailableBlock}><Text style={styles.unavailableIcon}>🛍️</Text><Text style={styles.unavailableTitle}>{debouncedQuery ? 'Aucun produit trouvé' : 'Catalogue momentanément indisponible'}</Text><Text style={styles.unavailableText}>{debouncedQuery ? 'Modifie ta recherche ou réessaie. ORKY ne remplace pas les résultats absents par de faux produits.' : 'ORKY n’affiche pas de faux produits à la place du catalogue réel. L’achat reste désactivé jusqu’au retour d’Orchidy.'}</Text><TouchableOpacity style={styles.retryBtn} onPress={() => setReloadKey((key) => key + 1)}><Text style={styles.retryText}>Réessayer</Text></TouchableOpacity></View>
        : <FlatList data={products} renderItem={renderProduct} keyExtractor={(item) => item.id} numColumns={2} columnWrapperStyle={styles.row} contentContainerStyle={styles.grid} showsVerticalScrollIndicator={false} />}
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: tokens.colors.bg },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: H_PADDING, paddingVertical: tokens.spacing.sm },
  headerTitle: { color: tokens.colors.white, fontSize: tokens.typography.headline.fontSize, fontWeight: '800' },
  headerSubtitle: { color: tokens.colors.text.tertiary, fontSize: tokens.typography.caption.fontSize, marginTop: 2, maxWidth: 290 },
  cartButton: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  cartIcon: { fontSize: 24 },
  cartBadge: { position: 'absolute', top: 2, right: 0, minWidth: 18, height: 18, paddingHorizontal: 4, borderRadius: 9, backgroundColor: tokens.colors.brand.primary, alignItems: 'center', justifyContent: 'center' },
  cartBadgeText: { color: tokens.colors.white, fontSize: 10, fontWeight: '800' },
  searchBar: { flexDirection: 'row', alignItems: 'center', gap: tokens.spacing.sm, marginHorizontal: H_PADDING, backgroundColor: tokens.colors.elevated, borderRadius: tokens.radius.full, paddingHorizontal: tokens.spacing.md, minHeight: 42 },
  searchIcon: { color: tokens.colors.text.secondary, fontSize: 18 },
  searchInput: { flex: 1, color: tokens.colors.white, fontSize: tokens.typography.body.fontSize, paddingVertical: 8, outlineStyle: 'none' } as any,
  clearSearch: { color: tokens.colors.text.secondary, fontSize: 22, paddingHorizontal: 4 },
  catWrap: { marginTop: tokens.spacing.sm },
  catContent: { paddingHorizontal: H_PADDING, gap: tokens.spacing.sm, paddingVertical: tokens.spacing.sm },
  catChip: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: tokens.spacing.md, paddingVertical: 8, borderRadius: tokens.radius.full, backgroundColor: tokens.colors.elevated },
  catChipActive: { backgroundColor: tokens.colors.brand.primary },
  catIcon: { fontSize: 15 },
  catLabel: { color: tokens.colors.text.secondary, fontSize: tokens.typography.body.fontSize, fontWeight: '500' },
  catLabelActive: { color: tokens.colors.white, fontWeight: '700' },
  loadingBlock: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: H_PADDING },
  loadingText: { color: tokens.colors.text.secondary, fontSize: tokens.typography.body.fontSize },
  unavailableBlock: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: tokens.spacing.xl, gap: tokens.spacing.sm },
  unavailableIcon: { fontSize: 48 },
  unavailableTitle: { color: tokens.colors.white, fontSize: tokens.typography.title.fontSize, fontWeight: '800', textAlign: 'center' },
  unavailableText: { color: tokens.colors.text.secondary, fontSize: tokens.typography.body.fontSize, lineHeight: 20, textAlign: 'center' },
  retryBtn: { marginTop: tokens.spacing.sm, backgroundColor: tokens.colors.brand.primary, borderRadius: tokens.radius.sm, paddingHorizontal: tokens.spacing.xl, paddingVertical: tokens.spacing.sm },
  retryText: { color: tokens.colors.white, fontSize: tokens.typography.body.fontSize, fontWeight: '800' },
  grid: { paddingHorizontal: H_PADDING, paddingBottom: 110 },
  row: { gap: COLUMN_GAP, marginBottom: COLUMN_GAP },
  card: { width: CARD_WIDTH, backgroundColor: tokens.colors.elevated, borderRadius: tokens.radius.md, overflow: 'hidden' },
  imageWrap: { width: '100%', aspectRatio: 3 / 4, position: 'relative', backgroundColor: tokens.colors.surface },
  image: { width: '100%', height: '100%', resizeMode: 'cover' },
  sourceBadge: { position: 'absolute', top: 8, left: 8, backgroundColor: '#2E7D4F', borderRadius: 999, paddingHorizontal: 7, paddingVertical: 3 },
  demoSourceBadge: { backgroundColor: '#6B4F00' },
  sourceText: { color: '#fff', fontSize: 9, fontWeight: '900' },
  discountBadge: { position: 'absolute', top: 8, right: 8, backgroundColor: tokens.colors.brand.primary, borderRadius: 4, paddingHorizontal: 6, paddingVertical: 3 },
  discountText: { color: tokens.colors.white, fontSize: 10, fontWeight: '800' },
  shipBadge: { position: 'absolute', bottom: 7, left: 7, backgroundColor: 'rgba(0,0,0,.7)', borderRadius: 5, paddingHorizontal: 6, paddingVertical: 3 },
  shipText: { color: '#fff', fontSize: 9, fontWeight: '700' },
  cardBody: { padding: 9, gap: 5 },
  cardTitle: { color: tokens.colors.white, fontSize: tokens.typography.body.fontSize, fontWeight: '600', lineHeight: 18 },
  priceRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  price: { color: tokens.colors.brand.secondary, fontWeight: '800', fontSize: tokens.typography.body.fontSize },
  original: { color: tokens.colors.text.tertiary, textDecorationLine: 'line-through', fontSize: tokens.typography.caption.fontSize },
  metaRow: { flexDirection: 'row', justifyContent: 'space-between' },
  rating: { color: '#F6C84C', fontSize: 10 },
  sold: { color: tokens.colors.text.tertiary, fontSize: 10 },
  shopRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  shopAvatar: { width: 18, height: 18, borderRadius: 9, backgroundColor: tokens.colors.surface },
  shopName: { flex: 1, color: tokens.colors.text.secondary, fontSize: 10 },
});
