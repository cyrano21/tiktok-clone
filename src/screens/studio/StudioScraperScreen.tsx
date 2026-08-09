import React, { useCallback, useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Alert } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { tokens } from '@/theme/tokens';
import { useNavigation } from '@/navigation/NavigationContext';
import { scraperBridge } from '@/services/scraperBridge';
import { useSessionStore } from '@/store/sessionStore';

type Stats = {
  totalComments: number;
  totalVideos: number;
  uniqueUsers: number;
  spamCount: number;
  lastScraped: string;
};

type RefreshStatus = {
  running: boolean;
  lastRun: string;
  lastStatus: string;
  message: string;
  autoRefreshEnabled: boolean;
  autoRefreshHourUtc: number;
};

export const StudioScraperScreen: React.FC = () => {
  const insets = useSafeAreaInsets();
  const nav = useNavigation();
  const isAdmin = useSessionStore((s) => s.role === 'admin');
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshStatus, setRefreshStatus] = useState<RefreshStatus | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [refreshError, setRefreshError] = useState<string | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const current = await scraperBridge.getStats();
      if (!current) throw new Error('Le service de recherche externe ne répond pas.');
      setStats(current);
    } catch (cause) {
      setStats(null);
      setError(cause instanceof Error ? cause.message : 'Service de recherche externe indisponible.');
    } finally {
      setLoading(false);
    }
  }, []);

  const loadRefreshStatus = useCallback(async () => {
    const status = await scraperBridge.getRefreshStatus();
    setRefreshStatus(status);
    if (status?.running) {
      setRefreshing(true);
    } else {
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { void load(); void loadRefreshStatus(); }, [load, loadRefreshStatus]);

  // Pendant une régénération, on poll le statut toutes les 5 s pour suivre la fin.
  useEffect(() => {
    if (!refreshing) return;
    pollRef.current = setInterval(() => { void loadRefreshStatus(); }, 5000);
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [refreshing, loadRefreshStatus]);

  const onRefreshCatalog = useCallback(() => {
    Alert.alert(
      'Régénérer le catalogue ?',
      'Le scraper relance une recherche TikTok (vidéos + commentaires réels) via Apify. Cette opération peut prendre plusieurs minutes et consomme du quota payant. Continuer ?',
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Régénérer',
          style: 'destructive',
          onPress: async () => {
            setRefreshing(true);
            setRefreshError(null);
            const result = await scraperBridge.refreshCatalog(6);
            if (!result.ok) {
              setRefreshing(false);
              setRefreshError(result.error || 'Régénération impossible.');
              return;
            }
            await loadRefreshStatus();
          },
        },
      ],
    );
  }, [loadRefreshStatus]);

  const cards = stats ? [
    ['Vidéos référencées', stats.totalVideos],
    ['Commentaires observés', stats.totalComments],
    ['Utilisateurs externes', stats.uniqueUsers],
    ['Signaux spam', stats.spamCount],
  ] as const : [];

  const hourLabel = refreshStatus?.autoRefreshEnabled
    ? `Quotidien à ${String(refreshStatus.autoRefreshHourUtc).padStart(2, '0')}:00 UTC`
    : 'Désactivée';

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => nav.back()}><Text style={styles.backIcon}>←</Text></TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle}>Recherche externe</Text>
          <Text style={styles.headerSubtitle}>TikTok · lecture seule</Text>
        </View>
        <TouchableOpacity onPress={() => { void load(); void loadRefreshStatus(); }} disabled={loading}><Text style={styles.refresh}>↻</Text></TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.truthCard}>
          <Text style={styles.truthTitle}>Source de recherche, pas réseau social ORKY</Text>
          <Text style={styles.truthText}>
            Le scraper n’est plus chargé dans un iframe modifiable. Le navigateur passe uniquement par le proxy ORKY autorisé. Les vidéos et identités externes restent en lecture seule jusqu’à une importation explicite dans le modèle canonique ORKY.
          </Text>
        </View>

        {loading ? <Text style={styles.state}>Lecture des statistiques…</Text> : null}
        {error ? <View style={styles.errorCard}><Text style={styles.errorTitle}>Service indisponible</Text><Text style={styles.errorText}>{error}</Text><TouchableOpacity style={styles.retry} onPress={() => void load()}><Text style={styles.retryText}>Réessayer</Text></TouchableOpacity></View> : null}

        {stats ? <>
          <View style={styles.grid}>{cards.map(([label, value]) => <View key={label} style={styles.metric}><Text style={styles.metricValue}>{Number(value).toLocaleString('fr-FR')}</Text><Text style={styles.metricLabel}>{label}</Text></View>)}</View>
          <View style={styles.infoCard}><Text style={styles.infoTitle}>Dernière donnée observée</Text><Text style={styles.infoValue}>{stats.lastScraped ? new Date(stats.lastScraped).toLocaleString('fr-FR') : 'Date non fournie par la source'}</Text></View>
        </> : null}

        {isAdmin ? (
        <View style={styles.refreshCard}>
          <Text style={styles.infoTitle}>Régénération du catalogue</Text>
          <Text style={styles.infoValue}>
            Relance une recherche des vidéos et commentaires TikTok les plus récents par catégorie. La mise à jour est visible dès la fin de l’opération.
          </Text>

          {refreshError ? <Text style={styles.refreshError}>{refreshError}</Text> : null}

          {refreshStatus?.running ? (
            <View style={styles.runningRow}>
              <Text style={styles.runningDot}>●</Text>
              <Text style={styles.runningText}>Régénération en cours… (plusieurs minutes)</Text>
            </View>
          ) : (
            <>
              {refreshStatus?.lastRun ? (
                <Text style={styles.lastRun}>
                  Dernière régénération : {new Date(refreshStatus.lastRun).toLocaleString('fr-FR')} ·{' '}
                  {refreshStatus.lastStatus === 'ok' ? 'réussie' : refreshStatus.lastStatus === 'failed' ? 'échouée' : refreshStatus.lastStatus}
                </Text>
              ) : null}
              <TouchableOpacity style={styles.refreshButton} onPress={onRefreshCatalog}>
                <Text style={styles.refreshButtonText}>Régénérer le catalogue</Text>
              </TouchableOpacity>
            </>
          )}

          <View style={styles.scheduleRow}>
            <Text style={styles.scheduleLabel}>Planification automatique</Text>
            <Text style={styles.scheduleValue}>{hourLabel}</Text>
          </View>
        </View>
        ) : (
          <View style={styles.refreshCard}>
            <Text style={styles.infoTitle}>Régénération du catalogue</Text>
            <Text style={styles.infoValue}>
              La régénération est réservée aux administrateurs ORKY. Contacte un administrateur pour déclencher une nouvelle collecte.
            </Text>
          </View>
        )}

        <View style={styles.infoCard}><Text style={styles.infoTitle}>Règles appliquées</Text><Text style={styles.infoValue}>Aucun avatar ou compteur n’est inventé · aucun like/follow ORKY sur une référence externe · aucun endpoint de reload exposé au navigateur · téléchargements yt-dlp bornés côté serveur.</Text></View>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: tokens.colors.bg },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: tokens.spacing.md, paddingVertical: tokens.spacing.sm, borderBottomWidth: .5, borderBottomColor: tokens.colors.surface },
  backIcon: { color: tokens.colors.white, fontSize: 24, width: 28 },
  headerCenter: { flex: 1, alignItems: 'center' },
  headerTitle: { color: tokens.colors.white, fontSize: tokens.typography.title.fontSize, fontWeight: '800' },
  headerSubtitle: { color: tokens.colors.text.secondary, fontSize: tokens.typography.caption.fontSize, marginTop: 2 },
  refresh: { color: tokens.colors.brand.secondary, fontSize: 24, width: 28, textAlign: 'center' },
  content: { padding: tokens.spacing.md, paddingBottom: tokens.spacing.xxl, gap: tokens.spacing.md },
  truthCard: { backgroundColor: '#171329', borderWidth: 1, borderColor: '#3B2D65', borderRadius: tokens.radius.lg, padding: tokens.spacing.lg, gap: 8 },
  truthTitle: { color: tokens.colors.white, fontSize: tokens.typography.subhead.fontSize, fontWeight: '800' },
  truthText: { color: tokens.colors.text.secondary, fontSize: tokens.typography.body.fontSize, lineHeight: 20 },
  state: { color: tokens.colors.text.secondary, textAlign: 'center', paddingVertical: tokens.spacing.xl },
  errorCard: { backgroundColor: '#2A1717', borderRadius: tokens.radius.md, padding: tokens.spacing.lg, gap: 8 },
  errorTitle: { color: tokens.colors.white, fontWeight: '800', fontSize: tokens.typography.subhead.fontSize },
  errorText: { color: tokens.colors.text.secondary, lineHeight: 19 },
  retry: { alignSelf: 'flex-start', backgroundColor: tokens.colors.brand.primary, borderRadius: tokens.radius.sm, paddingHorizontal: tokens.spacing.md, paddingVertical: 9 },
  retryText: { color: tokens.colors.white, fontWeight: '800' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: tokens.spacing.sm },
  metric: { width: '48%', minHeight: 104, backgroundColor: tokens.colors.elevated, borderRadius: tokens.radius.md, padding: tokens.spacing.md, justifyContent: 'center' },
  metricValue: { color: tokens.colors.white, fontSize: 26, fontWeight: '900' },
  metricLabel: { color: tokens.colors.text.secondary, fontSize: tokens.typography.caption.fontSize, marginTop: 4 },
  infoCard: { backgroundColor: tokens.colors.elevated, borderRadius: tokens.radius.md, padding: tokens.spacing.md, gap: 5 },
  infoTitle: { color: tokens.colors.white, fontWeight: '800' },
  infoValue: { color: tokens.colors.text.secondary, fontSize: tokens.typography.body.fontSize, lineHeight: 20 },
  refreshCard: { backgroundColor: '#151529', borderWidth: 1, borderColor: '#3B2D65', borderRadius: tokens.radius.lg, padding: tokens.spacing.lg, gap: 10 },
  refreshError: { color: '#FF6B6B', fontSize: tokens.typography.caption.fontSize },
  runningRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 4 },
  runningDot: { color: '#F72585', fontSize: 12 },
  runningText: { color: tokens.colors.white, fontSize: tokens.typography.body.fontSize, fontWeight: '700' },
  lastRun: { color: tokens.colors.text.secondary, fontSize: tokens.typography.caption.fontSize },
  refreshButton: { backgroundColor: tokens.colors.brand.secondary, borderRadius: tokens.radius.md, paddingVertical: 13, alignItems: 'center' },
  refreshButtonText: { color: '#09090F', fontWeight: '900', fontSize: tokens.typography.subhead.fontSize },
  scheduleRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 4 },
  scheduleLabel: { color: tokens.colors.text.secondary, fontSize: tokens.typography.caption.fontSize },
  scheduleValue: { color: tokens.colors.white, fontSize: tokens.typography.caption.fontSize, fontWeight: '800' },
});
