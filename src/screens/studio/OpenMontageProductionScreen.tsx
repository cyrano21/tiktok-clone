import React, { useEffect, useMemo, useState } from 'react';
import {
  Linking,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useRouteParams } from '@/navigation/NavigationContext';
import { tokens } from '@/theme/tokens';
import {
  createOpenMontageRenderLink,
  decideOpenMontageGate,
  getOpenMontageProduction,
  startOpenMontageProduction,
  type OpenMontageProduction,
} from '@/services/openMontageProduction';

const ACTIVE_HANDLE_KEY = 'orky.openmontage.active-handle.v1';

const STATUS_LABELS: Record<OpenMontageProduction['status'], string> = {
  queued: 'En attente',
  running: 'Production en cours',
  awaiting_approval: 'Validation requise',
  completed: 'Rendu terminé',
  failed: 'Échec',
  canceled: 'Annulé',
};

type RouteParams = {
  referenceUrl?: string;
  topic?: string;
  productId?: string;
  productTitle?: string;
  productUrl?: string;
};

function parseBoundedNumber(value: string, fallback: number, min: number, max: number) {
  const parsed = Number(String(value).replace(',', '.'));
  return Number.isFinite(parsed) ? Math.min(max, Math.max(min, parsed)) : fallback;
}

export const OpenMontageProductionScreen: React.FC = () => {
  const insets = useSafeAreaInsets();
  const nav = useNavigation();
  const params = useRouteParams<RouteParams>();

  const [referenceUrl, setReferenceUrl] = useState(params.referenceUrl || '');
  const [topic, setTopic] = useState(params.topic || params.productTitle || '');
  const [objective, setObjective] = useState('Créer une vidéo verticale originale, claire et publiable dans ORKY.');
  const [tone, setTone] = useState('dynamique, crédible, naturel');
  const [duration, setDuration] = useState('60');
  const [budget, setBudget] = useState('0');
  const [realFootageOnly, setRealFootageOnly] = useState(false);
  const [narration, setNarration] = useState(true);
  const [captions, setCaptions] = useState(true);
  const [production, setProduction] = useState<OpenMontageProduction | null>(null);
  const [approvalNote, setApprovalNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [restoring, setRestoring] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const isActive = production?.status === 'queued' || production?.status === 'running';
  const progressLabel = useMemo(() => {
    if (!production) return null;
    const progress = typeof production.progress === 'number' ? `${Math.round(production.progress)}%` : null;
    return [STATUS_LABELS[production.status], production.stage, progress].filter(Boolean).join(' · ');
  }, [production]);

  async function persistProduction(next: OpenMontageProduction | null) {
    setProduction(next);
    if (next?.handle) await AsyncStorage.setItem(ACTIVE_HANDLE_KEY, next.handle);
    else await AsyncStorage.removeItem(ACTIVE_HANDLE_KEY);
  }

  async function refresh(handle = production?.handle) {
    if (!handle) return;
    try {
      const next = await getOpenMontageProduction(handle);
      await persistProduction(next);
      setError(null);
    } catch (refreshError) {
      setError(refreshError instanceof Error ? refreshError.message : 'Impossible de lire la production.');
    }
  }

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const handle = await AsyncStorage.getItem(ACTIVE_HANDLE_KEY);
        if (handle && !cancelled) {
          const next = await getOpenMontageProduction(handle);
          if (!cancelled) setProduction(next);
        }
      } catch (restoreError) {
        if (!cancelled) {
          setError(restoreError instanceof Error ? restoreError.message : 'Reprise de la production impossible.');
        }
      } finally {
        if (!cancelled) setRestoring(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!isActive || !production?.handle) return;
    const timer = setInterval(() => {
      void refresh(production.handle);
    }, 5000);
    return () => clearInterval(timer);
    // The handle is the stable identity of one production. Status changes are
    // intentionally not dependencies so the interval is not recreated per poll.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isActive, production?.handle]);

  async function startProduction() {
    if (busy) return;
    const cleanTopic = topic.trim();
    if (cleanTopic.length < 3) {
      setError('Décris le sujet de la vidéo en au moins trois caractères.');
      return;
    }

    setBusy(true);
    setError(null);
    try {
      const next = await startOpenMontageProduction({
        ...(referenceUrl.trim() ? { referenceUrl: referenceUrl.trim() } : {}),
        topic: cleanTopic,
        objective: objective.trim() || 'Créer une vidéo originale pour ORKY.',
        targetDurationSeconds: Math.round(parseBoundedNumber(duration, 60, 10, 600)),
        aspectRatio: '9:16',
        language: 'fr',
        tone: tone.trim() || 'dynamique, crédible, naturel',
        budgetEur: parseBoundedNumber(budget, 0, 0, 1000),
        useRealFootageOnly: realFootageOnly,
        includeNarration: narration,
        includeCaptions: captions,
        ...(params.productTitle
          ? {
              product: {
                ...(params.productId ? { id: params.productId } : {}),
                title: params.productTitle,
                ...(params.productUrl ? { url: params.productUrl } : {}),
              },
            }
          : {}),
      });
      await persistProduction(next);
    } catch (startError) {
      setError(startError instanceof Error ? startError.message : 'La production n’a pas pu démarrer.');
    } finally {
      setBusy(false);
    }
  }

  async function decide(approved: boolean) {
    if (!production?.handle || !production.awaitingApproval || busy) return;
    setBusy(true);
    setError(null);
    try {
      const next = await decideOpenMontageGate({
        handle: production.handle,
        gate: production.awaitingApproval.gate,
        approved,
        note: approvalNote,
      });
      setApprovalNote('');
      await persistProduction(next);
    } catch (approvalError) {
      setError(approvalError instanceof Error ? approvalError.message : 'La décision n’a pas pu être transmise.');
    } finally {
      setBusy(false);
    }
  }

  async function openRender() {
    if (!production?.handle || !production.render || busy) return;
    setBusy(true);
    setError(null);
    try {
      const url = await createOpenMontageRenderLink(production.handle);
      const supported = await Linking.canOpenURL(url);
      if (!supported) throw new Error('Ce navigateur ne peut pas ouvrir le rendu final.');
      await Linking.openURL(url);
    } catch (renderError) {
      setError(renderError instanceof Error ? renderError.message : 'Le rendu final n’a pas pu être ouvert.');
    } finally {
      setBusy(false);
    }
  }

  async function forgetProduction() {
    await persistProduction(null);
    setApprovalNote('');
    setError(null);
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => nav.back()} style={styles.backButton}>
          <Text style={styles.backText}>←</Text>
        </TouchableOpacity>
        <View style={styles.headerCopy}>
          <Text style={styles.eyebrow}>ORKY Studio</Text>
          <Text style={styles.headerTitle}>Production agentique</Text>
        </View>
        <View style={styles.backButton} />
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.intro}>
          <Text style={styles.title}>Du brief au rendu, avec validations explicites.</Text>
          <Text style={styles.bodyText}>
            ORKY prépare le contrat de production et le confie à un executor OpenMontage externe. Aucun rendu n’est simulé : si l’executor n’est pas configuré, la production reste indisponible.
          </Text>
        </View>

        {params.productTitle ? (
          <View style={styles.productBanner}>
            <Text style={styles.smallLabel}>PRODUIT LIÉ</Text>
            <Text style={styles.productTitle}>{params.productTitle}</Text>
            <Text style={styles.muted}>Prix, stock, avis et promesses ne seront jamais inventés par le brief.</Text>
          </View>
        ) : null}

        {!production ? (
          <View style={styles.form}>
            <Field label="Sujet" value={topic} onChangeText={setTopic} placeholder="Ex. Pourquoi une batterie externe solaire peut être utile en voyage" multiline />
            <Field label="Vidéo de référence — facultatif" value={referenceUrl} onChangeText={setReferenceUrl} placeholder="https://…" autoCapitalize="none" />
            <Field label="Objectif" value={objective} onChangeText={setObjective} multiline />
            <Field label="Ton" value={tone} onChangeText={setTone} />
            <View style={styles.twoColumns}>
              <View style={styles.flexField}>
                <Field label="Durée (secondes)" value={duration} onChangeText={setDuration} keyboardType="numeric" />
              </View>
              <View style={styles.flexField}>
                <Field label="Budget max (€)" value={budget} onChangeText={setBudget} keyboardType="decimal-pad" />
              </View>
            </View>

            <ToggleRow label="Footage réel uniquement" value={realFootageOnly} onValueChange={setRealFootageOnly} />
            <ToggleRow label="Narration" value={narration} onValueChange={setNarration} />
            <ToggleRow label="Sous-titres" value={captions} onValueChange={setCaptions} />

            <TouchableOpacity disabled={busy || restoring} onPress={() => void startProduction()} style={[styles.primaryButton, (busy || restoring) && styles.disabled]}>
              <Text style={styles.primaryButtonText}>{busy ? 'Soumission…' : 'Préparer et lancer la production'}</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.productionCard}>
            <View style={styles.statusRow}>
              <View style={styles.statusCopy}>
                <Text style={styles.smallLabel}>PRODUCTION ACTIVE</Text>
                <Text style={styles.statusTitle}>{production.projectName || 'Production ORKY'}</Text>
                <Text style={styles.statusText}>{progressLabel}</Text>
              </View>
              <TouchableOpacity onPress={() => void refresh()} disabled={busy}>
                <Text style={styles.link}>Actualiser</Text>
              </TouchableOpacity>
            </View>

            {typeof production.progress === 'number' ? (
              <View style={styles.progressTrack}>
                <View style={[styles.progressFill, { width: `${Math.max(0, Math.min(100, production.progress))}%` }]} />
              </View>
            ) : null}

            <View style={styles.costRow}>
              <Metric label="Coût estimé" value={typeof production.estimatedCostEur === 'number' ? `${production.estimatedCostEur.toFixed(2)} €` : '—'} />
              <Metric label="Coût réel" value={typeof production.actualCostEur === 'number' ? `${production.actualCostEur.toFixed(2)} €` : '—'} />
            </View>

            {production.awaitingApproval ? (
              <View style={styles.approvalBox}>
                <Text style={styles.smallLabel}>VALIDATION REQUISE · {production.awaitingApproval.gate.toUpperCase()}</Text>
                <Text style={styles.bodyText}>{production.awaitingApproval.summary}</Text>
                <TextInput
                  value={approvalNote}
                  onChangeText={setApprovalNote}
                  placeholder="Note facultative pour l’agent de production"
                  placeholderTextColor={tokens.colors.text.tertiary}
                  multiline
                  style={[styles.input, styles.noteInput]}
                />
                <View style={styles.approvalActions}>
                  <TouchableOpacity onPress={() => void decide(false)} disabled={busy} style={styles.secondaryButton}>
                    <Text style={styles.secondaryButtonText}>Refuser / demander une révision</Text>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => void decide(true)} disabled={busy} style={styles.primaryButtonCompact}>
                    <Text style={styles.primaryButtonText}>Approuver</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ) : null}

            {production.render ? (
              <View style={styles.renderBox}>
                <Text style={styles.smallLabel}>RENDU DISPONIBLE</Text>
                <Text style={styles.statusTitle}>{production.render.fileName || 'Vidéo finale'}</Text>
                <Text style={styles.muted}>
                  {production.render.width && production.render.height ? `${production.render.width}×${production.render.height}` : 'Dimensions non renseignées'}
                  {production.render.durationSeconds ? ` · ${Math.round(production.render.durationSeconds)} s` : ''}
                </Text>
                <TouchableOpacity disabled={busy} onPress={() => void openRender()} style={[styles.primaryButton, busy && styles.disabled]}>
                  <Text style={styles.primaryButtonText}>{busy ? 'Préparation du lien…' : 'Ouvrir le rendu final'}</Text>
                </TouchableOpacity>
              </View>
            ) : null}

            {production.error ? <Text style={styles.errorText}>{production.error}</Text> : null}

            {!isActive ? (
              <TouchableOpacity onPress={() => void forgetProduction()} style={styles.textButton}>
                <Text style={styles.link}>Créer une nouvelle production</Text>
              </TouchableOpacity>
            ) : null}
          </View>
        )}

        {error ? <Text style={styles.errorText}>{error}</Text> : null}
      </ScrollView>
    </View>
  );
};

