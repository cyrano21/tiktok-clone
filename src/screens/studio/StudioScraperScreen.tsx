import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { tokens } from '@/theme/tokens';
import { useNavigation } from '@/navigation/NavigationContext';
import { scraperBridge } from '@/services/scraperBridge';

type Stats = {
  totalComments: number;
  totalVideos: number;
  uniqueUsers: number;
  spamCount: number;
  lastScraped: string;
};

export const StudioScraperScreen: React.FC = () => {
  const insets = useSafeAreaInsets();
  const nav = useNavigation();
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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

  useEffect(() => { void load(); }, [load]);

  const cards = stats ? [
    ['Vidéos référencées', stats.totalVideos],
    ['Commentaires observés', stats.totalComments],
    ['Utilisateurs externes', stats.uniqueUsers],
    ['Signaux spam', stats.spamCount],
  ] as const : [];

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => nav.back()}><Text style={styles.backIcon}>←</Text></TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle}>Recherche externe</Text>
          <Text style={styles.headerSubtitle}>TikTok · lecture seule</Text>
        </View>
        <TouchableOpacity onPress={() => void load()} disabled={loading}><Text style={styles.refresh}>↻</Text></TouchableOpacity>
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
          <View style={styles.infoCard}><Text style={styles.infoTitle}>Règles appliquées</Text><Text style={styles.infoValue}>Aucun avatar ou compteur n’est inventé · aucun like/follow ORKY sur une référence externe · aucun endpoint de reload exposé au navigateur · téléchargements yt-dlp bornés côté serveur.</Text></View>
        </> : null}
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
});
