import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { tokens } from '@/theme/tokens';
import { useNavigation, useRouteParams } from '@/navigation/NavigationContext';

interface Params { productId?: string }

function openOrchidySeller(productId?: string) {
  if (typeof window === 'undefined') return;
  const base = (process.env.NEXT_PUBLIC_ORCHIDY_BASE_URL || 'https://orchidy.fr').replace(/\/$/, '');
  // ORKY product ids may be catalog/search identities, not Product ObjectIds. The
  // seller dashboard remains the only authority for creation/editing.
  const url = productId?.startsWith('orchidy:')
    ? `${base}/dashboard/seller?from=orky&product=${encodeURIComponent(productId.slice('orchidy:'.length))}`
    : `${base}/dashboard/seller?from=orky`;
  window.open(url, '_blank', 'noopener,noreferrer');
}

export const ProductEditorScreen: React.FC = () => {
  const insets = useSafeAreaInsets();
  const nav = useNavigation();
  const { productId } = useRouteParams<Params>();

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => nav.back()}><Text style={styles.backIcon}>←</Text></TouchableOpacity>
        <Text style={styles.headerTitle}>Produit Orchidy</Text>
        <View style={styles.placeholder} />
      </View>
      <View style={styles.content}>
        <Text style={styles.eyebrow}>SOURCE DE VÉRITÉ : ORCHIDY</Text>
        <Text style={styles.title}>{productId ? 'Modifier ce produit dans Orchidy' : 'Créer le produit dans Orchidy'}</Text>
        <Text style={styles.body}>
          ORKY ne conserve plus un faux catalogue vendeur local. Les images, prix, variantes, stocks, vendeurs, livraison et publication commerciale sont gérés par Orchidy. Une fois le produit publié, tu peux revenir dans le Shop ORKY et créer une vidéo shoppable liée à son identifiant catalogue.
        </Text>
        <TouchableOpacity style={styles.primary} onPress={() => openOrchidySeller(productId)} accessibilityRole="link">
          <Text style={styles.primaryText}>Ouvrir le dashboard vendeur Orchidy ↗</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.secondary} onPress={() => nav.reset('shop')}>
          <Text style={styles.secondaryText}>Retour au catalogue ORKY</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: tokens.colors.bg },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: tokens.spacing.md, paddingVertical: tokens.spacing.sm, borderBottomWidth: .5, borderBottomColor: tokens.colors.surface },
  backIcon: { color: tokens.colors.white, fontSize: 24, width: 28 },
  headerTitle: { color: tokens.colors.white, fontSize: tokens.typography.title.fontSize, fontWeight: '700' },
  placeholder: { width: 28 },
  content: { flex: 1, justifyContent: 'center', padding: tokens.spacing.xl, gap: tokens.spacing.md },
  eyebrow: { color: tokens.colors.brand.secondary, fontSize: 11, fontWeight: '900', letterSpacing: 1.3 },
  title: { color: tokens.colors.white, fontSize: 28, fontWeight: '900', lineHeight: 34 },
  body: { color: tokens.colors.text.secondary, fontSize: tokens.typography.body.fontSize, lineHeight: 21 },
  primary: { marginTop: 8, minHeight: 50, borderRadius: tokens.radius.sm, backgroundColor: tokens.colors.brand.primary, alignItems: 'center', justifyContent: 'center', paddingHorizontal: tokens.spacing.md },
  primaryText: { color: tokens.colors.white, fontWeight: '800', textAlign: 'center' },
  secondary: { minHeight: 46, borderRadius: tokens.radius.sm, backgroundColor: tokens.colors.elevated, alignItems: 'center', justifyContent: 'center' },
  secondaryText: { color: tokens.colors.text.secondary, fontWeight: '700' },
});