function Field(props: React.ComponentProps<typeof TextInput> & { label: string }) {
  const { label, multiline, ...inputProps } = props;
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        {...inputProps}
        multiline={multiline}
        placeholderTextColor={tokens.colors.text.tertiary}
        style={[styles.input, multiline && styles.multilineInput]}
      />
    </View>
  );
}

function ToggleRow({ label, value, onValueChange }: { label: string; value: boolean; onValueChange: (value: boolean) => void }) {
  return (
    <View style={styles.toggleRow}>
      <Text style={styles.toggleLabel}>{label}</Text>
      <Switch value={value} onValueChange={onValueChange} />
    </View>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.metric}>
      <Text style={styles.smallLabel}>{label.toUpperCase()}</Text>
      <Text style={styles.metricValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: tokens.colors.bg },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: tokens.spacing.md, paddingVertical: tokens.spacing.sm },
  backButton: { width: 42, minHeight: 42, justifyContent: 'center' },
  backText: { color: tokens.colors.white, fontSize: 25 },
  headerCopy: { flex: 1, alignItems: 'center' },
  eyebrow: { color: tokens.colors.text.tertiary, fontSize: 10, fontWeight: '800', letterSpacing: 1.4 },
  headerTitle: { color: tokens.colors.white, fontSize: tokens.typography.subhead.fontSize, fontWeight: '800' },
  content: { padding: tokens.spacing.md, paddingBottom: tokens.spacing.xxl, gap: tokens.spacing.lg },
  intro: { gap: tokens.spacing.sm, paddingVertical: tokens.spacing.sm },
  title: { color: tokens.colors.white, fontSize: 28, lineHeight: 34, fontWeight: '900' },
  bodyText: { color: tokens.colors.text.secondary, fontSize: tokens.typography.body.fontSize, lineHeight: 21 },
  muted: { color: tokens.colors.text.secondary, fontSize: tokens.typography.caption.fontSize, lineHeight: 18 },
  productBanner: { backgroundColor: tokens.colors.elevated, borderRadius: tokens.radius.md, padding: tokens.spacing.md, gap: 6 },
  productTitle: { color: tokens.colors.white, fontSize: tokens.typography.subhead.fontSize, fontWeight: '800' },
  smallLabel: { color: tokens.colors.text.tertiary, fontSize: 10, fontWeight: '900', letterSpacing: 1.1 },
  form: { gap: tokens.spacing.md },
  field: { gap: 7 },
  label: { color: tokens.colors.text.secondary, fontSize: tokens.typography.caption.fontSize, fontWeight: '700' },
  input: { backgroundColor: tokens.colors.elevated, color: tokens.colors.white, borderRadius: tokens.radius.md, minHeight: 48, paddingHorizontal: tokens.spacing.md, paddingVertical: 12, fontSize: tokens.typography.body.fontSize },
  multilineInput: { minHeight: 90, textAlignVertical: 'top' },
  noteInput: { minHeight: 86, textAlignVertical: 'top' },
  twoColumns: { flexDirection: 'row', gap: tokens.spacing.sm },
  flexField: { flex: 1 },
  toggleRow: { minHeight: 52, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: tokens.colors.elevated, borderRadius: tokens.radius.md, paddingHorizontal: tokens.spacing.md },
  toggleLabel: { color: tokens.colors.white, fontSize: tokens.typography.body.fontSize, fontWeight: '700' },
  primaryButton: { minHeight: 52, backgroundColor: tokens.colors.brand.primary, borderRadius: tokens.radius.md, alignItems: 'center', justifyContent: 'center', paddingHorizontal: tokens.spacing.md, marginTop: tokens.spacing.sm },
  primaryButtonCompact: { minHeight: 48, backgroundColor: tokens.colors.brand.primary, borderRadius: tokens.radius.md, alignItems: 'center', justifyContent: 'center', paddingHorizontal: tokens.spacing.lg, flex: 1 },
  primaryButtonText: { color: tokens.colors.white, fontWeight: '900', fontSize: tokens.typography.body.fontSize },
  disabled: { opacity: 0.5 },
  productionCard: { backgroundColor: tokens.colors.elevated, borderRadius: tokens.radius.md, padding: tokens.spacing.md, gap: tokens.spacing.md },
  statusRow: { flexDirection: 'row', justifyContent: 'space-between', gap: tokens.spacing.md },
  statusCopy: { flex: 1, gap: 5 },
  statusTitle: { color: tokens.colors.white, fontSize: tokens.typography.subhead.fontSize, fontWeight: '900' },
  statusText: { color: tokens.colors.text.secondary, fontSize: tokens.typography.body.fontSize },
  link: { color: tokens.colors.text.link, fontWeight: '800', fontSize: tokens.typography.body.fontSize },
  progressTrack: { height: 6, overflow: 'hidden', borderRadius: 3, backgroundColor: tokens.colors.surface },
  progressFill: { height: 6, borderRadius: 3, backgroundColor: tokens.colors.brand.primary },
  costRow: { flexDirection: 'row', gap: tokens.spacing.sm },
  metric: { flex: 1, backgroundColor: tokens.colors.surface, borderRadius: tokens.radius.md, padding: tokens.spacing.md, gap: 5 },
  metricValue: { color: tokens.colors.white, fontSize: 20, fontWeight: '900' },
  approvalBox: { backgroundColor: tokens.colors.surface, borderRadius: tokens.radius.md, padding: tokens.spacing.md, gap: tokens.spacing.sm },
  approvalActions: { flexDirection: 'row', gap: tokens.spacing.sm },
  secondaryButton: { flex: 1.4, minHeight: 48, borderRadius: tokens.radius.md, borderWidth: 1, borderColor: tokens.colors.text.tertiary, justifyContent: 'center', alignItems: 'center', paddingHorizontal: tokens.spacing.sm },
  secondaryButtonText: { color: tokens.colors.white, fontSize: tokens.typography.caption.fontSize, fontWeight: '800', textAlign: 'center' },
  renderBox: { backgroundColor: tokens.colors.surface, borderRadius: tokens.radius.md, padding: tokens.spacing.md, gap: 6 },
  errorText: { color: tokens.colors.semantic.live, fontSize: tokens.typography.body.fontSize, lineHeight: 20, fontWeight: '700' },
  textButton: { paddingVertical: tokens.spacing.sm, alignItems: 'flex-start' },
});
