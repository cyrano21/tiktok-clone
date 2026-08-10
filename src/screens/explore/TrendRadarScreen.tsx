import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, Image, ActivityIndicator } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { tokens } from '@/theme/tokens';
import { useNavigation } from '@/navigation/NavigationContext';
import { useSessionStore } from '@/store/sessionStore';
import {
  trendService,
  type TrendSignal,
  type SourcingCandidate,
  type SourcingRequest,
  type GeneratedVideoState,
} from '@/services/trendService';

const ZERO_DECIMAL_CURRENCIES = new Set([
  'BIF', 'CLP', 'DJF', 'GNF', 'ISK', 'JPY', 'KMF', 'KRW',
  'PYG', 'RWF', 'UGX', 'VND', 'VUV', 'XAF', 'XOF', 'XPF',
]);

function formatCount(value: number): string {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(1)}K`;
  return String(value);
}

function viralScore(signal: TrendSignal): number {
  const views = Math.max(1, signal.viralStats.views);
  const engagementRate = (signal.viralStats.likes + signal.viralStats.comments * 3) / views;
  return Math.round(Math.log10(views + 1) * 100 + Math.min(1, engagementRate) * 500);
}

function signalKey(request: SourcingRequest): string | null {
  const key = request.signal?.sourceSignalId || request.signal?.id;
  return key ? String(key) : null;
}

function minorUnitFactor(currency: string, explicit?: number): number {
  if (explicit === 1 || explicit === 100) return explicit;
  return ZERO_DECIMAL_CURRENCIES.has(String(currency || '').toUpperCase()) ? 1 : 100;
}

function sleep(ms: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, ms));
}

interface SourcingState {
  status: string;
  requestId?: string;
  candidates: SourcingCandidate[];
  error?: string;
  productId?: string;
  videoUrl?: string;
  videoStatus?: GeneratedVideoState['status'];
  videoJobId?: string;
  conversion?: SourcingRequest['conversion'];
  generatingVideo?: boolean;
}

function stateFromRequest(request: SourcingRequest): SourcingState {
  const video = request.generatedVideo;
  return {
    status: request.status,
    requestId: request._id,
    candidates: request.candidates || [],
    productId: request.orchidyProProductId || undefined,
    conversion: request.conversion ?? undefined,
    error: request.error || undefined,
    videoUrl: video?.hostedUrl || video?.sourceUrl || undefined,
    videoStatus: video?.status,
    videoJobId: video?.jobId,
    generatingVideo: video?.status === 'queued' || video?.status === 'processing',
  };
}

export const TrendRadarScreen: React.FC = () => {
  const insets = useSafeAreaInsets();
  const nav = useNavigation();
  const session = useSessionStore();
  const [trends, setTrends] = useState<TrendSignal[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sourcingByTrend, setSourcingByTrend] = useState<Record<string, SourcingState>>({});
  const [sourcingInFlight, setSourcingInFlight] = useState<string | null>(null);
  const [rankByConversion, setRankByConversion] = useState(false);
  const [conversionRank, setConversionRank] = useState<Record<string, SourcingRequest['conversion']>>({});

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const requests = await trendService.listSourcingRequests(50);
        if (cancelled) return;
        const conversions: Record<string, SourcingRequest['conversion']> = {};
        const states: Record<string, SourcingState> = {};
        for (const request of requests) {
          const key = signalKey(request);
          if (!key) continue;
          if (request.conversion) conversions[key] = request.conversion;
          // Reconstruct every persisted lifecycle state, including
          // candidates_ready. Otherwise a reload offered "Find product" again
          // and could duplicate supplier searches.
          states[key] = stateFromRequest(request);
        }
        if (!cancelled) {
          setConversionRank(conversions);
          setSourcingByTrend((previous) => ({ ...previous, ...states }));
        }
      } catch {
        // Conversion ranking is supplemental. The real trend feed remains usable.
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const pollGeneratedVideo = useCallback(async (trendId: string, requestId: string) => {
    for (let attempt = 0; attempt < 40; attempt += 1) {
      await sleep(attempt === 0 ? 1_000 : 4_000);
      try {
        const video = await trendService.getGeneratedVideo(requestId);
        if (!video) continue;
        const done = video.status === 'completed' || video.status === 'failed';
        setSourcingByTrend((previous) => {
          const current = previous[trendId];
          if (!current || current.requestId !== requestId) return previous;
          return {
            ...previous,
            [trendId]: {
              ...current,
              videoStatus: video.status,
              videoJobId: video.jobId,
              videoUrl: video.hostedUrl || video.sourceUrl || current.videoUrl,
              generatingVideo: !done,
              error: video.status === 'failed'
                ? video.error || 'La génération vidéo a échoué.'
                : current.error,
            },
          };
        });
        if (done) return;
      } catch {
        // Temporary status failure: continue polling; the server-side worker is
        // independent of this browser request.
      }
    }
    setSourcingByTrend((previous) => {
      const current = previous[trendId];
      if (!current || current.requestId !== requestId) return previous;
      return {
        ...previous,
        [trendId]: {
          ...current,
          generatingVideo: false,
          error: 'La génération continue en arrière-plan. Recharge la page pour vérifier son état.',
        },
      };
    });
  }, []);

  useEffect(() => {
    for (const [trendId, state] of Object.entries(sourcingByTrend)) {
      if (
        state.requestId &&
        state.generatingVideo &&
        (state.videoStatus === 'queued' || state.videoStatus === 'processing')
      ) {
        void pollGeneratedVideo(trendId, state.requestId);
      }
    }
    // Deliberately only start recovered jobs once on mount/reconciliation; a
    // POST starts its own poll immediately below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleGenerateVideo = async (signal: TrendSignal) => {
    const state = sourcingByTrend[signal.id];
    if (!state?.requestId || state.generatingVideo) return;
    setSourcingByTrend((previous) => ({
      ...previous,
      [signal.id]: { ...state, generatingVideo: true, error: undefined },
    }));
    try {
      const result = await trendService.generateVideo(state.requestId);
      setSourcingByTrend((previous) => {
        const current = previous[signal.id] || state;
        return {
          ...previous,
          [signal.id]: {
            ...current,
            generatingVideo: result.status !== 'completed' && result.status !== 'failed',
            videoStatus: result.status,
            videoJobId: result.jobId,
            videoUrl: result.videoUrl || current.videoUrl,
          },
        };
      });
      if (result.status !== 'completed' && result.status !== 'failed') {
        void pollGeneratedVideo(signal.id, state.requestId);
      }
    } catch (generationError: any) {
      setSourcingByTrend((previous) => ({
        ...previous,
        [signal.id]: {
          ...previous[signal.id],
          generatingVideo: false,
          error: generationError?.message || 'Impossible de lancer la génération vidéo.',
        },
      }));
    }
  };

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setTrends(await trendService.listTrends(50));
    } catch {
      setError('Impossible de charger les tendances. Réessaie.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const handleFindProduct = async (signal: TrendSignal) => {
    if (sourcingInFlight || !session.authenticated) return;
    setSourcingInFlight(signal.id);
    setSourcingByTrend((previous) => ({
      ...previous,
      [signal.id]: { status: 'sourcing', candidates: [] },
    }));
    try {
      const result = await trendService.sendToSourcing(signal);
      setSourcingByTrend((previous) => ({
        ...previous,
        [signal.id]: result.success
          ? {
              status: result.status,
              requestId: result.requestId,
              candidates: result.candidates,
            }
          : {
              status: 'failed',
              candidates: [],
              error: result.error || 'Sourcing indisponible',
            },
      }));
    } catch {
      setSourcingByTrend((previous) => ({
        ...previous,
        [signal.id]: { status: 'failed', candidates: [], error: 'Orchidy Pro indisponible' },
      }));
    } finally {
      setSourcingInFlight(null);
    }
  };

  const handleApprove = async (signal: TrendSignal, candidateId: string) => {
    const state = sourcingByTrend[signal.id];
    if (!state?.requestId) return;
    setSourcingByTrend((previous) => ({
      ...previous,
      [signal.id]: { ...state, status: 'approved', error: undefined },
    }));
    try {
      const result = await trendService.approveCandidate(state.requestId, candidateId);
      setSourcingByTrend((previous) => ({
        ...previous,
        [signal.id]: {
          ...previous[signal.id],
          status: result.success
            ? (result.orchidyMarketplaceProductId ? 'published' : 'product_created')
            : 'failed',
          candidates: state.candidates,
          productId: result.productId,
          error: result.success ? undefined : result.error || 'Approbation impossible',
        },
      }));
    } catch {
      setSourcingByTrend((previous) => ({
        ...previous,
        [signal.id]: { ...previous[signal.id], status: 'failed', error: 'Approbation impossible' },
      }));
    }
  };

  const renderCandidate = (signal: TrendSignal, candidate: SourcingCandidate) => (
    <View key={candidate.candidateId} style={styles.candidateCard}>
      <Image source={{ uri: candidate.imageUrl }} style={styles.candidateImage} />
      <View style={styles.candidateBody}>
        <Text style={styles.candidateTitle} numberOfLines={2}>{candidate.title}</Text>
        <Text style={styles.candidateMeta}>{candidate.supplierName} · {candidate.platform}</Text>
        <View style={styles.candidateRow}>
          <Text style={styles.candidatePrice}>{candidate.currency} {candidate.price}</Text>
          <Text style={[
            styles.candidateScore,
            candidate.matchScore >= 0.75
              ? styles.scoreHigh
              : candidate.matchScore >= 0.45
                ? styles.scoreMid
                : styles.scoreLow,
          ]}>
            correspondance estimée {(candidate.matchScore * 100).toFixed(0)}%
          </Text>
        </View>
        <Text style={styles.candidateMeta}>
          {candidate.stockKnown ? `Stock: ${candidate.stock ?? '?'}` : 'Stock non vérifié'}
          {candidate.shippingDays ? ` · livraison estimée ${candidate.shippingDays}j` : ' · délai à vérifier'}
        </Text>
        {candidate.riskFlags.length > 0 && (
          <Text style={styles.riskText}>{candidate.riskFlags.join(' · ')}</Text>
        )}
        <TouchableOpacity
          style={styles.approveButton}
          onPress={() => handleApprove(signal, candidate.candidateId)}
          disabled={Boolean(sourcingByTrend[signal.id]?.productId)}
        >
          <Text style={styles.approveButtonText}>Créer le produit sur Orchidy</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  const orderedTrends = rankByConversion
    ? [...trends].sort((a, b) => {
        const convA = conversionRank[a.id]?.ordersCount ?? 0;
        const convB = conversionRank[b.id]?.ordersCount ?? 0;
        if (convA !== convB) return convB - convA;
        return viralScore(b) - viralScore(a);
      })
    : trends;

  const renderTrend = ({ item }: { item: TrendSignal }) => {
    const state = sourcingByTrend[item.id];
    const score = viralScore(item);
    return (
      <View style={styles.trendCard}>
        <View style={styles.trendHeader}>
          <Image source={{ uri: item.thumbnailUrl }} style={styles.trendThumb} />
          <View style={styles.trendHeaderBody}>
            <Text style={styles.trendTitle} numberOfLines={2}>{item.caption || item.detectedProductName}</Text>
            <Text style={styles.trendCreator}>{item.creatorUsername ? `@${item.creatorUsername}` : 'Créateur TikTok'}</Text>
            <View style={styles.statsRow}>
              <Text style={styles.stat}>▶ {formatCount(item.viralStats.views)}</Text>
              <Text style={styles.stat}>♥ {formatCount(item.viralStats.likes)}</Text>
              <Text style={styles.stat}>💬 {formatCount(item.viralStats.comments)}</Text>
              <Text style={[styles.stat, styles.scoreText]}>indice {formatCount(score)}</Text>
            </View>
          </View>
        </View>

        <View style={styles.hashtagRow}>
          {(item.hashtags || []).slice(0, 6).map((tag) => (
            <View key={tag} style={styles.hashtagPill}><Text style={styles.hashtagText}>#{tag}</Text></View>
          ))}
        </View>

        <View style={styles.productLine}>
          <Text style={styles.productLabel}>Concept produit estimé</Text>
          <Text style={styles.productName}>{item.detectedProductName}</Text>
          <Text style={styles.signalNote}>Signal d'inspiration — identité produit à confirmer par le sourcing.</Text>
        </View>

        {!state && session.authenticated && (
          <TouchableOpacity style={styles.ctaButton} onPress={() => handleFindProduct(item)} disabled={sourcingInFlight === item.id}>
            <Text style={styles.ctaButtonText}>
              {sourcingInFlight === item.id ? 'Recherche en cours…' : '🔍 Trouver ce produit'}
            </Text>
          </TouchableOpacity>
        )}
        {!state && !session.authenticated && (
          <View style={styles.stateRow}><Text style={styles.stateText}>Connecte-toi pour lancer le sourcing.</Text></View>
        )}

        {state?.status === 'sourcing' && (
          <View style={styles.stateRow}>
            <ActivityIndicator color={tokens.colors.brand.primary} size="small" />
            <Text style={styles.stateText}>Sourcing fournisseurs (CJ / AliExpress)…</Text>
          </View>
        )}
        {state?.status === 'approved' && (
          <View style={styles.stateRow}>
            <ActivityIndicator color={tokens.colors.brand.primary} size="small" />
            <Text style={styles.stateText}>Création et validation du produit…</Text>
          </View>
        )}
        {state?.status === 'failed' && (
          <View style={styles.stateRow}><Text style={styles.errorText}>⚠ {state.error || 'Sourcing indisponible'}</Text></View>
        )}
        {state?.status === 'candidates_ready' && state.candidates.length === 0 && (
          <View style={styles.stateRow}><Text style={styles.stateText}>Aucun candidat fournisseur trouvé pour cette tendance.</Text></View>
        )}

        {state && (state.status === 'product_created' || state.status === 'published') && (
          <View style={styles.successBox}>
            <Text style={styles.successTitle}>✅ Produit créé sur Orchidy Pro</Text>
            <Text style={styles.successText}>
              {state.status === 'published'
                ? 'Publié sur la marketplace Orchidy — disponible dans le Shop ORKY.'
                : 'Fiche créée. La publication sur la marketplace Orchidy est en cours.'}
            </Text>

            {state.conversion && (
              <View style={styles.conversionRow}>
                {Object.entries(
                  state.conversion.byCurrency && Object.keys(state.conversion.byCurrency).length > 0
                    ? state.conversion.byCurrency
                    : {
                        [state.conversion.currency]: {
                          ordersCount: state.conversion.ordersCount,
                          unitsSold: state.conversion.unitsSold,
                          revenueCents: state.conversion.revenueCents,
                          minorUnitFactor: minorUnitFactor(state.conversion.currency),
                        },
                      },
                ).map(([currency, stats]) => {
                  const factor = minorUnitFactor(currency, stats.minorUnitFactor);
                  return (
                    <Text key={currency} style={styles.conversionText}>
                      🛒 {stats.ordersCount} commande{stats.ordersCount > 1 ? 's' : ''} · {stats.unitsSold} article{stats.unitsSold > 1 ? 's' : ''} ·{' '}
                      {currency} {(stats.revenueCents / factor).toFixed(factor === 1 ? 0 : 2)}
                    </Text>
                  );
                })}
                <Text style={styles.conversionHint}>Ventes réelles Orchidy · par devise</Text>
              </View>
            )}

            <TouchableOpacity
              style={styles.videoButton}
              onPress={() => handleGenerateVideo(item)}
              disabled={Boolean(state.generatingVideo || state.videoStatus === 'completed')}
            >
              <Text style={styles.videoButtonText}>
                {state.videoStatus === 'completed'
                  ? '🎬 Vidéo générée ✓'
                  : state.videoStatus === 'queued'
                    ? '🎬 Vidéo en file…'
                    : state.videoStatus === 'processing'
                      ? '🎬 Génération en cours…'
                      : state.generatingVideo
                        ? '🎬 Mise en file…'
                        : '🎬 Générer la vidéo produit'}
              </Text>
            </TouchableOpacity>
            {state.error && state.videoStatus === 'failed' && (
              <Text style={styles.errorText}>{state.error}</Text>
            )}
          </View>
        )}

        {state?.status === 'candidates_ready' && state.candidates.length > 0 && (
          <View style={styles.candidatesBlock}>
            <Text style={styles.candidatesTitle}>Candidats fournisseurs ({state.candidates.length})</Text>
            {state.candidates.map((candidate) => renderCandidate(item, candidate))}
          </View>
        )}
      </View>
    );
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => nav.back()}><Text style={styles.backIcon}>←</Text></TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle}>Tendances produits</Text>
          <Text style={styles.headerSubtitle}>Signaux TikTok · sourcing Orchidy</Text>
        </View>
        <TouchableOpacity
          onPress={() => setRankByConversion((value) => !value)}
          style={[styles.rankToggle, rankByConversion && styles.rankToggleActive]}
        >
          <Text style={[styles.rankToggleText, rankByConversion && styles.rankToggleTextActive]}>
            {rankByConversion ? 'Ventes réelles' : 'Viral'}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => void load()}><Text style={styles.refresh}>⟳</Text></TouchableOpacity>
      </View>

      {!session.authenticated && (
        <Text style={styles.notice}>Connecte-toi pour envoyer une tendance vers le sourcing Orchidy Pro.</Text>
      )}

      {loading && <View style={styles.state}><ActivityIndicator color={tokens.colors.brand.primary} /><Text style={styles.stateText}>Chargement des tendances…</Text></View>}
      {!loading && error && <View style={styles.state}><Text style={styles.errorText}>{error}</Text><TouchableOpacity onPress={() => void load()}><Text style={styles.retry}>Réessayer</Text></TouchableOpacity></View>}
      {!loading && !error && trends.length === 0 && <Text style={styles.stateText}>Aucune tendance pour le moment.</Text>}
      {!loading && !error && trends.length > 0 && (
        <FlatList
          data={orderedTrends}
          renderItem={renderTrend}
          keyExtractor={(item) => item.id}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.listContent}
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: tokens.colors.bg },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: tokens.spacing.md, paddingVertical: tokens.spacing.sm, gap: tokens.spacing.sm },
  backIcon: { color: tokens.colors.white, fontSize: 22 },
  refresh: { color: tokens.colors.brand.primary, fontSize: 22 },
  headerCenter: { flex: 1 },
  headerTitle: { color: tokens.colors.white, fontSize: tokens.typography.headline.fontSize, fontWeight: '700' },
  headerSubtitle: { color: tokens.colors.text.secondary, fontSize: tokens.typography.caption.fontSize },
  notice: { color: tokens.colors.text.secondary, textAlign: 'center', padding: tokens.spacing.md },
  state: { alignItems: 'center', justifyContent: 'center', gap: tokens.spacing.sm, padding: tokens.spacing.lg },
  stateText: { color: tokens.colors.text.secondary, textAlign: 'center', padding: tokens.spacing.sm },
  errorText: { color: tokens.colors.semantic.error, textAlign: 'center', padding: tokens.spacing.sm },
  retry: { color: tokens.colors.brand.primary, fontWeight: '700', textAlign: 'center' },
  listContent: { padding: tokens.spacing.md, gap: tokens.spacing.md },
  trendCard: { backgroundColor: tokens.colors.surface, borderRadius: tokens.radius.lg, padding: tokens.spacing.md, gap: tokens.spacing.sm },
  trendHeader: { flexDirection: 'row', gap: tokens.spacing.sm },
  trendThumb: { width: 88, height: 116, borderRadius: tokens.radius.md, backgroundColor: tokens.colors.bg },
  trendHeaderBody: { flex: 1, gap: tokens.spacing.xs },
  trendTitle: { color: tokens.colors.white, fontSize: tokens.typography.body.fontSize, fontWeight: '600' },
  trendCreator: { color: tokens.colors.text.link, fontSize: tokens.typography.caption.fontSize },
  statsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: tokens.spacing.sm },
  stat: { color: tokens.colors.text.secondary, fontSize: tokens.typography.caption.fontSize },
  scoreText: { color: tokens.colors.brand.primary, fontWeight: '700' },
  hashtagRow: { flexDirection: 'row', flexWrap: 'wrap', gap: tokens.spacing.xs },
  hashtagPill: { backgroundColor: tokens.colors.brand.primary + '22', borderRadius: 999, paddingHorizontal: tokens.spacing.sm, paddingVertical: 2 },
  hashtagText: { color: tokens.colors.brand.primary, fontSize: tokens.typography.caption.fontSize },
  productLine: { gap: 2 },
  productLabel: { color: tokens.colors.text.secondary, fontSize: tokens.typography.caption.fontSize, textTransform: 'uppercase', letterSpacing: 0.5 },
  productName: { color: tokens.colors.white, fontSize: tokens.typography.body.fontSize, fontWeight: '700' },
  signalNote: { color: tokens.colors.text.tertiary, fontSize: tokens.typography.caption.fontSize },
  ctaButton: { backgroundColor: tokens.colors.brand.primary, borderRadius: tokens.radius.md, paddingVertical: tokens.spacing.sm, alignItems: 'center' },
  ctaButtonText: { color: tokens.colors.white, fontWeight: '700', fontSize: tokens.typography.body.fontSize },
  stateRow: { flexDirection: 'row', alignItems: 'center', gap: tokens.spacing.sm, paddingVertical: tokens.spacing.sm },
  candidatesBlock: { gap: tokens.spacing.sm, marginTop: tokens.spacing.xs },
  candidatesTitle: { color: tokens.colors.text.secondary, fontSize: tokens.typography.caption.fontSize, textTransform: 'uppercase', letterSpacing: 0.5 },
  candidateCard: { flexDirection: 'row', backgroundColor: tokens.colors.bg, borderRadius: tokens.radius.md, padding: tokens.spacing.sm, gap: tokens.spacing.sm },
  candidateImage: { width: 72, height: 72, borderRadius: tokens.radius.sm, backgroundColor: tokens.colors.surface },
  candidateBody: { flex: 1, gap: 2 },
  candidateTitle: { color: tokens.colors.white, fontSize: tokens.typography.caption.fontSize, fontWeight: '600' },
  candidateMeta: { color: tokens.colors.text.secondary, fontSize: tokens.typography.caption.fontSize },
  riskText: { color: tokens.colors.action.tip, fontSize: tokens.typography.caption.fontSize },
  candidateRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: tokens.spacing.xs },
  candidatePrice: { color: tokens.colors.semantic.success, fontWeight: '700', fontSize: tokens.typography.body.fontSize },
  candidateScore: { flexShrink: 1, textAlign: 'right', fontWeight: '700', fontSize: tokens.typography.caption.fontSize },
  scoreHigh: { color: tokens.colors.semantic.success },
  scoreMid: { color: tokens.colors.action.tip },
  scoreLow: { color: tokens.colors.semantic.error },
  approveButton: { backgroundColor: tokens.colors.action.tip, borderRadius: tokens.radius.sm, paddingVertical: tokens.spacing.xs, alignItems: 'center', marginTop: tokens.spacing.xs },
  approveButtonText: { color: tokens.colors.white, fontWeight: '700', fontSize: tokens.typography.caption.fontSize },
  successBox: { backgroundColor: tokens.colors.semantic.success + '1A', borderRadius: tokens.radius.md, padding: tokens.spacing.sm, gap: 2 },
  successTitle: { color: tokens.colors.semantic.success, fontWeight: '700', fontSize: tokens.typography.body.fontSize },
  successText: { color: tokens.colors.text.secondary, fontSize: tokens.typography.caption.fontSize },
  conversionRow: { marginTop: tokens.spacing.xs, gap: 1 },
  conversionText: { color: tokens.colors.semantic.success, fontWeight: '700', fontSize: tokens.typography.caption.fontSize },
  conversionHint: { color: tokens.colors.text.tertiary, fontSize: tokens.typography.caption.fontSize },
  videoButton: { backgroundColor: tokens.colors.action.tip, borderRadius: tokens.radius.sm, paddingVertical: tokens.spacing.xs, alignItems: 'center', marginTop: tokens.spacing.xs },
  videoButtonText: { color: tokens.colors.white, fontWeight: '700', fontSize: tokens.typography.caption.fontSize },
  rankToggle: { borderColor: tokens.colors.brand.primary, borderWidth: 1, borderRadius: 999, paddingHorizontal: tokens.spacing.sm, paddingVertical: 2 },
  rankToggleActive: { backgroundColor: tokens.colors.brand.primary },
  rankToggleText: { color: tokens.colors.brand.primary, fontSize: tokens.typography.caption.fontSize, fontWeight: '600' },
  rankToggleTextActive: { color: tokens.colors.white },
});
