import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { tokens } from '@/theme/tokens';
import { useNavigation } from '@/navigation/NavigationContext';
import { saasService, PublishPlatform, PublishJob } from '@/services/saasService';

const STATUS_LABEL: Record<string, { label: string; color: string }> = {
  scheduled: { label: 'Programmé', color: tokens.colors.brand.secondary },
  processing: { label: 'En cours', color: tokens.colors.brand.primary },
  published: { label: 'Publié', color: tokens.colors.semantic.success },
  failed: { label: 'Échec', color: tokens.colors.semantic.error },
  canceled: { label: 'Annulé', color: tokens.colors.text.tertiary },
};

function formatDate(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('fr-FR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
}

const DEMO_PLATFORMS: PublishPlatform[] = [
  { id: 'tiktok', name: 'TikTok', icon: '🎵', connected: false },
  { id: 'reels', name: 'Instagram Reels', icon: '📸', connected: false },
  { id: 'shorts', name: 'YouTube Shorts', icon: '▶️', connected: false },
];

export const StudioCrossPostScreen: React.FC = () => {
  const insets = useSafeAreaInsets();
  const nav = useNavigation();

  const [platforms, setPlatforms] = useState<PublishPlatform[]>([]);
  const [jobs, setJobs] = useState<PublishJob[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set(['tiktok']));
  const [caption, setCaption] = useState('');
  const [videoUrl, setVideoUrl] = useState('');
  const [scheduledAt, setScheduledAt] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const load = async () => {
    try {
      const [p, j] = await Promise.all([saasService.getPlatforms(), saasService.getJobs()]);
      setPlatforms(p);
      setJobs(j);
      setMessage(null);
    } catch (e: any) {
      // Demo fallback so the UI stays explorable without auth.
      setPlatforms(DEMO_PLATFORMS);
      setJobs([]);
      setMessage(`Connecte-toi pour utiliser le cross-posting (${e?.message ?? 'erreur API'})`);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const toggle = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const schedule = async () => {
    if (selected.size === 0) {
      setMessage('Choisis au moins une plateforme.');
      return;
    }
    if (!videoUrl.trim() && !caption.trim()) {
      setMessage('Indique une URL de vidéo ou une légende à publier.');
      return;
    }
    setBusy(true);
    setMessage(null);
    try {
      const created = await saasService.schedule({
        videoUrl: videoUrl.trim() || undefined,
        caption: caption.trim() || undefined,
        platforms: Array.from(selected),
        scheduledAt: scheduledAt.trim() ? new Date(scheduledAt).toISOString() : undefined,
      });
      setVideoUrl('');
      setCaption('');
      setScheduledAt('');
      await load();
      // Set AFTER load() so load's setMessage(null) doesn't wipe the confirmation.
      setMessage(`✓ ${created.length} publication(s) planifiée(s)`);
    } catch (e: any) {
      setMessage(`Erreur : ${e?.message ?? 'impossible de programmer'}`);
    } finally {
      setBusy(false);
    }
  };

  const cancelJob = async (id: string) => {
    try {
      await saasService.cancelJob(id);
      await load();
    } catch {
      setMessage('Impossible d’annuler ce job.');
    }
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => nav.back()} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <Text style={styles.backIcon}>←</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Cross-posting</Text>
        <View style={styles.placeholder} />
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: tokens.spacing.xxl }}>
        {/* Platforms */}
        <Text style={styles.sectionTitle}>Plateformes connectées</Text>
        <View style={styles.section}>
          {platforms.map((p) => (
            <View key={p.id} style={styles.platformRow}>
              <Text style={styles.platformIcon}>{p.icon}</Text>
              <Text style={styles.platformName}>{p.name}</Text>
              <View style={[styles.connectBadge, { backgroundColor: (p.connected ? tokens.colors.semantic.success : tokens.colors.text.tertiary) + '22' }]}>
                <Text style={[styles.connectText, { color: p.connected ? tokens.colors.semantic.success : tokens.colors.text.tertiary }]}>
                  {p.connected ? 'Connecté' : 'À connecter'}
                </Text>
              </View>
            </View>
          ))}
          <Text style={styles.platformHint}>
            TikTok se connecte via OAuth officiel. Reels & Shorts nécessitent leurs clés API (Meta / YouTube) à ajouter en variable d’environnement.
          </Text>
        </View>

        {/* Scheduler */}
        <Text style={styles.sectionTitle}>Programmer une publication</Text>
        <View style={styles.section}>
          <View style={styles.pickRow}>
            {platforms.map((p) => {
              const on = selected.has(p.id);
              return (
                <TouchableOpacity
                  key={p.id}
                  style={[styles.platformPick, on && styles.platformPickOn]}
                  onPress={() => toggle(p.id)}
                >
                  <Text style={[styles.platformPickText, on && styles.platformPickTextOn]}>{p.icon} {p.name}</Text>
                </TouchableOpacity>
              );
            })}
          </View>

          <TextInput
            style={styles.input}
            placeholder="URL de la vidéo (ou vidéoId)"
            placeholderTextColor={tokens.colors.text.tertiary}
            value={videoUrl}
            onChangeText={setVideoUrl}
          />
          <TextInput
            style={styles.input}
            placeholder="Légende / description"
            placeholderTextColor={tokens.colors.text.tertiary}
            value={caption}
            onChangeText={setCaption}
          />
          <TextInput
            style={styles.input}
            placeholder="Programmer (YYYY-MM-DDTHH:mm) — vide = maintenant"
            placeholderTextColor={tokens.colors.text.tertiary}
            value={scheduledAt}
            onChangeText={setScheduledAt}
          />

          <TouchableOpacity style={[styles.scheduleBtn, busy && { opacity: 0.6 }]} onPress={schedule} disabled={busy}>
            <Text style={styles.scheduleText}>{busy ? '…' : '🚀 Programmer la publication'}</Text>
          </TouchableOpacity>
        </View>

        {message && (
          <View style={styles.messageBanner}>
            <Text style={styles.messageText}>{message}</Text>
          </View>
        )}

        {/* Job list */}
        <Text style={styles.sectionTitle}>Publications planifiées ({jobs.length})</Text>
        <View style={styles.section}>
          {jobs.length === 0 && (
            <Text style={styles.emptyText}>Aucune publication planifiée pour le moment.</Text>
          )}
          {jobs.map((j) => {
            const st = STATUS_LABEL[j.status] ?? { label: j.status, color: tokens.colors.text.secondary };
            return (
              <View key={j.id} style={styles.jobRow}>
                <Text style={styles.jobPlatform}>{platforms.find((p) => p.id === j.platform)?.icon ?? '🌐'} {j.platform}</Text>
                <Text style={styles.jobMeta} numberOfLines={1}>
                  {j.caption ?? j.videoUrl ?? j.videoId ?? '—'}
                </Text>
                <Text style={styles.jobDate}>{formatDate(j.scheduledAt)}</Text>
                <View style={styles.jobBottom}>
                  <View style={[styles.statusBadge, { backgroundColor: st.color + '22' }]}>
                    <Text style={[styles.statusText, { color: st.color }]}>{st.label}</Text>
                  </View>
                  {j.status === 'scheduled' && (
                    <TouchableOpacity onPress={() => cancelJob(j.id)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                      <Text style={styles.cancelLink}>Annuler</Text>
                    </TouchableOpacity>
                  )}
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
  sectionTitle: { color: tokens.colors.white, fontSize: tokens.typography.subhead.fontSize, fontWeight: '800', paddingHorizontal: tokens.spacing.md, marginTop: tokens.spacing.lg, marginBottom: tokens.spacing.sm },
  section: { paddingHorizontal: tokens.spacing.md, gap: tokens.spacing.sm },
  platformRow: { flexDirection: 'row', alignItems: 'center', gap: tokens.spacing.md, backgroundColor: tokens.colors.elevated, borderRadius: tokens.radius.md, padding: tokens.spacing.md },
  platformIcon: { fontSize: 22 },
  platformName: { flex: 1, color: tokens.colors.white, fontSize: tokens.typography.body.fontSize, fontWeight: '700' },
  connectBadge: { borderRadius: tokens.radius.full, paddingHorizontal: tokens.spacing.sm, paddingVertical: 4 },
  connectText: { fontSize: tokens.typography.caption.fontSize, fontWeight: '700' },
  platformHint: { color: tokens.colors.text.tertiary, fontSize: tokens.typography.caption.fontSize, lineHeight: 16 },
  pickRow: { flexDirection: 'row', flexWrap: 'wrap', gap: tokens.spacing.sm },
  platformPick: { paddingHorizontal: tokens.spacing.md, paddingVertical: 8, borderRadius: tokens.radius.full, backgroundColor: tokens.colors.elevated, borderWidth: 1.5, borderColor: 'transparent' },
  platformPickOn: { borderColor: tokens.colors.brand.primary, backgroundColor: tokens.colors.brand.primary + '22' },
  platformPickText: { color: tokens.colors.text.secondary, fontSize: tokens.typography.body.fontSize, fontWeight: '600' },
  platformPickTextOn: { color: tokens.colors.white, fontWeight: '800' },
  input: {
    backgroundColor: tokens.colors.elevated,
    borderRadius: tokens.radius.md,
    paddingHorizontal: tokens.spacing.md,
    paddingVertical: tokens.spacing.md,
    color: tokens.colors.white,
    fontSize: tokens.typography.body.fontSize,
  },
  scheduleBtn: { backgroundColor: tokens.colors.brand.primary, borderRadius: tokens.radius.md, paddingVertical: tokens.spacing.md, alignItems: 'center' },
  scheduleText: { color: tokens.colors.white, fontSize: tokens.typography.subhead.fontSize, fontWeight: '800' },
  messageBanner: {
    marginHorizontal: tokens.spacing.md,
    backgroundColor: tokens.colors.semantic.success + '22',
    borderRadius: tokens.radius.sm,
    padding: tokens.spacing.md,
    marginTop: tokens.spacing.md,
  },
  messageText: { color: tokens.colors.semantic.success, fontSize: tokens.typography.body.fontSize, fontWeight: '700' },
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
