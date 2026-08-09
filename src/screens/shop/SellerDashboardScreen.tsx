import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { tokens } from '@/theme/tokens';
import { useNavigation } from '@/navigation/NavigationContext';

function orchidySellerDashboardUrl() {
  const base = (process.env.NEXT_PUBLIC_ORCHIDY_BASE_URL || 'https://orchidy.fr').replace(/\/$/, '');
  return `${base}/dashboard/seller`;
}

function openSellerDashboard() {
  if (typeof window === 'undefined') return;
  window.open(orchidySellerDashboardUrl(), '_blank', 'noopener,noreferrer');
}

export const SellerDashboardScreen: React.FC = () => {
  const insets = useSafeAreaInsets();
  const nav = useNavigation();

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => nav.back()} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <Text style={styles.backIcon}>←</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Commerce</Text>
        <View style={styles.placeholder} />
      </View>

      <View style={styles.content}>
        <View style={styles.card}>
          <Text style={styles.eyebrow}>ORKY × ORCHIDY</Text>
          <Text style={styles.title}>La gestion vendeur reste dans Orchidy</Text>
          <Text style={styles.body}>
            ORKY ne fabrique plus de commandes, revenus, stocks ou statistiques vendeur locales. Le catalogue, les commandes, les prix, les stocks, la livraison et les paiements sont administrés dans le tableau de bord vendeur Orchidy.
          </Text>
          <TouchableOpacity style={styles.primary} onPress={openSellerDashboard} accessibilityRole="link">
            <Text style={styles.primaryText}>Ouvrir le dashboard vendeur Orchidy ↗</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.cardSecondary}>
          <Text style={styles.secondaryTitle}>Créer du contenu shoppable dans ORKY</Text>
          <Text style={styles.body}>
            Depuis un produit réel du Shop ORKY, utilise « Créer une vidéo » : après publication, ORKY enregistre uniquement l’identifiant du produit Orchidy. Le prix et le stock seront toujours revalidés par Orchidy au checkout.
          </Text>
          <TouchableOpacity style={styles.secondary} onPress={() => nav.reset('shop')}>
            <Text style={styles.secondaryText}>Choisir un produit Orchidy</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.linkButton} onPress={() => nav.push('studio.editor')}>
            <Text style={styles.linkText}>Créer une vidéo sans produit</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: tokens.colors.bg },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: tokens.spacing.md, paddingVertical: tokens.spacing.sm, borderBottomWidth: 0.5, borderBottomColor: tokens.colors.surface },
  backIcon: { color: tokens.colors.white, fontSize: 24, width: 28 },
  headerTitle: { color: tokens.colors.white, fontSize: tokens.typography.title.fontSize, fontWeight: '700' },
  placeholder: { width: 28 },
  content: { flex: 1, padding: tokens.spacing.md, gap: tokens.spacing.md, justifyContent: 'center' },
  card: { backgroundColor: '#171329', borderWidth: 1, borderColor: '#3B2D65', borderRadius: tokens.radius.lg, padding: tokens.spacing.lg, gap: tokens.spacing.sm },
  cardSecondary: { backgroundColor: tokens.colors.elevated, borderRadius: tokens.radius.lg, padding: tokens.spacing.lg, gap: tokens.spacing.sm },
  eyebrow: { color: tokens.colors.brand.secondary, fontSize: 11, fontWeight: '900', letterSpacing: 1.4 },
  title: { color: tokens.colors.white, fontSize: tokens.typography.headline.fontSize, fontWeight: '800', lineHeight: 28 },
  secondaryTitle: { color: tokens.colors.white, fontSize: tokens.typography.subhead.fontSize, fontWeight: '800' },
  body: { color: tokens.colors.text.secondary, fontSize: tokens.typography.body.fontSize, lineHeight: 20 },
  primary: { marginTop: tokens.spacing.sm, minHeight: 48, backgroundColor: tokens.colors.brand.primary, borderRadius: tokens.radius.sm, alignItems: 'center', justifyContent: 'center', paddingHorizontal: tokens.spacing.md },
  primaryText: { color: tokens.colors.white, fontSize: tokens.typography.body.fontSize, fontWeight: '800', textAlign: 'center' },
  secondary: { marginTop: tokens.spacing.sm, minHeight: 46, backgroundColor: tokens.colors.surface, borderRadius: tokens.radius.sm, alignItems: 'center', justifyContent: 'center' },
  secondaryText: { color: tokens.colors.white, fontSize: tokens.typography.body.fontSize, fontWeight: '700' },
  linkButton: { alignItems: 'center', paddingVertical: tokens.spacing.sm },
  linkText: { color: tokens.colors.brand.secondary, fontSize: tokens.typography.body.fontSize, fontWeight: '700' },
});
