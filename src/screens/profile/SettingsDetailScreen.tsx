import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Image } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { tokens } from '@/theme/tokens';
import { useNavigation, useRouteParams } from '@/navigation/NavigationContext';
import { useMyProfile } from '@/hooks/useMyProfile';

interface DetailParams {
  title?: string;
  body?: string;
  id?: string;
}

// Meaningful content per setting so no section feels like a dead stub.
const SECTION_CONTENT: Record<string, { icon: string; rows: string[] }> = {
  privacy: {
    icon: '🔒',
    rows: [
      'Compte privé : seuls tes abonnés approuvés voient tes vidéos.',
      'Masquer mes likes sur mes vidéos.',
      'Qui peut commenter : tout le monde, abonnés, ou personne.',
      'Qui peut t’envoyer des messages.',
      'Qui peut faire un duet / un stitch de tes vidéos.',
    ],
  },
  security: {
    icon: '🛡',
    rows: [
      'Double authentification (2FA) — recommandée.',
      'Appareils connectés et sessions actives.',
      'Changer le mot de passe.',
      'Notifications de connexion suspecte.',
    ],
  },
  balance: {
    icon: '💰',
    rows: [
      'Solde : 0,00 € (aucune recharge).',
      'Acheter des pièces pour soutenir les créateurs.',
      'Historique des transactions.',
    ],
  },
  downloads: {
    icon: '📥',
    rows: [
      'Qualité de téléchargement : automatique.',
      'Vidéos téléchargées : 0.',
      'Télécharger uniquement en Wi-Fi.',
    ],
  },
  report: {
    icon: '⚠️',
    rows: [
      'Signaler un contenu inapproprié.',
      'Signaler un bug ou un problème technique.',
      'Faire une suggestion d’amélioration.',
    ],
  },
  help: {
    icon: '❓',
    rows: [
      'Centre d’aide : questions fréquentes.',
      'Contacter le support (réponse sous 24h).',
      'État du service.',
    ],
  },
  community: {
    icon: '📋',
    rows: [
      'Règles communautaires : respect, sécurité, authenticité.',
      'Signalement des violations.',
      'Appel des décisions de modération.',
    ],
  },
  terms: {
    icon: '📄',
    rows: [
      "Conditions d'utilisation du service.",
      'Dernière mise à jour : 2026.',
      'Utilisation responsable de la plateforme.',
    ],
  },
  privacy_policy: {
    icon: '🔐',
    rows: [
      'Données collectées : profil, contenu, interactions.',
      'Finalités : recommandations, modération, sécurité.',
      'Droits : accès, rectification, suppression (RGPD).',
      'Cookies et mesure d’audience.',
    ],
  },
};

