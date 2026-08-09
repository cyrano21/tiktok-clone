import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Linking } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { tokens } from '@/theme/tokens';
import { useNavigation } from '@/navigation/NavigationContext';
import { saasService, Plan, SubscriptionInfo } from '@/services/saasService';

const SAFE_FALLBACK_PLANS: Plan[] = [
  {
    id: 'FREE', name: 'Freemium', priceCents: 0, priceLabel: '0€', available: true,
    features: ['Publication et interactions sur ORKY', 'Résumé analytics créateur', 'Connexion TikTok en lecture selon scopes'],
  },
  {
    id: 'PRO', name: 'Pro', priceCents: 999, priceLabel: '9,99€/mois', available: true,
    features: ['Analytics avancées', 'Publication TikTok officielle si les scopes sont approuvés', 'Gestion Stripe'],
  },
  {
    id: 'BUSINESS', name: 'Business', priceCents: 2999, priceLabel: '29,99€/mois', available: false,
    statusLabel: 'Bientôt disponible', features: ['Espaces équipe — en préparation', 'API/webhooks — en préparation'],
  },
];

export const StudioBillingScreen: React.FC = () => {
  const insets = useSafeAreaInsets();
  const nav = useNavigation();
  const [plans, setPlans] = useState<Plan[]>([]);
  const [current, setCurrent] = useState<{ plan: string; subscription: SubscriptionInfo | null }>({ plan: 'FREE', subscription: null });
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const load = async () => {
    try {
      const [p, c] = await Promise.all([saasService.getPlans(), saasService.getCurrent()]);
      setPlans(p);
      setCurrent(c);
    } catch {
      // Fallback is deliberately conservative and never invents unavailable entitlements.
      setPlans(SAFE_FALLBACK_PLANS);
      setMessage('Connecte-toi au service pour vérifier les plans actuellement disponibles.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void load(); }, []);

  const openPortal = async () => {
    setBusy('PORTAL');
    setMessage(null);
    try {
      const { url } = await saasService.createPortal();
      await Linking.openURL(url);
    } catch (e: any) {
      setMessage(`Erreur : ${e?.message ?? 'impossible d’ouvrir la gestion Stripe'}`);
    } finally {
      setBusy(null);
    }
  };

  const selectPlan = async (plan: Plan) => {
    const activePlan = current.subscription?.plan ?? current.plan;
    if (plan.id === activePlan || plan.available === false) return;
    if (activePlan !== 'FREE' || plan.id === 'FREE') {
      await openPortal();
      return;
    }
    if (plan.id !== 'PRO' && plan.id !== 'BUSINESS') return;
    setBusy(plan.id);
    setMessage(null);
    try {
      const { url } = await saasService.createCheckout(plan.id);
      await Linking.openURL(url);
    } catch (e: any) {
      setMessage(`Erreur : ${e?.response?.data?.message ?? e?.message ?? 'impossible de démarrer le paiement Stripe'}`);
    } finally {
      setBusy(null);
    }
  };

  const activePlan = current.subscription?.plan ?? current.plan;

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => nav.back()} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}><Text style={styles.backIcon}>←</Text></TouchableOpacity>
        <Text style={styles.headerTitle}>Abonnement</Text><View style={styles.placeholder} />
      </View>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: tokens.spacing.xxl }}>
        <View style={styles.currentCard}>
          <Text style={styles.currentLabel}>Plan actuel</Text>
          <Text style={styles.currentValue}>{activePlan === 'FREE' ? 'Freemium' : activePlan === 'PRO' ? 'Pro' : 'Business'}</Text>
          {current.subscription?.renewsAt ? <Text style={styles.currentMeta}>Période en cours jusqu’au {new Date(current.subscription.renewsAt).toLocaleDateString('fr-FR')}</Text> : activePlan === 'FREE' ? <Text style={styles.currentMeta}>Gratuit · aucune carte requise</Text> : null}
          {current.subscription?.status && activePlan !== 'FREE' ? <Text style={styles.currentMeta}>Statut Stripe : {current.subscription.status}</Text> : null}
          {activePlan !== 'FREE' ? <TouchableOpacity style={styles.cancelBtn} onPress={openPortal} disabled={busy !== null}><Text style={styles.cancelText}>{busy === 'PORTAL' ? '…' : 'Gérer l’abonnement dans Stripe'}</Text></TouchableOpacity> : null}
        </View>
        {message ? <View style={styles.messageBanner}><Text style={styles.messageText}>{message}</Text></View> : null}
        <Text style={styles.sectionTitle}>{loading ? 'Chargement…' : 'Choisis ton plan'}</Text>
        <View style={styles.section}>
          {plans.map((p) => {
            const isActive = activePlan === p.id;
            const unavailable = p.available === false;
            const isFree = p.id === 'FREE';
            const hasPaidPlan = activePlan !== 'FREE';
            const actionLabel = unavailable
              ? (p.statusLabel || 'Indisponible')
              : isActive ? 'Plan actuel'
              : hasPaidPlan ? (isFree ? 'Gérer / annuler dans Stripe' : `Changer vers ${p.name}`)
              : isFree ? 'Plan gratuit' : `Choisir ${p.name}`;
            return (
              <TouchableOpacity key={p.id} style={[styles.planCard, isActive && styles.planCardActive, unavailable && styles.planCardUnavailable]} activeOpacity={0.9} onPress={() => void selectPlan(p)} disabled={busy !== null || unavailable || isActive || (isFree && activePlan === 'FREE')}>
                <View style={styles.planHead}><Text style={styles.planName}>{p.name}</Text>{isActive ? <View style={styles.activeBadge}><Text style={styles.activeBadgeText}>ACTIF</Text></View> : unavailable ? <View style={styles.comingBadge}><Text style={styles.comingBadgeText}>BIENTÔT</Text></View> : null}</View>
                <Text style={[styles.planPrice, isFree && { color: tokens.colors.text.secondary }]}>{p.priceLabel}</Text>
                <View style={styles.features}>{p.features.map((f) => <Text key={f} style={styles.feature}>✓ {f}</Text>)}</View>
                <View style={[styles.subscribeBtn, (isActive || unavailable) && styles.subscribeBtnActive, isFree && !isActive && styles.subscribeBtnFree]}><Text style={[styles.subscribeText, (isActive || unavailable) && styles.subscribeTextActive]}>{busy === p.id || (busy === 'PORTAL' && !isActive) ? '…' : actionLabel}</Text></View>
              </TouchableOpacity>
            );
          })}
        </View>
        <Text style={styles.disclaimer}>Paiement sécurisé par Stripe. Seules les capacités marquées disponibles sont commercialisées. Les droits payants sont synchronisés exclusivement depuis les webhooks Stripe signés.</Text>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: tokens.colors.bg },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: tokens.spacing.md, paddingVertical: tokens.spacing.sm, borderBottomWidth: 0.5, borderBottomColor: tokens.colors.surface },
  backIcon: { color: tokens.colors.white, fontSize: 24, width: 28 },
  headerTitle: { color: tokens.colors.white, fontSize: tokens.typography.title.fontSize, fontWeight: '700' },
  placeholder: { width: 28 },
  currentCard: { margin: tokens.spacing.md, backgroundColor: tokens.colors.brand.primary, borderRadius: tokens.radius.lg, padding: tokens.spacing.lg, gap: 4 },
  currentLabel: { color: 'rgba(255,255,255,0.85)', fontSize: tokens.typography.body.fontSize },
  currentValue: { color: tokens.colors.white, fontSize: 34, fontWeight: '800' },
  currentMeta: { color: 'rgba(255,255,255,0.85)', fontSize: tokens.typography.caption.fontSize, marginTop: 2 },
  cancelBtn: { marginTop: tokens.spacing.md, alignSelf: 'flex-start', borderWidth: 1, borderColor: 'rgba(255,255,255,0.6)', borderRadius: tokens.radius.sm, paddingHorizontal: tokens.spacing.md, paddingVertical: 8 },
  cancelText: { color: tokens.colors.white, fontSize: tokens.typography.body.fontSize, fontWeight: '700' },
  messageBanner: { marginHorizontal: tokens.spacing.md, backgroundColor: tokens.colors.semantic.success + '22', borderRadius: tokens.radius.sm, padding: tokens.spacing.md, marginBottom: tokens.spacing.sm },
  messageText: { color: tokens.colors.text.secondary, fontSize: tokens.typography.body.fontSize, fontWeight: '700' },
  sectionTitle: { color: tokens.colors.white, fontSize: tokens.typography.subhead.fontSize, fontWeight: '800', paddingHorizontal: tokens.spacing.md, marginTop: tokens.spacing.lg, marginBottom: tokens.spacing.sm },
  section: { paddingHorizontal: tokens.spacing.md, gap: tokens.spacing.md },
  planCard: { backgroundColor: tokens.colors.elevated, borderRadius: tokens.radius.lg, padding: tokens.spacing.lg, borderWidth: 1.5, borderColor: 'transparent', gap: tokens.spacing.sm },
  planCardActive: { borderColor: tokens.colors.brand.primary },
  planCardUnavailable: { opacity: 0.72 },
  planHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  planName: { color: tokens.colors.white, fontSize: tokens.typography.subhead.fontSize, fontWeight: '800' },
  activeBadge: { backgroundColor: tokens.colors.brand.primary, borderRadius: tokens.radius.full, paddingHorizontal: tokens.spacing.sm, paddingVertical: 3 },
  activeBadgeText: { color: tokens.colors.white, fontSize: 10, fontWeight: '800', letterSpacing: 1 },
  comingBadge: { backgroundColor: tokens.colors.surface, borderRadius: tokens.radius.full, paddingHorizontal: tokens.spacing.sm, paddingVertical: 3 },
  comingBadgeText: { color: tokens.colors.text.secondary, fontSize: 10, fontWeight: '800', letterSpacing: 1 },
  planPrice: { color: tokens.colors.white, fontSize: tokens.typography.display.fontSize, fontWeight: '800' },
  features: { gap: 4 },
  feature: { color: tokens.colors.text.secondary, fontSize: tokens.typography.body.fontSize },
  subscribeBtn: { marginTop: tokens.spacing.sm, backgroundColor: tokens.colors.brand.primary, borderRadius: tokens.radius.sm, paddingVertical: tokens.spacing.md, alignItems: 'center' },
  subscribeBtnActive: { backgroundColor: tokens.colors.surface },
  subscribeBtnFree: { backgroundColor: tokens.colors.surface },
  subscribeText: { color: tokens.colors.white, fontSize: tokens.typography.subhead.fontSize, fontWeight: '800' },
  subscribeTextActive: { color: tokens.colors.text.secondary },
  disclaimer: { color: tokens.colors.text.tertiary, fontSize: tokens.typography.caption.fontSize, paddingHorizontal: tokens.spacing.md, marginTop: tokens.spacing.lg, lineHeight: 16 },
});
