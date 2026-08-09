import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { tokens } from '@/theme/tokens';
import { useNavigation } from '@/navigation/NavigationContext';
import { useCreatorAnalytics } from '@/hooks/useCreatorAnalytics';

function formatEuro(n: number): string {
  return `${n.toFixed(2).replace('.', ',')}\u00A0€`;
}
function formatShort(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1).replace('.0', '')}M`;
  if (n >= 1000) return `${(n / 1000).toFixed(1).replace('.0', '')}k`;
  return String(Math.round(n));
}

export const StudioMonetizationScreen: React.FC = () => {
  const insets = useSafeAreaInsets();
  const nav = useNavigation();
  // SIMULATEUR : aucun solde réel, aucun retrait. Les montants sont des
  // estimations pédagogiques basées sur les analytics (réelles si dispo).
  // Il n'existe pas encore de ledger de gains ni de paiement créateur.
  const analytics = useCreatorAnalytics();
  const totalViews = analytics.totalViews;
  const totalLikes = analytics.totalLikes;
  const estimatedCreatorFund = (totalViews / 1000) * 0.02;
  const estimatedGifts = Math.round(totalLikes * 0.9);
  const estimatedLive = estimatedGifts * 0.005;
  const estimatedGross = estimatedCreatorFund + estimatedLive;

  const programs = [
    { icon: '💸', label: 'Fonds créateur', value: formatEuro(estimatedCreatorFund), sub: 'Estimation ~0,02 € / 1000 vues', enabled: true },
    { icon: '💎', label: 'Cadeaux LIVE', value: `${formatShort(estimatedGifts)} diamants`, sub: `≈ ${formatEuro(estimatedLive)} / an`, enabled: true },
    { icon: '🛍️', label: 'Commissions Shop', value: 'À venir', sub: 'Ledger des commissions pas encore actif', enabled: false },
    { icon: '🤝', label: 'Partenariats marques', value: 'Bientôt', sub: 'Marketplace créateurs en préparation', enabled: false },
  ];

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => nav.back()} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <Text style={styles.backIcon}>←</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Monétisation</Text>
        <View style={styles.placeholder} />
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: tokens.spacing.xxl }}>
        {/* Simulator card — jamais un solde réel */}
        <View style={styles.simCard}>
          <View style={styles.simBadge}>
            <Text style={styles.simBadgeText}>SIMULATEUR</Text>
          </View>
          <Text style={styles.simTitle}>Estimation annuelle</Text>
          <Text style={styles.simValue}>{formatEuro(estimatedGross)}</Text>
          <Text style={styles.simSub}>Aucun paiement : les gains réels seront disponibles avec le ledger créateur et Stripe Connect (à venir).</Text>
        </View>

        {/* Programs */}
        <Text style={styles.sectionTitle}>Programmes</Text>
        <View style={styles.section}>
          {programs.map((p) => (
            <View key={p.label} style={styles.progRow}>
              <View style={styles.progIcon}><Text style={styles.progEmoji}>{p.icon}</Text></View>
              <View style={styles.progBody}>
                <Text style={styles.progLabel}>{p.label}</Text>
                <Text style={styles.progSub}>{p.sub}</Text>
              </View>
              <View style={styles.progRight}>
                <Text style={[styles.progValue, !p.enabled && styles.progValueDisabled]}>{p.value}</Text>
                <View style={[styles.statusDot, { backgroundColor: p.enabled ? tokens.colors.semantic.success : tokens.colors.text.tertiary }]} />
              </View>
            </View>
          ))}
        </View>

        <Text style={styles.disclaimer}>
          {analytics.live
            ? 'Estimations calculées depuis tes analytics réelles. Aucun retrait n’est possible tant que le paiement créateur n’est pas opérationnel.'
            : 'Estimations indicatives. Connecte-toi pour tes vraies stats — le paiement créateur n’est pas encore opérationnel.'}
        </Text>
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
  placeholder: { width: 28 },
  simCard: {
    margin: tokens.spacing.md,
    backgroundColor: tokens.colors.elevated,
    borderWidth: 1,
    borderColor: tokens.colors.surface,
    borderRadius: tokens.radius.lg,
    padding: tokens.spacing.lg,
    gap: 6,
  },
  simBadge: { alignSelf: 'flex-start', backgroundColor: tokens.colors.brand.primary, borderRadius: tokens.radius.xs, paddingHorizontal: 8, paddingVertical: 3 },
  simBadgeText: { color: tokens.colors.white, fontSize: tokens.typography.caption.fontSize, fontWeight: '800', letterSpacing: 0.5 },
  simTitle: { color: tokens.colors.text.secondary, fontSize: tokens.typography.body.fontSize, marginTop: tokens.spacing.sm },
  simValue: { color: tokens.colors.white, fontSize: 34, fontWeight: '800' },
  simSub: { color: tokens.colors.text.secondary, fontSize: tokens.typography.caption.fontSize, lineHeight: 16 },
  sectionTitle: { color: tokens.colors.white, fontSize: tokens.typography.subhead.fontSize, fontWeight: '800', paddingHorizontal: tokens.spacing.md, marginTop: tokens.spacing.lg, marginBottom: tokens.spacing.sm },
  section: { paddingHorizontal: tokens.spacing.md, gap: tokens.spacing.sm },
  progRow: { flexDirection: 'row', alignItems: 'center', gap: tokens.spacing.md, backgroundColor: tokens.colors.elevated, borderRadius: tokens.radius.md, padding: tokens.spacing.md },
  progIcon: { width: 40, height: 40, borderRadius: 20, backgroundColor: tokens.colors.surface, justifyContent: 'center', alignItems: 'center' },
  progEmoji: { fontSize: 20 },
  progBody: { flex: 1 },
  progLabel: { color: tokens.colors.white, fontSize: tokens.typography.body.fontSize, fontWeight: '700' },
  progSub: { color: tokens.colors.text.secondary, fontSize: tokens.typography.caption.fontSize, marginTop: 2 },
  progRight: { alignItems: 'flex-end', gap: 4 },
  progValue: { color: tokens.colors.white, fontSize: tokens.typography.body.fontSize, fontWeight: '700' },
  progValueDisabled: { color: tokens.colors.text.tertiary },
  statusDot: { width: 8, height: 8, borderRadius: 4 },
  disclaimer: { color: tokens.colors.text.tertiary, fontSize: tokens.typography.caption.fontSize, paddingHorizontal: tokens.spacing.md, marginTop: tokens.spacing.lg, lineHeight: 16 },
});
