import React, { useMemo, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { tokens } from '@/theme/tokens';
import { useNavigation } from '@/navigation/NavigationContext';
import { useCartStore } from '@/store/cartStore';
import { formatPrice } from '@/services/demoShop';
import {
  PaymentKind,
  COUNTRIES,
  operatorsForCountry,
  operatorById,
  countryByCode,
  isValidLocalPhone,
  formatLocalPhone,
  eurToFcfa,
  formatFcfa,
} from '@/services/payment';

type Step = 'method' | 'momo_form' | 'card_form';

export const CheckoutScreen: React.FC = () => {
  const insets = useSafeAreaInsets();
  const nav = useNavigation();

  const subtotal = useCartStore((s) => s.subtotal());
  const shipping = useCartStore((s) => s.shippingTotal());
  const total = useCartStore((s) => s.total());

  const [step, setStep] = useState<Step>('method');
  const [method, setMethod] = useState<PaymentKind>('momo');
  const [countryCode, setCountryCode] = useState('CI');
  const [operatorId, setOperatorId] = useState('mtn');
  const [phone, setPhone] = useState('');
  const [showCountry, setShowCountry] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // card
  const [cardNumber, setCardNumber] = useState('');
  const [cardExp, setCardExp] = useState('');
  const [cardCvc, setCardCvc] = useState('');

  const country = countryByCode(countryCode)!;
  const operators = useMemo(() => operatorsForCountry(countryCode), [countryCode]);
  const operator = operatorById(operatorId) ?? operators[0];
  const fcfa = eurToFcfa(total);

  const confirmMomo = () => {
    if (!isValidLocalPhone(phone)) {
      setError('Entre un numéro de téléphone valide.');
      return;
    }
    setError(null);
    setError('Le paiement Mobile Money sera disponible après configuration du prestataire marchand.');
  };

  const confirmCard = () => {
    const digits = cardNumber.replace(/\s/g, '');
    if (digits.length < 13 || cardExp.length < 4 || cardCvc.length < 3) {
      setError('Vérifie les informations de la carte.');
      return;
    }
    setError('Le paiement par carte sera disponible après configuration de Stripe Checkout marchand.');
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => (step === 'method' ? nav.back() : setStep('method'))} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <Text style={styles.backIcon}>←</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Paiement</Text>
        <View style={styles.placeholder} />
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {/* Amount summary */}
        <View style={styles.amountCard}>
          <Text style={styles.amountLabel}>Montant à payer</Text>
          <Text style={styles.amountEur}>{formatPrice(total)}</Text>
          <Text style={styles.amountFcfa}>≈ {formatFcfa(fcfa)}</Text>
          <View style={styles.amountBreak}>
            <Text style={styles.amountBreakText}>Sous-total {formatPrice(subtotal)}</Text>
            <Text style={styles.amountBreakText}>Livraison {shipping === 0 ? 'offerte' : formatPrice(shipping)}</Text>
          </View>
        </View>

        {step === 'method' && (
          <>
            <Text style={styles.sectionTitle}>Moyen de paiement</Text>

            {/* Mobile Money */}
            <TouchableOpacity
              style={[styles.methodCard, method === 'momo' && styles.methodCardActive]}
              onPress={() => setMethod('momo')}
            >
              <Text style={styles.methodEmoji}>📱</Text>
              <View style={{ flex: 1 }}>
                <Text style={styles.methodTitle}>Mobile Money</Text>
                <Text style={styles.methodSub}>MTN, Orange, Wave, M-Pesa, Moov, Airtel</Text>
              </View>
              <View style={[styles.radio, method === 'momo' && styles.radioActive]} />
            </TouchableOpacity>

            {method === 'momo' && (
              <View style={styles.operatorGrid}>
                {operators.map((op) => (
                  <TouchableOpacity
                    key={op.id}
                    style={[styles.opChip, operatorId === op.id && { borderColor: op.color, backgroundColor: op.color + '1A' }]}
                    onPress={() => setOperatorId(op.id)}
                  >
                    <Text style={styles.opEmoji}>{op.emoji}</Text>
                    <Text style={[styles.opName, operatorId === op.id && { color: tokens.colors.white }]}>{op.short}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}

            {/* Card */}
            <TouchableOpacity
              style={[styles.methodCard, method === 'card' && styles.methodCardActive]}
              onPress={() => setMethod('card')}
            >
              <Text style={styles.methodEmoji}>💳</Text>
              <View style={{ flex: 1 }}>
                <Text style={styles.methodTitle}>Carte bancaire</Text>
                <Text style={styles.methodSub}>Visa · Mastercard</Text>
              </View>
              <View style={[styles.radio, method === 'card' && styles.radioActive]} />
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.payBtn}
              onPress={() => setStep(method === 'momo' ? 'momo_form' : 'card_form')}
            >
              <Text style={styles.payBtnText}>{method === 'momo' ? 'Continuer avec Mobile Money' : 'Continuer vers le paiement carte'}</Text>
            </TouchableOpacity>
          </>
        )}

        {step === 'momo_form' && (
          <>
            <Text style={styles.sectionTitle}>{operator.emoji} {operator.name}</Text>

            <Text style={styles.fieldLabel}>Pays</Text>
            <TouchableOpacity style={styles.select} onPress={() => setShowCountry((v) => !v)}>
              <Text style={styles.selectText}>{country.flag} {country.name} ({country.dialCode})</Text>
              <Text style={styles.selectChevron}>{showCountry ? '▲' : '▼'}</Text>
            </TouchableOpacity>
            {showCountry && (
              <View style={styles.countryList}>
                {COUNTRIES.map((c) => (
                  <TouchableOpacity
                    key={c.code}
                    style={styles.countryRow}
                    onPress={() => {
                      setCountryCode(c.code);
                      const ops = operatorsForCountry(c.code);
                      if (!ops.find((o) => o.id === operatorId)) setOperatorId(ops[0].id);
                      setShowCountry(false);
                    }}
                  >
                    <Text style={styles.countryText}>{c.flag} {c.name}</Text>
                    <Text style={styles.countryDial}>{c.dialCode}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}

            <Text style={styles.fieldLabel}>Numéro {operator.short}</Text>
            <View style={styles.phoneRow}>
              <View style={styles.dialBox}><Text style={styles.dialText}>{country.dialCode}</Text></View>
              <TextInput
                style={styles.phoneInput}
                placeholder="07 00 00 00 00"
                placeholderTextColor={tokens.colors.text.tertiary}
                value={formatLocalPhone(phone)}
                onChangeText={(t) => setPhone(t.replace(/\D/g, ''))}
                keyboardType="phone-pad"
              />
            </View>

            <View style={styles.infoBox}>
              <Text style={styles.infoText}>
                Tu recevras une demande de paiement de {formatFcfa(fcfa)} sur ton téléphone. Confirme avec ton code PIN {operator.short}.
              </Text>
            </View>

            {error && <Text style={styles.error}>{error}</Text>}

            <TouchableOpacity style={[styles.payBtn, { backgroundColor: operator.color }]} onPress={confirmMomo}>
              <Text style={[styles.payBtnText, { color: '#111' }]}>Envoyer la demande de paiement</Text>
            </TouchableOpacity>
          </>
        )}

        {step === 'card_form' && (
          <>
            <Text style={styles.sectionTitle}>💳 Carte bancaire</Text>
            <Text style={styles.fieldLabel}>Numéro de carte</Text>
            <TextInput
              style={styles.input}
              placeholder="4242 4242 4242 4242"
              placeholderTextColor={tokens.colors.text.tertiary}
              value={cardNumber}
              onChangeText={(t) => setCardNumber(t.replace(/[^\d]/g, '').replace(/(\d{4})(?=\d)/g, '$1 ').slice(0, 19))}
              keyboardType="number-pad"
            />
            <View style={styles.cardRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.fieldLabel}>Expiration</Text>
                <TextInput
                  style={styles.input}
                  placeholder="MM/AA"
                  placeholderTextColor={tokens.colors.text.tertiary}
                  value={cardExp}
                  onChangeText={(t) => setCardExp(t.replace(/[^\d]/g, '').replace(/(\d{2})(?=\d)/, '$1/').slice(0, 5))}
                  keyboardType="number-pad"
                />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.fieldLabel}>CVC</Text>
                <TextInput
                  style={styles.input}
                  placeholder="123"
                  placeholderTextColor={tokens.colors.text.tertiary}
                  value={cardCvc}
                  onChangeText={(t) => setCardCvc(t.replace(/[^\d]/g, '').slice(0, 4))}
                  keyboardType="number-pad"
                  secureTextEntry
                />
              </View>
            </View>
            {error && <Text style={styles.error}>{error}</Text>}
            <TouchableOpacity style={styles.payBtn} onPress={confirmCard}>
              <Text style={styles.payBtnText}>Payer {formatPrice(total)}</Text>
            </TouchableOpacity>
          </>
        )}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: tokens.colors.bg },
  center: { justifyContent: 'center', alignItems: 'center', paddingHorizontal: tokens.spacing.xl, gap: tokens.spacing.sm },
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
  content: { padding: tokens.spacing.md, paddingBottom: tokens.spacing.xxl, gap: tokens.spacing.sm },
  amountCard: { backgroundColor: tokens.colors.elevated, borderRadius: tokens.radius.md, padding: tokens.spacing.md, gap: 2 },
  amountLabel: { color: tokens.colors.text.secondary, fontSize: tokens.typography.body.fontSize },
  amountEur: { color: tokens.colors.white, fontSize: tokens.typography.display.fontSize, fontWeight: '800' },
  amountFcfa: { color: tokens.colors.brand.secondary, fontSize: tokens.typography.subhead.fontSize, fontWeight: '700' },
  amountBreak: { flexDirection: 'row', justifyContent: 'space-between', marginTop: tokens.spacing.sm },
  amountBreakText: { color: tokens.colors.text.tertiary, fontSize: tokens.typography.caption.fontSize },
  sectionTitle: { color: tokens.colors.white, fontSize: tokens.typography.subhead.fontSize, fontWeight: '800', marginTop: tokens.spacing.md },
  methodCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.spacing.md,
    backgroundColor: tokens.colors.elevated,
    borderRadius: tokens.radius.md,
    padding: tokens.spacing.md,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  methodCardActive: { borderColor: tokens.colors.brand.primary },
  methodEmoji: { fontSize: 24 },
  methodTitle: { color: tokens.colors.white, fontSize: tokens.typography.body.fontSize, fontWeight: '700' },
  methodSub: { color: tokens.colors.text.secondary, fontSize: tokens.typography.caption.fontSize, marginTop: 2 },
  radio: { width: 20, height: 20, borderRadius: 10, borderWidth: 2, borderColor: tokens.colors.surface },
  radioActive: { borderColor: tokens.colors.brand.primary, backgroundColor: tokens.colors.brand.primary },
  operatorGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: tokens.spacing.sm },
  opChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: tokens.spacing.md,
    paddingVertical: tokens.spacing.sm,
    borderRadius: tokens.radius.full,
    borderWidth: 1,
    borderColor: tokens.colors.surface,
    backgroundColor: tokens.colors.elevated,
  },
  opEmoji: { fontSize: 15 },
  opName: { color: tokens.colors.text.secondary, fontSize: tokens.typography.caption.fontSize, fontWeight: '700' },
  payBtn: {
    marginTop: tokens.spacing.lg,
    height: 52,
    borderRadius: tokens.radius.sm,
    backgroundColor: tokens.colors.brand.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  payBtnText: { color: tokens.colors.white, fontSize: tokens.typography.subhead.fontSize, fontWeight: '800' },
  fieldLabel: { color: tokens.colors.white, fontSize: tokens.typography.body.fontSize, fontWeight: '700', marginTop: tokens.spacing.sm },
  select: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: tokens.colors.elevated, borderRadius: tokens.radius.sm, paddingHorizontal: tokens.spacing.md, height: 48 },
  selectText: { color: tokens.colors.white, fontSize: tokens.typography.body.fontSize },
  selectChevron: { color: tokens.colors.text.secondary, fontSize: 12 },
  countryList: { backgroundColor: tokens.colors.elevated, borderRadius: tokens.radius.sm, overflow: 'hidden' },
  countryRow: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: tokens.spacing.md, paddingVertical: tokens.spacing.sm, borderBottomWidth: 0.5, borderBottomColor: tokens.colors.surface },
  countryText: { color: tokens.colors.white, fontSize: tokens.typography.body.fontSize },
  countryDial: { color: tokens.colors.text.secondary, fontSize: tokens.typography.body.fontSize },
  phoneRow: { flexDirection: 'row', gap: tokens.spacing.sm },
  dialBox: { backgroundColor: tokens.colors.surface, borderRadius: tokens.radius.sm, paddingHorizontal: tokens.spacing.md, height: 48, justifyContent: 'center' },
  dialText: { color: tokens.colors.white, fontSize: tokens.typography.body.fontSize, fontWeight: '700' },
  phoneInput: { flex: 1, backgroundColor: tokens.colors.elevated, borderRadius: tokens.radius.sm, color: tokens.colors.white, fontSize: tokens.typography.subhead.fontSize, paddingHorizontal: tokens.spacing.md, height: 48 },
  input: { backgroundColor: tokens.colors.elevated, borderRadius: tokens.radius.sm, color: tokens.colors.white, fontSize: tokens.typography.body.fontSize, paddingHorizontal: tokens.spacing.md, height: 48 },
  cardRow: { flexDirection: 'row', gap: tokens.spacing.md },
  infoBox: { backgroundColor: tokens.colors.brand.secondary + '14', borderRadius: tokens.radius.sm, padding: tokens.spacing.md, marginTop: tokens.spacing.sm },
  infoText: { color: tokens.colors.text.secondary, fontSize: tokens.typography.caption.fontSize, lineHeight: 17 },
  error: { color: tokens.colors.semantic.error, fontSize: tokens.typography.body.fontSize, marginTop: tokens.spacing.xs },
});
