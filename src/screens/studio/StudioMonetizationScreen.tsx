import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { tokens } from '@/theme/tokens';
import { useNavigation } from '@/navigation/NavigationContext';
import { useStudioStore } from '@/store/studioStore';
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
  // Montants basés sur les analytics RÉELLES du backend quand disponibles
  // (sinon fallback démo du store, étiqueté comme tel).
  const analytics = useCreatorAnalytics();
  const totalViews = analytics.live ? analytics.totalViews : useStudioStore((s) => s.analytics()).totalViews;
  const totalLikes = analytics.live ? analytics.totalLikes : useStudioStore((s) => s.analytics()).totalLikes;
  const creatorFund = (totalViews / 1000) * 0.02;
  const giftsDiamonds = Math.round(totalLikes * 0.9);
  const liveEarnings = giftsDiamonds * 0.005;
  const available = Math.max(0, (creatorFund + liveEarnings) * 0.7);
  const pending = (creatorFund + liveEarnings) * 0.3;
  const monetization = {
    available,
    pending,
    creatorFund,
    giftsDiamonds,
    liveEarnings,
  };
  const [confirmation, setConfirmation] = useState<boolean>(false);

  const handleWithdraw = () => {
    if (monetization.available <= 0) return;
    // Le paiement créateur n'est pas encore opérationnel : la demande est
    // enregistrée localement sans prétendre à un virement réel.
    setConfirmation(true);
  };

  const programs = [
    { icon: '💸', label: 'Fonds créateur', value: formatEuro(monetization.creatorFund), sub: 'Basé sur tes vues', active: true },
    { icon: '💎', label: 'Cadeaux LIVE', value: `${formatShort(monetization.giftsDiamonds)} diamants`, sub: formatEuro(monetization.liveEarnings), active: true },
    { icon: '🛍️', label: 'Commissions Shop', value: 'Activé', sub: 'Via TikTok Shop', active: true },
    { icon: '🤝', label: 'Partenariats marques', value: 'Éligible', sub: 'Marketplace créateurs', active: false },
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
        {/* Balance card */}
        <View style={styles.balanceCard}>
          <Text style={styles.balanceLabel}>Solde disponible</Text>
          <Text style={styles.balanceValue}>{formatEuro(monetization.available)}</Text>
          <Text style={styles.balancePending}>En attente : {formatEuro(monetization.pending)}</Text>
          <TouchableOpacity
            style={[styles.withdrawBtn, monetization.available <= 0 && styles.withdrawBtnDisabled]}
            onPress={handleWithdraw}
            disabled={monetization.available <= 0}
          >
            <Text style={styles.withdrawText}>Retirer mes gains</Text>
          </TouchableOpacity>
        </View>

        {confirmation && (
          <View style={styles.confirmBanner}>
            <Text style={styles.confirmText}>Demande de retrait enregistrée — le virement sera disponible à l’activation du paiement créateur (Stripe Connect à venir).</Text>
          </View>
        )}

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
                <Text style={styles.progValue}>{p.value}</Text>
                <View style={[styles.statusDot, { backgroundColor: p.active ? tokens.colors.semantic.success : tokens.colors.text.tertiary }]} />
              </View>
            </View>
          ))}
        </View>

        <Text style={styles.disclaimer}>
          {analytics.live
            ? 'Montants estimés depuis tes analytics réelles (taux ~0,02 € / 1000 vues). Le retrait sera opérationnel avec le paiement créateur (à venir).'
            : 'Mode démo : montants estimés depuis les données locales. Le retrait sera opérationnel avec le paiement créateur (à venir).'}
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
  balanceCard: {
    margin: tokens.spacing.md,
    backgroundColor: tokens.colors.brand.primary,
    borderRadius: tokens.radius.lg,
    padding: tokens.spacing.lg,
    gap: 6,
  },
  balanceLabel: { color: 'rgba(255,255,255,0.85)', fontSize: tokens.typography.body.fontSize },
  balanceValue: { color: tokens.colors.white, fontSize: 36, fontWeight: '800' },
  balancePending: { color: 'rgba(255,255,255,0.85)', fontSize: tokens.typography.caption.fontSize },
  withdrawBtn: {
    marginTop: tokens.spacing.md,
    backgroundColor: tokens.colors.white,
    borderRadius: tokens.radius.sm,
    paddingVertical: tokens.spacing.md,
    alignItems: 'center',
  },
  withdrawBtnDisabled: { opacity: 0.6 },
  withdrawText: { color: tokens.colors.brand.primary, fontSize: tokens.typography.subhead.fontSize, fontWeight: '800' },
  confirmBanner: {
    marginHorizontal: tokens.spacing.md,
    backgroundColor: tokens.colors.semantic.success + '22',
    borderRadius: tokens.radius.sm,
    padding: tokens.spacing.md,
  },
  confirmText: { color: tokens.colors.semantic.success, fontSize: tokens.typography.body.fontSize, fontWeight: '700', textAlign: 'center' },
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
  statusDot: { width: 8, height: 8, borderRadius: 4 },
  disclaimer: { color: tokens.colors.text.tertiary, fontSize: tokens.typography.caption.fontSize, paddingHorizontal: tokens.spacing.md, marginTop: tokens.spacing.lg, lineHeight: 16 },
});
