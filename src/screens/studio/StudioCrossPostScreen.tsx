import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { tokens } from '@/theme/tokens';
import { useNavigation } from '@/navigation/NavigationContext';
import { saasService, PublishPlatform, PublishJob } from '@/services/saasService';

const STATUS_LABEL: Record<string, { label: string; color: string }> = {
  scheduled: { label: 'Historique : programmé', color: tokens.colors.brand.secondary },
  processing: { label: 'Historique : en cours', color: tokens.colors.brand.primary },
  published: { label: 'Publié', color: tokens.colors.semantic.success },
  failed: { label: 'Échec', color: tokens.colors.semantic.error },
  canceled: { label: 'Annulé', color: tokens.colors.text.tertiary },
};

function formatDate(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('fr-FR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
}

export const StudioCrossPostScreen: React.FC = () => {
  const insets = useSafeAreaInsets();
  const nav = useNavigation();
  const [platforms, setPlatforms] = useState<PublishPlatform[]>([]);
  const [jobs, setJobs] = useState<PublishJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<string | null>(null);

  const load = async () => {
    try {
      const [p, j] = await Promise.all([saasService.getPlatforms(), saasService.getJobs()]);
      setPlatforms(p);
      setJobs(j);
      setMessage(null);
    } catch (e: any) {
      setPlatforms([]);
      setJobs([]);
      setMessage(`Impossible de charger les capacités de publication : ${e?.message ?? 'erreur API'}`);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void load(); }, []);

  const cancelJob = async (id: string) => {
    try {
      await saasService.cancelJob(id);
      await load();
    } catch {
      setMessage('Impossible d’annuler cet ancien job.');
    }
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => nav.back()} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}><Text style={styles.backIcon}>←</Text></TouchableOpacity>
        <Text style={styles.headerTitle}>Distribution</Text><View style={styles.placeholder} />
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: tokens.spacing.xxl }}>
        <View style={styles.truthCard}>
          <Text style={styles.truthTitle}>Pas de faux cross-posting</Text>
          <Text style={styles.truthText}>ORKY n’affiche plus Reels, Shorts ou une file programmée comme disponibles tant qu’aucun worker de livraison ne les exécute réellement. TikTok peut être publié via son API officielle uniquement lorsque le plan Pro et les scopes Content Posting sont actifs.</Text>
        </View>

        {message ? <View style={styles.messageBanner}><Text style={styles.messageText}>{message}</Text></View> : null}

        <Text style={styles.sectionTitle}>{loading ? 'Vérification des plateformes…' : 'Capacités actuelles'}</Text>
        <View style={styles.section}>
          {platforms.map((p) => {
            const available = p.available === true;
            return (
              <View key={p.id} style={styles.platformRow}>
                <Text style={styles.platformIcon}>{p.icon}</Text>
                <View style={styles.platformBody}>
                  <Text style={styles.platformName}>{p.name}</Text>
                  {p.message ? <Text style={styles.platformMessage}>{p.message}</Text> : null}
                </View>
                <View style={[styles.connectBadge, { backgroundColor: (available ? tokens.colors.semantic.success : tokens.colors.text.tertiary) + '22' }]}>
                  <Text style={[styles.connectText, { color: available ? tokens.colors.semantic.success : tokens.colors.text.tertiary }]}>{available ? 'Disponible' : p.connected ? 'Lecture seule' : 'Indisponible'}</Text>
                </View>
              </View>
            );
          })}
          {!loading && platforms.length === 0 ? <Text style={styles.emptyText}>Aucune plateforme vérifiable pour le moment.</Text> : null}
        </View>

        <Text style={styles.sectionTitle}>Anciens jobs ({jobs.length})</Text>
        <View style={styles.section}>
          {jobs.length === 0 ? <Text style={styles.emptyText}>Aucun historique de job.</Text> : null}
          {jobs.map((j) => {
            const st = STATUS_LABEL[j.status] ?? { label: j.status, color: tokens.colors.text.secondary };
            return (
              <View key={j.id} style={styles.jobRow}>
                <Text style={styles.jobPlatform}>{platforms.find((p) => p.id === j.platform)?.icon ?? '🌐'} {j.platform}</Text>
                <Text style={styles.jobMeta} numberOfLines={1}>{j.caption ?? j.videoUrl ?? j.videoId ?? '—'}</Text>
                <Text style={styles.jobDate}>{formatDate(j.scheduledAt)}</Text>
                <View style={styles.jobBottom}>
                  <View style={[styles.statusBadge, { backgroundColor: st.color + '22' }]}><Text style={[styles.statusText, { color: st.color }]}>{st.label}</Text></View>
                  {j.status === 'scheduled' ? <TouchableOpacity onPress={() => void cancelJob(j.id)}><Text style={styles.cancelLink}>Annuler</Text></TouchableOpacity> : null}
                </View>
              </View>
            );
          })}
        </View>
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
  truthCard: { margin: tokens.spacing.md, padding: tokens.spacing.lg, borderRadius: tokens.radius.lg, backgroundColor: '#171329', borderWidth: 1, borderColor: '#3B2D65', gap: 8 },
  truthTitle: { color: tokens.colors.white, fontSize: tokens.typography.subhead.fontSize, fontWeight: '800' },
  truthText: { color: tokens.colors.text.secondary, fontSize: tokens.typography.body.fontSize, lineHeight: 20 },
  sectionTitle: { color: tokens.colors.white, fontSize: tokens.typography.subhead.fontSize, fontWeight: '800', paddingHorizontal: tokens.spacing.md, marginTop: tokens.spacing.lg, marginBottom: tokens.spacing.sm },
  section: { paddingHorizontal: tokens.spacing.md, gap: tokens.spacing.sm },
  platformRow: { flexDirection: 'row', alignItems: 'center', gap: tokens.spacing.md, backgroundColor: tokens.colors.elevated, borderRadius: tokens.radius.md, padding: tokens.spacing.md },
  platformIcon: { fontSize: 22 },
  platformBody: { flex: 1, minWidth: 0 },
  platformName: { color: tokens.colors.white, fontSize: tokens.typography.body.fontSize, fontWeight: '700' },
  platformMessage: { color: tokens.colors.text.tertiary, fontSize: tokens.typography.caption.fontSize, marginTop: 3 },
  connectBadge: { borderRadius: tokens.radius.full, paddingHorizontal: tokens.spacing.sm, paddingVertical: 4 },
  connectText: { fontSize: tokens.typography.caption.fontSize, fontWeight: '700' },
  messageBanner: { marginHorizontal: tokens.spacing.md, backgroundColor: '#2A1717', borderRadius: tokens.radius.sm, padding: tokens.spacing.md },
  messageText: { color: tokens.colors.text.secondary, fontSize: tokens.typography.body.fontSize, fontWeight: '700' },
  emptyText: { color: tokens.colors.text.tertiary, fontSize: tokens.typography.body.fontSize },
  jobRow: { backgroundColor: tokens.colors.elevated, borderRadius: tokens.radius.md, padding: tokens.spacing.md, gap: 4 },
  jobPlatform: { color: tokens.colors.white, fontSize: tokens.typography.body.fontSize, fontWeight: '700' },
  jobMeta: { color: tokens.colors.text.secondary, fontSize: tokens.typography.caption.fontSize },
  jobDate: { color: tokens.colors.text.tertiary, fontSize: tokens.typography.caption.fontSize },
  jobBottom: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 4 },
  statusBadge: { borderRadius: tokens.radius.full, paddingHorizontal: tokens.spacing.sm, paddingVertical: 3 },
  statusText: { fontSize: tokens.typography.caption.fontSize, fontWeight: '700' },
  cancelLink: { color: tokens.colors.semantic.error, fontSize: tokens.typography.caption.fontSize, fontWeight: '700' },
});
