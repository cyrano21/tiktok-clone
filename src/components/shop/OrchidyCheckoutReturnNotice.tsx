import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';

import { useCartStore } from '@/store/cartStore';
import { tokens } from '@/theme/tokens';

type VerifiedReturn = {
  status: 'paid' | 'cancelled';
  checkoutId: string;
};

function clearReceiptFromUrl() {
  if (typeof window === 'undefined') return;
  const url = new URL(window.location.href);
  if (!url.searchParams.has('orchidy_receipt')) return;
  url.searchParams.delete('orchidy_receipt');
  window.history.replaceState({}, '', `${url.pathname}${url.search}${url.hash}`);
}

export const OrchidyCheckoutReturnNotice: React.FC = () => {
  const clearCart = useCartStore((state) => state.clear);
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
        if (!response.ok || !payload?.verified) {
          setInvalidReceipt(true);
          return;
        }
        const status = payload.status === 'paid' ? 'paid' : 'cancelled';
        if (status === 'paid') clearCart();
        setResult({ status, checkoutId: String(payload.checkoutId || '') });
      } catch {
        if (active) setInvalidReceipt(true);
      } finally {
        if (active) clearReceiptFromUrl();
      }
    })();

    return () => {
      active = false;
    };
  }, [clearCart]);

  if (!result && !invalidReceipt) return null;

  return (
    <View style={[styles.notice, invalidReceipt && styles.noticeError]}>
      <View style={styles.body}>
        <Text style={styles.eyebrow}>ORCHIDY</Text>
        <Text style={styles.title}>
          {invalidReceipt
            ? 'Retour de paiement non vérifiable'
            : result?.status === 'paid'
              ? 'Paiement confirmé par Orchidy'
              : 'Paiement interrompu sur Orchidy'}
        </Text>
        <Text style={styles.text}>
          {invalidReceipt
            ? 'ORKY n’a pas modifié ton panier, car le reçu signé est invalide ou expiré.'
            : result?.status === 'paid'
              ? 'Le reçu signé est valide. Le panier ORKY correspondant a été vidé.'
              : 'Aucun succès de paiement n’est déclaré. Ton panier ORKY reste disponible pour réessayer.'}
        </Text>
        {result?.checkoutId ? <Text style={styles.reference}>Réf. {result.checkoutId}</Text> : null}
      </View>
      <TouchableOpacity
        accessibilityRole="button"
        accessibilityLabel="Fermer la notification de paiement"
        style={styles.close}
        onPress={() => {
          setResult(null);
          setInvalidReceipt(false);
        }}
      >
        <Text style={styles.closeText}>×</Text>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  notice: {
    position: 'absolute',
    left: 12,
    right: 12,
    top: 12,
    zIndex: 500,
    flexDirection: 'row',
    gap: tokens.spacing.sm,
    padding: tokens.spacing.md,
    borderRadius: tokens.radius.md,
    backgroundColor: '#13261C',
    borderWidth: 1,
    borderColor: '#2E7D4F',
    shadowColor: '#000',
    shadowOpacity: 0.35,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
  },
  noticeError: {
    backgroundColor: '#2A1717',
    borderColor: tokens.colors.semantic.error,
  },
  body: { flex: 1, gap: 3 },
  eyebrow: {
    color: tokens.colors.brand.secondary,
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 1.4,
  },
  title: { color: tokens.colors.white, fontSize: tokens.typography.body.fontSize, fontWeight: '800' },
  text: { color: tokens.colors.text.secondary, fontSize: tokens.typography.caption.fontSize, lineHeight: 17 },
  reference: { color: tokens.colors.text.tertiary, fontSize: 10, marginTop: 2 },
  close: { width: 30, height: 30, alignItems: 'center', justifyContent: 'center' },
  closeText: { color: tokens.colors.white, fontSize: 24, lineHeight: 26 },
});