export const SettingsDetailScreen: React.FC = () => {
  const insets = useSafeAreaInsets();
  const nav = useNavigation();
  const { title = 'Réglage', body, id } = useRouteParams<DetailParams>();
  const profile = useMyProfile();

  const isManage = id === 'manage';
  const content = id ? SECTION_CONTENT[id] : undefined;

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => nav.back()} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <Text style={styles.backIcon}>←</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle} numberOfLines={1}>{title}</Text>
        <TouchableOpacity onPress={() => nav.push('profile')} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <Text style={styles.profileLink}>Profil ›</Text>
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {isManage ? (
          <>
            {/* Real account card */}
            <View style={styles.accountCard}>
              <Image source={{ uri: profile.user.avatarUrl ?? '' }} style={styles.avatar} />
              <Text style={styles.accountName}>{profile.user.displayName}</Text>
              <Text style={styles.accountUsername}>@{profile.user.username}</Text>
              {profile.user.bio ? (
                <Text style={styles.accountBio}>{profile.user.bio}</Text>
              ) : (
                <Text style={[styles.accountBio, { color: tokens.colors.text.tertiary }]}>Aucune bio</Text>
              )}
              <View style={styles.accountStats}>
                <View style={styles.accountStat}>
                  <Text style={styles.accountStatValue}>{profile.user.followersCount}</Text>
                  <Text style={styles.accountStatLabel}>Abonnés</Text>
                </View>
                <View style={styles.accountStat}>
                  <Text style={styles.accountStatValue}>{profile.user.followingCount}</Text>
                  <Text style={styles.accountStatLabel}>Abonnements</Text>
                </View>
                <View style={styles.accountStat}>
                  <Text style={styles.accountStatValue}>{profile.user.videosCount}</Text>
                  <Text style={styles.accountStatLabel}>Vidéos</Text>
                </View>
              </View>
              <TouchableOpacity style={styles.actionBtn} onPress={() => nav.push('profile.edit')}>
                <Text style={styles.actionBtnText}>✏️ Modifier le profil</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.secondaryBtn} onPress={() => nav.push('profile')}>
                <Text style={styles.secondaryBtnText}>🙋 Voir mon profil public</Text>
              </TouchableOpacity>
            </View>

            {body ? <Text style={styles.body}>{body}</Text> : null}
          </>
        ) : content ? (
          <>
            <View style={styles.sectionCard}>
              <Text style={styles.sectionIcon}>{content.icon}</Text>
              {content.rows.map((row) => (
                <View key={row} style={styles.rowItem}>
                  <Text style={styles.rowBullet}>•</Text>
                  <Text style={styles.rowText}>{row}</Text>
                </View>
              ))}
            </View>
            {body ? <Text style={styles.body}>{body}</Text> : null}
          </>
        ) : (
          <>
            <Text style={styles.body}>
              {body ?? `La page « ${title} » affichera ici son contenu détaillé.`}
            </Text>
          </>
        )}
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
  headerTitle: { flex: 1, textAlign: 'center', color: tokens.colors.white, fontSize: tokens.typography.title.fontSize, fontWeight: '700' },
  profileLink: { color: tokens.colors.brand.primary, fontSize: tokens.typography.body.fontSize, fontWeight: '700' },
  content: { padding: tokens.spacing.lg, gap: tokens.spacing.lg },
  body: { color: tokens.colors.text.secondary, fontSize: tokens.typography.body.fontSize, lineHeight: 22 },
  accountCard: {
    backgroundColor: tokens.colors.elevated,
    borderRadius: tokens.radius.lg,
    padding: tokens.spacing.lg,
    alignItems: 'center',
    gap: tokens.spacing.sm,
  },
  avatar: { width: 88, height: 88, borderRadius: 44, backgroundColor: tokens.colors.surface },
  accountName: { color: tokens.colors.white, fontSize: tokens.typography.title.fontSize, fontWeight: '800' },
  accountUsername: { color: tokens.colors.text.secondary, fontSize: tokens.typography.body.fontSize },
  accountBio: { color: tokens.colors.text.secondary, fontSize: tokens.typography.body.fontSize, textAlign: 'center', lineHeight: 20 },
  accountStats: { flexDirection: 'row', gap: tokens.spacing.xl, marginTop: tokens.spacing.sm },
  accountStat: { alignItems: 'center' },
  accountStatValue: { color: tokens.colors.white, fontSize: tokens.typography.subhead.fontSize, fontWeight: '800' },
  accountStatLabel: { color: tokens.colors.text.secondary, fontSize: tokens.typography.caption.fontSize, marginTop: 2 },
  actionBtn: {
    marginTop: tokens.spacing.md,
    backgroundColor: tokens.colors.brand.primary,
    borderRadius: tokens.radius.sm,
    paddingVertical: tokens.spacing.md,
    alignItems: 'center',
    alignSelf: 'stretch',
  },
  actionBtnText: { color: tokens.colors.white, fontSize: tokens.typography.subhead.fontSize, fontWeight: '800' },
  secondaryBtn: {
    borderWidth: 1,
    borderColor: tokens.colors.surface,
    borderRadius: tokens.radius.sm,
    paddingVertical: tokens.spacing.md,
    alignItems: 'center',
    alignSelf: 'stretch',
  },
  secondaryBtnText: { color: tokens.colors.white, fontSize: tokens.typography.body.fontSize, fontWeight: '600' },
  sectionCard: {
    backgroundColor: tokens.colors.elevated,
    borderRadius: tokens.radius.md,
    padding: tokens.spacing.lg,
    gap: tokens.spacing.md,
  },
  sectionIcon: { fontSize: 28 },
  rowItem: { flexDirection: 'row', gap: tokens.spacing.sm },
  rowBullet: { color: tokens.colors.brand.primary, fontWeight: '800' },
  rowText: { flex: 1, color: tokens.colors.white, fontSize: tokens.typography.body.fontSize, lineHeight: 20 },
});
