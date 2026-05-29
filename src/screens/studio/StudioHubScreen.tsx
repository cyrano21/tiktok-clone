import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Image } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { tokens } from '@/theme/tokens';
import { useNavigation } from '@/navigation/NavigationContext';
import { useStudioStore } from '@/store/studioStore';
import { useSessionStore } from '@/store/sessionStore';
import { MiniBarChart } from '@/components/studio/MiniBarChart';

function formatShort(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1).replace('.0', '')}M`;
  if (n >= 1000) return `${(n / 1000).toFixed(1).replace('.0', '')}k`;
  return String(Math.round(n));
}

function formatEuro(n: number): string {
  return `${n.toFixed(2).replace('.', ',')}\u00A0€`;
}

const DAY_LABELS = ['L', 'M', 'M', 'J', 'V', 'S', 'D'];

export const StudioHubScreen: React.FC = () => {
  const insets = useSafeAreaInsets();
  const nav = useNavigation();
  const analytics = useStudioStore((s) => s.analytics());
  const monetization = useStudioStore((s) => s.monetization());
  const posts = useStudioStore((s) => s.posts);
  const session = useSessionStore((s) => s);

  const tools: Array<{ icon: string; label: string; sub: string; route: any; params?: any; color: string }> = [
    { icon: '📊', label: 'Analyses', sub: 'Vues, abonnés, engagement', route: 'studio.analytics', color: tokens.colors.brand.secondary },
    { icon: '🎬', label: 'Mon contenu', sub: `${posts.length} publications`, route: 'studio.content', color: tokens.colors.brand.primary },
    { icon: '💰', label: 'Monétisation', sub: formatEuro(monetization.available) + ' dispo', route: 'studio.monetization', color: tokens.colors.action.tip },
    { icon: '🛍️', label: 'Ma boutique', sub: 'Produits & commandes', route: 'shop.dashboard', color: tokens.colors.semantic.success },
    { icon: '✨', label: 'Créer', sub: 'Studio vidéo & image', route: 'studio.editor', color: tokens.colors.text.link },
    { icon: '🎵', label: 'Mes vidéos TikTok', sub: 'Compte TikTok connecté', route: 'studio.tiktok', color: tokens.colors.brand.secondary },
    { icon: '📡', label: 'LIVE', sub: 'Lancer un direct', route: 'live.broadcast', color: tokens.colors.semantic.live },
  ];

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => nav.back()} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <Text style={styles.backIcon}>←</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>TikTok Studio</Text>
        <View style={styles.placeholder} />
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: tokens.spacing.xxl }}>
        {/* Creator identity */}
        <View style={styles.identity}>
          <Image source={{ uri: session.avatarUrl }} style={styles.avatar} />
          <View style={{ flex: 1 }}>
            <Text style={styles.name}>{session.displayName}</Text>
            <Text style={styles.handle}>@{session.username}</Text>
          </View>
          <View style={styles.followersBox}>
            <Text style={styles.followersValue}>{formatShort(analytics.followers)}</Text>
            <Text style={styles.followersLabel}>abonnés</Text>
          </View>
        </View>

        {/* 7-day overview card */}
        <View style={styles.overviewCard}>
          <View style={styles.overviewHead}>
            <Text style={styles.overviewTitle}>Vues · 7 derniers jours</Text>
            <TouchableOpacity onPress={() => nav.push('studio.analytics')}>
              <Text style={styles.overviewLink}>Détails ›</Text>
            </TouchableOpacity>
          </View>
          <Text style={styles.overviewTotal}>{formatShort(analytics.dailyViews.reduce((a, b) => a + b, 0))}</Text>
          <MiniBarChart data={analytics.dailyViews} labels={DAY_LABELS} height={110} />
        </View>

        {/* KPI strip */}
        <View style={styles.kpiRow}>
          <View style={styles.kpiCard}>
            <Text style={styles.kpiValue}>{formatShort(analytics.totalViews)}</Text>
            <Text style={styles.kpiLabel}>Vues totales</Text>
          </View>
          <View style={styles.kpiCard}>
            <Text style={styles.kpiValue}>{formatShort(analytics.totalLikes)}</Text>
            <Text style={styles.kpiLabel}>J'aime</Text>
          </View>
          <View style={styles.kpiCard}>
            <Text style={styles.kpiValue}>{analytics.engagementRate.toFixed(1)}%</Text>
            <Text style={styles.kpiLabel}>Engagement</Text>
          </View>
        </View>

        {/* Tools grid */}
        <Text style={styles.sectionTitle}>Outils créateur</Text>
        <View style={styles.toolsGrid}>
          {tools.map((t) => (
            <TouchableOpacity
              key={t.label}
              style={styles.toolCard}
              activeOpacity={0.85}
              onPress={() => nav.push(t.route, t.params)}
            >
              <View style={[styles.toolIcon, { backgroundColor: t.color + '22' }]}>
                <Text style={styles.toolEmoji}>{t.icon}</Text>
              </View>
              <Text style={styles.toolLabel}>{t.label}</Text>
              <Text style={styles.toolSub} numberOfLines={1}>{t.sub}</Text>
            </TouchableOpacity>
          ))}
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
  headerTitle: { color: tokens.colors.white, fontSize: tokens.typography.title.fontSize, fontWeight: '800' },
  placeholder: { width: 28 },
  identity: { flexDirection: 'row', alignItems: 'center', gap: tokens.spacing.md, padding: tokens.spacing.md },
  avatar: { width: 52, height: 52, borderRadius: 26, backgroundColor: tokens.colors.surface },
  name: { color: tokens.colors.white, fontSize: tokens.typography.subhead.fontSize, fontWeight: '800' },
  handle: { color: tokens.colors.text.secondary, fontSize: tokens.typography.caption.fontSize, marginTop: 2 },
  followersBox: { alignItems: 'flex-end' },
  followersValue: { color: tokens.colors.white, fontSize: tokens.typography.subhead.fontSize, fontWeight: '800' },
  followersLabel: { color: tokens.colors.text.secondary, fontSize: tokens.typography.caption.fontSize },
  overviewCard: {
    marginHorizontal: tokens.spacing.md,
    backgroundColor: tokens.colors.elevated,
    borderRadius: tokens.radius.md,
    padding: tokens.spacing.md,
    gap: tokens.spacing.sm,
  },
  overviewHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  overviewTitle: { color: tokens.colors.text.secondary, fontSize: tokens.typography.body.fontSize, fontWeight: '600' },
  overviewLink: { color: tokens.colors.brand.primary, fontSize: tokens.typography.body.fontSize, fontWeight: '700' },
  overviewTotal: { color: tokens.colors.white, fontSize: tokens.typography.display.fontSize, fontWeight: '800' },
  kpiRow: { flexDirection: 'row', gap: tokens.spacing.sm, paddingHorizontal: tokens.spacing.md, marginTop: tokens.spacing.md },
  kpiCard: { flex: 1, backgroundColor: tokens.colors.elevated, borderRadius: tokens.radius.md, padding: tokens.spacing.md, alignItems: 'center', gap: 4 },
  kpiValue: { color: tokens.colors.white, fontSize: tokens.typography.subhead.fontSize, fontWeight: '800' },
  kpiLabel: { color: tokens.colors.text.secondary, fontSize: tokens.typography.caption.fontSize },
  sectionTitle: { color: tokens.colors.white, fontSize: tokens.typography.subhead.fontSize, fontWeight: '800', paddingHorizontal: tokens.spacing.md, marginTop: tokens.spacing.lg, marginBottom: tokens.spacing.sm },
  toolsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: tokens.spacing.sm, paddingHorizontal: tokens.spacing.md },
  toolCard: {
    width: '47.6%',
    flexGrow: 1,
    backgroundColor: tokens.colors.elevated,
    borderRadius: tokens.radius.md,
    padding: tokens.spacing.md,
    gap: 6,
  },
  toolIcon: { width: 44, height: 44, borderRadius: tokens.radius.md, justifyContent: 'center', alignItems: 'center' },
  toolEmoji: { fontSize: 22 },
  toolLabel: { color: tokens.colors.white, fontSize: tokens.typography.body.fontSize, fontWeight: '700' },
  toolSub: { color: tokens.colors.text.secondary, fontSize: tokens.typography.caption.fontSize },
});
