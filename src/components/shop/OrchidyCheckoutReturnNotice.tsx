import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';

import { useCartStore } from '@/store/cartStore';
import { tokens } from '@/theme/tokens';

type VerifiedReturn = {
  status: 'paid' | 'cancelled';
  handoffId: string;
  checkoutId: string;
  reconciled: boolean;
};

function clearReceiptFromUrl() {
  if (typeof window === 'undefined') return;
  const url = new URL(window.location.href);
  if (!url.searchParams.has('orchidy_receipt')) return;
  url.searchParams.delete('orchidy_receipt');
  window.history.replaceState({}, '', `${url.pathname}${url.search}${url.hash}`);
}

async function waitForCartHydration() {
  if (useCartStore.persist.hasHydrated()) return;
  await new Promise<void>((resolve) => {
    const unsubscribe = useCartStore.persist.onFinishHydration(() => {
      unsubscribe();
      resolve();
    });
    // Hydration normally starts automatically. Calling rehydrate also covers SSR
    // transitions where the browser store was created before AsyncStorage became available.
    void useCartStore.persist.rehydrate();
  });
}

export const OrchidyCheckoutReturnNotice: React.FC = () => {
  const completeHandoff = useCartStore((state) => state.completeHandoff);
  const cancelHandoff = useCartStore((state) => state.cancelHandoff);
  const [result, setResult] = useState<VerifiedReturn | null>(null);
  const [invalidReceipt, setInvalidReceipt] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const receipt = new URL(window.location.href).searchParams.get('orchidy_receipt');
    if (!receipt) return;

    let active = true;
    (async () => {
      try {
        const response = await fetch(
          `/api/orchidy/checkout-return/verify?receipt=${encodeURIComponent(receipt)}`,
          { headers: { accept: 'application/json' }, cache: 'no-store' },
        );
        const payload = await response.json().catch(() => ({}));
        if (!active) return;
        if (!response.ok || !payload?.verified || !/^[a-f\d]{24}$/i.test(String(payload?.handoffId || ''))) {
          setInvalidReceipt(true);
          return;
        }

        await waitForCartHydration();
        if (!active) return;
        const status = payload.status === 'paid' ? 'paid' : 'cancelled';
        const handoffId = String(payload.handoffId);
        const reconciled = status === 'paid' ? completeHandoff(handoffId) : (cancelHandoff(handoffId), true);
        setResult({ status, handoffId, checkoutId: String(payload.checkoutId || ''), reconciled });
      } catch {
        if (active) setInvalidReceipt(true);
      } finally {
        if (active) clearReceiptFromUrl();
      }
    })();

    return () => { active = false; };
  }, [cancelHandoff, completeHandoff]);

  if (!result && !invalidReceipt) return null;
  const paidText = result?.reconciled
    ? 'Le reçu signé est valide. Seules les quantités correspondant à ce checkout ont été retirées du panier ORKY.'
    : 'Le paiement est confirmé, mais ORKY n’a trouvé aucun snapshot local correspondant. Aucun autre article du panier n’a été supprimé.';

  return (
    <View style={[styles.notice, invalidReceipt && styles.noticeError]}>
      <View style={styles.body}>
        <Text style={styles.eyebrow}>ORCHIDY</Text>
        <Text style={styles.title}>{invalidReceipt ? 'Retour de paiement non vérifiable' : result?.status === 'paid' ? 'Paiement confirmé par Orchidy' : 'Paiement interrompu sur Orchidy'}</Text>
        <Text style={styles.text}>{invalidReceipt ? 'ORKY n’a pas modifié ton panier, car le reçu signé est invalide ou expiré.' : result?.status === 'paid' ? paidText : 'Aucun succès de paiement n’est déclaré. Les articles restent dans ton panier pour réessayer.'}</Text>
        {result?.checkoutId ? <Text style={styles.reference}>Réf. {result.checkoutId}</Text> : null}
      </View>
      <TouchableOpacity accessibilityRole="button" accessibilityLabel="Fermer la notification de paiement" style={styles.close} onPress={() => { setResult(null); setInvalidReceipt(false); }}><Text style={styles.closeText}>×</Text></TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  notice: { position: 'absolute', left: 12, right: 12, top: 12, zIndex: 500, flexDirection: 'row', gap: tokens.spacing.sm, padding: tokens.spacing.md, borderRadius: tokens.radius.md, backgroundColor: '#13261C', borderWidth: 1, borderColor: '#2E7D4F', shadowColor: '#000', shadowOpacity: 0.35, shadowRadius: 16, shadowOffset: { width: 0, height: 8 } },
  noticeError: { backgroundColor: '#2A1717', borderColor: tokens.colors.semantic.error },
  body: { flex: 1, gap: 3 },
  eyebrow: { color: tokens.colors.brand.secondary, fontSize: 10, fontWeight: '900', letterSpacing: 1.4 },
  title: { color: tokens.colors.white, fontSize: tokens.typography.body.fontSize, fontWeight: '800' },
  text: { color: tokens.colors.text.secondary, fontSize: tokens.typography.caption.fontSize, lineHeight: 17 },
  reference: { color: tokens.colors.text.tertiary, fontSize: 10, marginTop: 2 },
  close: { width: 30, height: 30, alignItems: 'center', justifyContent: 'center' },
  closeText: { color: tokens.colors.white, fontSize: 24, lineHeight: 26 },
});
