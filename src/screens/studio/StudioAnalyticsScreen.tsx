import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Image } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { tokens } from '@/theme/tokens';
import { useNavigation } from '@/navigation/NavigationContext';
import { useStudioStore, MediaPost } from '@/store/studioStore';
import { MiniBarChart } from '@/components/studio/MiniBarChart';

function formatShort(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1).replace('.0', '')}M`;
  if (n >= 1000) return `${(n / 1000).toFixed(1).replace('.0', '')}k`;
  return String(Math.round(n));
}

const DAY_LABELS = ['L', 'M', 'M', 'J', 'V', 'S', 'D'];
type Metric = 'views' | 'likes' | 'comments' | 'shares';

const METRIC_TABS: Array<{ id: Metric; label: string }> = [
  { id: 'views', label: 'Vues' },
  { id: 'likes', label: "J'aime" },
  { id: 'comments', label: 'Commentaires' },
  { id: 'shares', label: 'Partages' },
];

export const StudioAnalyticsScreen: React.FC = () => {
  const insets = useSafeAreaInsets();
  const nav = useNavigation();
  const analytics = useStudioStore((s) => s.analytics());
  const posts = useStudioStore((s) => s.posts);
  const [metric, setMetric] = useState<Metric>('views');

  const metricTotal: Record<Metric, number> = {
    views: analytics.totalViews,
    likes: analytics.totalLikes,
    comments: analytics.totalComments,
    shares: analytics.totalShares,
  };

  // For non-view metrics we approximate a 7-day curve proportionally to daily views.
  const totalDaily = analytics.dailyViews.reduce((a, b) => a + b, 0) || 1;
  const chartData =
    metric === 'views'
      ? analytics.dailyViews
      : analytics.dailyViews.map((d) => Math.round((d / totalDaily) * metricTotal[metric]));

  const topPosts = [...posts].sort((a, b) => b.metrics.views - a.metrics.views).slice(0, 5);

  const renderTopPost = (p: MediaPost, rank: number) => (
    <TouchableOpacity key={p.id} style={styles.postRow} onPress={() => nav.push('studio.post', { postId: p.id })}>
      <Text style={styles.rank}>{rank}</Text>
      <Image source={{ uri: p.thumbnailUrl }} style={styles.thumb} />
      <View style={styles.postBody}>
        <Text style={styles.postCaption} numberOfLines={2}>{p.caption}</Text>
        <View style={styles.postMetaRow}>
          <Text style={styles.postMeta}>▶ {formatShort(p.metrics.views)}</Text>
          <Text style={styles.postMeta}>♥ {formatShort(p.metrics.likes)}</Text>
          <Text style={styles.postMeta}>💬 {formatShort(p.metrics.comments)}</Text>
        </View>
      </View>
      <Text style={styles.chevron}>›</Text>
    </TouchableOpacity>
  );

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => nav.back()} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <Text style={styles.backIcon}>←</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Analyses</Text>
        <View style={styles.placeholder} />
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: tokens.spacing.xxl }}>
        {/* Metric selector */}
        <View style={styles.metricTabs}>
          {METRIC_TABS.map((m) => (
            <TouchableOpacity
              key={m.id}
              style={[styles.metricTab, metric === m.id && styles.metricTabActive]}
              onPress={() => setMetric(m.id)}
            >
              <Text style={[styles.metricTabText, metric === m.id && styles.metricTabTextActive]}>{m.label}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Chart card */}
        <View style={styles.card}>
          <Text style={styles.cardLabel}>{METRIC_TABS.find((m) => m.id === metric)?.label} · 7 derniers jours</Text>
          <Text style={styles.cardTotal}>{formatShort(metricTotal[metric])}</Text>
          <MiniBarChart data={chartData} labels={DAY_LABELS} height={150} />
        </View>

        {/* Audience */}
        <View style={styles.statsGrid}>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>{formatShort(analytics.followers)}</Text>
            <Text style={styles.statLabel}>Abonnés</Text>
            <Text style={styles.statDelta}>+{formatShort(analytics.followersGained7d)} cette semaine</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>{analytics.engagementRate.toFixed(1)}%</Text>
            <Text style={styles.statLabel}>Taux d'engagement</Text>
            <Text style={styles.statDelta}>{formatShort(analytics.totalShares)} partages</Text>
          </View>
        </View>

        {/* Top posts */}
        <Text style={styles.sectionTitle}>Vidéos les plus vues</Text>
        <View style={styles.section}>
          {topPosts.map((p, i) => renderTopPost(p, i + 1))}
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
  metricTabs: { flexDirection: 'row', gap: tokens.spacing.sm, padding: tokens.spacing.md, flexWrap: 'wrap' },
  metricTab: { paddingHorizontal: tokens.spacing.md, paddingVertical: 7, borderRadius: tokens.radius.full, backgroundColor: tokens.colors.elevated },
  metricTabActive: { backgroundColor: tokens.colors.white },
  metricTabText: { color: tokens.colors.text.secondary, fontSize: tokens.typography.body.fontSize, fontWeight: '500' },
  metricTabTextActive: { color: tokens.colors.black, fontWeight: '700' },
  card: { marginHorizontal: tokens.spacing.md, backgroundColor: tokens.colors.elevated, borderRadius: tokens.radius.md, padding: tokens.spacing.md, gap: tokens.spacing.sm },
  cardLabel: { color: tokens.colors.text.secondary, fontSize: tokens.typography.body.fontSize, fontWeight: '600' },
  cardTotal: { color: tokens.colors.white, fontSize: tokens.typography.display.fontSize, fontWeight: '800' },
  statsGrid: { flexDirection: 'row', gap: tokens.spacing.sm, paddingHorizontal: tokens.spacing.md, marginTop: tokens.spacing.md },
  statCard: { flex: 1, backgroundColor: tokens.colors.elevated, borderRadius: tokens.radius.md, padding: tokens.spacing.md, gap: 4 },
  statValue: { color: tokens.colors.white, fontSize: tokens.typography.headline.fontSize, fontWeight: '800' },
  statLabel: { color: tokens.colors.text.secondary, fontSize: tokens.typography.caption.fontSize },
  statDelta: { color: tokens.colors.semantic.success, fontSize: tokens.typography.caption.fontSize, fontWeight: '600', marginTop: 2 },
  sectionTitle: { color: tokens.colors.white, fontSize: tokens.typography.subhead.fontSize, fontWeight: '800', paddingHorizontal: tokens.spacing.md, marginTop: tokens.spacing.lg, marginBottom: tokens.spacing.sm },
  section: { paddingHorizontal: tokens.spacing.md, gap: tokens.spacing.sm },
  postRow: { flexDirection: 'row', alignItems: 'center', gap: tokens.spacing.sm, backgroundColor: tokens.colors.elevated, borderRadius: tokens.radius.md, padding: tokens.spacing.sm },
  rank: { color: tokens.colors.brand.primary, fontSize: tokens.typography.subhead.fontSize, fontWeight: '800', width: 20, textAlign: 'center' },
  thumb: { width: 44, height: 56, borderRadius: tokens.radius.xs, backgroundColor: tokens.colors.surface },
  postBody: { flex: 1, gap: 4 },
  postCaption: { color: tokens.colors.white, fontSize: tokens.typography.body.fontSize, lineHeight: 18 },
  postMetaRow: { flexDirection: 'row', gap: tokens.spacing.md },
  postMeta: { color: tokens.colors.text.secondary, fontSize: tokens.typography.caption.fontSize },
  chevron: { color: tokens.colors.text.tertiary, fontSize: 20 },
});
