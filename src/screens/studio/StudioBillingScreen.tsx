import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { tokens } from '@/theme/tokens';
import { useNavigation } from '@/navigation/NavigationContext';
import { saasService, Plan, SubscriptionInfo } from '@/services/saasService';

export const StudioBillingScreen: React.FC = () => {
  const insets = useSafeAreaInsets();
  const nav = useNavigation();

  const [plans, setPlans] = useState<Plan[]>([]);
  const [current, setCurrent] = useState<{ plan: string; subscription: SubscriptionInfo | null }>({
    plan: 'FREE',
    subscription: null,
  });
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const load = async () => {
    try {
      const [p, c] = await Promise.all([saasService.getPlans(), saasService.getCurrent()]);
      setPlans(p);
      setCurrent(c);
    } catch {
      // Unauthenticated — show hardcoded plans so the UI still teaches the model.
      setPlans([
        { id: 'FREE', name: 'Freemium', priceCents: 0, priceLabel: '0€', features: ['50 vidéos', 'Analytics basiques', 'Marque "Powered by"'] },
        { id: 'PRO', name: 'Pro', priceCents: 999, priceLabel: '9,99€/mois', features: ['Vidéos illimitées', 'Analytics avancées', 'Cross-posting TikTok · Reels · Shorts', 'Publication programmée'] },
        { id: 'BUSINESS', name: 'Business', priceCents: 2999, priceLabel: '29,99€/mois', features: ['Tout le plan Pro', 'Multi-comptes (10 membres)', 'Modération d’équipe', 'API + webhooks'] },
      ]);
      setMessage('Connecte-toi pour t’abonner — les plans sont affichés en démo.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const subscribe = async (plan: string) => {
    setBusy(plan);
    setMessage(null);
    try {
      const res = await saasService.subscribe(plan);
      await load();
      setMessage(`✓ ${res.message}`);
    } catch (e: any) {
      setMessage(`Erreur : ${e?.message ?? 'impossible de s’abonner'}`);
    } finally {
      setBusy(null);
    }
  };

  const cancel = async () => {
    setBusy('CANCEL');
    setMessage(null);
    try {
      await saasService.cancel();
      await load();
      setMessage('✓ Abonnement annulé (reste actif jusqu’à la fin de la période)');
    } catch (e: any) {
      setMessage(`Erreur : ${e?.message ?? 'impossible d’annuler'}`);
    } finally {
      setBusy(null);
    }
  };

  const activePlan = current.subscription?.plan ?? current.plan;

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => nav.back()} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <Text style={styles.backIcon}>←</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Abonnement</Text>
        <View style={styles.placeholder} />
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: tokens.spacing.xxl }}>
        {/* Current plan banner */}
        <View style={styles.currentCard}>
          <Text style={styles.currentLabel}>Plan actuel</Text>
          <Text style={styles.currentValue}>{activePlan === 'FREE' ? 'Freemium' : activePlan === 'PRO' ? 'Pro' : 'Business'}</Text>
          {current.subscription?.renewsAt ? (
            <Text style={styles.currentMeta}>
              Renouvellement : {new Date(current.subscription.renewsAt).toLocaleDateString('fr-FR')}
            </Text>
          ) : activePlan === 'FREE' ? (
            <Text style={styles.currentMeta}>Gratuit · aucune carte requise</Text>
          ) : null}
          {current.subscription?.status === 'canceled' && (
            <Text style={[styles.currentMeta, { color: tokens.colors.semantic.error }]}>
              Annulé — actif jusqu’à la fin de la période
            </Text>
          )}
          {activePlan !== 'FREE' && current.subscription?.status !== 'canceled' && (
            <TouchableOpacity style={styles.cancelBtn} onPress={cancel} disabled={busy === 'CANCEL'}>
              <Text style={styles.cancelText}>{busy === 'CANCEL' ? '…' : 'Annuler l’abonnement'}</Text>
            </TouchableOpacity>
          )}
        </View>

        {message && (
          <View style={styles.messageBanner}>
            <Text style={styles.messageText}>{message}</Text>
          </View>
        )}

        {/* Plan cards */}
        <Text style={styles.sectionTitle}>Choisis ton plan</Text>
        <View style={styles.section}>
          {plans.map((p) => {
            const isActive = activePlan === p.id;
            const isFree = p.id === 'FREE';
            return (
              <TouchableOpacity
                key={p.id}
                style={[styles.planCard, isActive && styles.planCardActive]}
                activeOpacity={0.9}
                onPress={() => subscribe(p.id)}
                disabled={busy !== null || isActive}
              >
                <View style={styles.planHead}>
                  <Text style={styles.planName}>{p.name}</Text>
                  {isActive && (
                    <View style={styles.activeBadge}>
                      <Text style={styles.activeBadgeText}>ACTIF</Text>
                    </View>
                  )}
                </View>
                <Text style={[styles.planPrice, isFree && { color: tokens.colors.text.secondary }]}>{p.priceLabel}</Text>
                <View style={styles.features}>
                  {p.features.map((f) => (
                    <Text key={f} style={styles.feature}>✓ {f}</Text>
                  ))}
                </View>
                <View
                  style={[
                    styles.subscribeBtn,
                    isActive && styles.subscribeBtnActive,
                    isFree && !isActive && styles.subscribeBtnFree,
                  ]}
                >
                  <Text
                    style={[
                      styles.subscribeText,
                      isActive && styles.subscribeTextActive,
                      isFree && !isActive && styles.subscribeTextFree,
                    ]}
                  >
                    {isActive ? (isFree ? 'Plan actuel' : 'Actuellement Pro') : busy === p.id ? '…' : isFree ? 'Passer au Freemium' : `Passer au ${p.name}`}
                  </Text>
                </View>
              </TouchableOpacity>
            );
          })}
        </View>

        <Text style={styles.disclaimer}>
          Paiement simulé en mode démo. Pour encaisser de vrais paiements, connecte Stripe via les variables
          d’environnement — l’API d’abonnement est déjà prête.
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
  currentCard: {
    margin: tokens.spacing.md,
    backgroundColor: tokens.colors.brand.primary,
    borderRadius: tokens.radius.lg,
    padding: tokens.spacing.lg,
    gap: 4,
  },
  currentLabel: { color: 'rgba(255,255,255,0.85)', fontSize: tokens.typography.body.fontSize },
  currentValue: { color: tokens.colors.white, fontSize: 34, fontWeight: '800' },
  currentMeta: { color: 'rgba(255,255,255,0.85)', fontSize: tokens.typography.caption.fontSize, marginTop: 2 },
  cancelBtn: {
    marginTop: tokens.spacing.md,
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.6)',
    borderRadius: tokens.radius.sm,
    paddingHorizontal: tokens.spacing.md,
    paddingVertical: 8,
  },
  cancelText: { color: tokens.colors.white, fontSize: tokens.typography.body.fontSize, fontWeight: '700' },
  messageBanner: {
    marginHorizontal: tokens.spacing.md,
    backgroundColor: tokens.colors.semantic.success + '22',
    borderRadius: tokens.radius.sm,
    padding: tokens.spacing.md,
    marginBottom: tokens.spacing.sm,
  },
  messageText: { color: tokens.colors.semantic.success, fontSize: tokens.typography.body.fontSize, fontWeight: '700' },
  sectionTitle: { color: tokens.colors.white, fontSize: tokens.typography.subhead.fontSize, fontWeight: '800', paddingHorizontal: tokens.spacing.md, marginTop: tokens.spacing.lg, marginBottom: tokens.spacing.sm },
  section: { paddingHorizontal: tokens.spacing.md, gap: tokens.spacing.md },
  planCard: {
    backgroundColor: tokens.colors.elevated,
    borderRadius: tokens.radius.lg,
    padding: tokens.spacing.lg,
    borderWidth: 1.5,
    borderColor: 'transparent',
    gap: tokens.spacing.sm,
  },
  planCardActive: { borderColor: tokens.colors.brand.primary },
  planHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  planName: { color: tokens.colors.white, fontSize: tokens.typography.subhead.fontSize, fontWeight: '800' },
  activeBadge: { backgroundColor: tokens.colors.brand.primary, borderRadius: tokens.radius.full, paddingHorizontal: tokens.spacing.sm, paddingVertical: 3 },
  activeBadgeText: { color: tokens.colors.white, fontSize: 10, fontWeight: '800', letterSpacing: 1 },
  planPrice: { color: tokens.colors.white, fontSize: tokens.typography.display.fontSize, fontWeight: '800' },
  features: { gap: 4 },
  feature: { color: tokens.colors.text.secondary, fontSize: tokens.typography.body.fontSize },
  subscribeBtn: {
    marginTop: tokens.spacing.sm,
    backgroundColor: tokens.colors.brand.primary,
    borderRadius: tokens.radius.sm,
    paddingVertical: tokens.spacing.md,
    alignItems: 'center',
  },
  subscribeBtnActive: { backgroundColor: tokens.colors.surface },
  subscribeBtnFree: { backgroundColor: tokens.colors.surface },
  subscribeText: { color: tokens.colors.white, fontSize: tokens.typography.subhead.fontSize, fontWeight: '800' },
  subscribeTextActive: { color: tokens.colors.text.secondary },
  subscribeTextFree: { color: tokens.colors.white },
  disclaimer: {
    color: tokens.colors.text.tertiary,
    fontSize: tokens.typography.caption.fontSize,
    paddingHorizontal: tokens.spacing.md,
    marginTop: tokens.spacing.lg,
    lineHeight: 16,
  },
});
