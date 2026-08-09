import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Switch } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { tokens } from '@/theme/tokens';
import { useNavigation } from '@/navigation/NavigationContext';
import { authService } from '@/services/authService';
import { useBrandingStore } from '@/store/brandingStore';
import { useSettingsStore, LANGUAGE_OPTIONS } from '@/store/settingsStore';

type Kind = 'nav' | 'toggle' | 'cycle' | 'action';

interface SettingItem {
  id: string;
  icon: string;
  label: string;
  kind: Kind;
  // nav
  body?: string;
  // cycle
  options?: string[];
}

interface SettingSection {
  title: string;
  items: SettingItem[];
}

const SETTINGS_SECTIONS: SettingSection[] = [
  {
    title: 'Account',
    items: [
      { id: 'view_profile', icon: '🙋', label: 'Voir mon profil', kind: 'nav' },
      { id: 'manage', icon: '👤', label: 'Manage account', kind: 'nav', body: 'Gérez vos informations de compte, e-mail, numéro de téléphone et mot de passe.' },
      { id: 'privacy', icon: '🔒', label: 'Privacy', kind: 'nav', body: 'Contrôlez qui peut voir vos vidéos, vous suivre, commenter et vous envoyer des messages.' },
      { id: 'security', icon: '🛡', label: 'Security', kind: 'nav', body: 'Activez la double authentification et consultez les appareils connectés.' },
      { id: 'balance', icon: '💰', label: 'Balance', kind: 'nav', body: 'Solde actuel : 0,00 €. Rechargez des pièces pour soutenir vos créateurs préférés.' },
    ],
  },
  {
    title: 'Content & Activity',
    items: [
      { id: 'notifications', icon: '🔔', label: 'Push notifications', kind: 'toggle' },
      { id: 'language', icon: '🌐', label: 'Language', kind: 'cycle', options: ['Français', 'English', 'Español', 'Deutsch'] },
      { id: 'darkmode', icon: '🌙', label: 'Dark mode', kind: 'toggle' },
      { id: 'downloads', icon: '📥', label: 'Downloads', kind: 'nav', body: 'Gérez vos vidéos téléchargées et la qualité de téléchargement.' },
    ],
  },
  {
    title: 'Cache & Cellular',
    items: [
      { id: 'cache', icon: '🗑', label: 'Clear cache', kind: 'action' },
      { id: 'datasaver', icon: '📶', label: 'Data saver', kind: 'toggle' },
    ],
  },
  {
    title: 'Tenant / White-label',
    items: [
      { id: 'branding', icon: '🎨', label: 'Branding & white-label', kind: 'nav', body: 'Nom, logo et couleurs de la plateforme. Revendez-la en marque blanche à des écoles, entreprises ou communautés.' },
    ],
  },
  {
    title: 'Support',
    items: [
      { id: 'report', icon: '⚠️', label: 'Report a problem', kind: 'nav', body: 'Signalez un bug ou un comportement inapproprié. Notre équipe examinera votre rapport.' },
      { id: 'help', icon: '❓', label: 'Help center', kind: 'nav', body: 'Trouvez des réponses aux questions fréquentes et contactez le support.' },
      { id: 'community', icon: '📋', label: 'Community guidelines', kind: 'nav', body: 'Nos règles communautaires garantissent un espace sûr et respectueux pour tous.' },
      { id: 'terms', icon: '📄', label: 'Terms of service', kind: 'nav', body: "Conditions d'utilisation du service. Dernière mise à jour : 2026." },
      { id: 'privacy_policy', icon: '🔐', label: 'Privacy policy', kind: 'nav', body: 'Découvrez comment nous protégeons et utilisons vos données personnelles.' },
    ],
  },
];

export const SettingsScreen: React.FC = () => {
  const insets = useSafeAreaInsets();
  const nav = useNavigation();

  const notifications = useSettingsStore((s) => s.notifications);
  const darkMode = useSettingsStore((s) => s.darkMode);
  const dataSaver = useSettingsStore((s) => s.dataSaver);
  const language = useSettingsStore((s) => s.language);
  const cacheClearedAt = useSettingsStore((s) => s.cacheClearedAt);
  const toggleSetting = useSettingsStore((s) => s.toggle);
  const cycleLanguage = useSettingsStore((s) => s.cycleLanguage);
  const clearCache = useSettingsStore((s) => s.clearCache);
  const branding = useBrandingStore((s) => s.branding);

  const languageOptions = LANGUAGE_OPTIONS;
  const langLabel = languageOptions.find((o) => o.code === language)?.label ?? 'English';
  const [cacheFlash, setCacheFlash] = useState(false);

  const handleItem = (item: SettingItem) => {
    switch (item.kind) {
      case 'nav':
        if (item.id === 'view_profile') {
          nav.push('profile');
          break;
        }
        if (item.id === 'branding') {
          nav.push('studio.branding');
          break;
        }
        nav.push('profile.settings.detail', { title: item.label, body: item.body, id: item.id });
        break;
      case 'cycle':
        if (item.id === 'language') cycleLanguage();
        break;
      case 'action':
        if (item.id === 'cache') {
          clearCache();
          setCacheFlash(true);
          setTimeout(() => setCacheFlash(false), 1800);
        }
        break;
      default:
        break;
    }
  };

  const renderRight = (item: SettingItem) => {
    if (item.id === 'branding') {
      return (
        <View style={styles.settingRight}>
          <Text style={[styles.settingValue, { color: branding.primaryColor, fontWeight: '700' }]}>{branding.name}</Text>
          <Text style={styles.settingArrow}>›</Text>
        </View>
      );
    }
    if (item.kind === 'toggle') {
      const value =
        item.id === 'notifications' ? notifications
        : item.id === 'darkmode' ? darkMode
        : item.id === 'datasaver' ? dataSaver
        : false;
      return (
        <Switch
          value={value}
          onValueChange={() =>
            toggleSetting(item.id === 'notifications' ? 'notifications' : item.id === 'darkmode' ? 'darkMode' : 'dataSaver')
          }
          trackColor={{ false: tokens.colors.surface, true: tokens.colors.brand.primary }}
          thumbColor={tokens.colors.white}
        />
      );
    }
    if (item.kind === 'cycle' && item.id === 'language') {
      return (
        <View style={styles.settingRight}>
          <Text style={styles.settingValue}>{langLabel}</Text>
          <Text style={styles.settingArrow}>›</Text>
        </View>
      );
    }
    if (item.kind === 'action' && item.id === 'cache') {
      return (
        <Text style={[styles.settingValue, (cacheFlash || cacheClearedAt != null) && styles.cacheDone]}>
          {cacheFlash ? '✓ Vidé' : cacheClearedAt != null ? '✓ Vidé le ' + new Date(cacheClearedAt).toLocaleDateString('fr-FR') : 'Vider le cache'}
        </Text>
      );
    }
    if (item.id === 'balance') {
      return (
        <View style={styles.settingRight}>
          <Text style={styles.settingValue}>0,00 €</Text>
          <Text style={styles.settingArrow}>›</Text>
        </View>
      );
    }
    return <Text style={styles.settingArrow}>›</Text>;
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => nav.back()} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <Text style={styles.backIcon}>←</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Settings and privacy</Text>
        <View style={styles.placeholder} />
      </View>

      <ScrollView showsVerticalScrollIndicator={false}>
        {SETTINGS_SECTIONS.map((section) => (
          <View key={section.title} style={styles.section}>
            <Text style={styles.sectionTitle}>{section.title}</Text>
            {section.items.map((item) => {
              const isToggle = item.kind === 'toggle';
              const Row: React.ComponentType<any> = isToggle ? View : TouchableOpacity;
              return (
                <Row
                  key={item.id}
                  style={styles.settingItem}
                  {...(!isToggle ? { onPress: () => handleItem(item), activeOpacity: 0.6 } : {})}
                >
                  <Text style={styles.settingIcon}>{item.icon}</Text>
                  <Text style={styles.settingLabel}>{item.label}</Text>
                  {renderRight(item)}
                </Row>
              );
            })}
          </View>
        ))}

        <TouchableOpacity
          style={styles.logoutButton}
          onPress={async () => {
            await authService.logout();
            nav.reset('auth.login');
          }}
        >
          <Text style={styles.logoutText}>Log out</Text>
        </TouchableOpacity>

        <Text style={styles.version}>v1.0.0</Text>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: tokens.colors.bg,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: tokens.spacing.md,
    paddingVertical: tokens.spacing.sm,
    borderBottomWidth: 0.5,
    borderBottomColor: tokens.colors.surface,
  },
  backIcon: { color: tokens.colors.white, fontSize: 24, width: 28 },
  headerTitle: { color: tokens.colors.white, fontSize: tokens.typography.title.fontSize, fontWeight: '700' },
  placeholder: { width: 28 },
  section: {
    paddingTop: tokens.spacing.lg,
  },
  sectionTitle: {
    color: tokens.colors.text.secondary,
    fontSize: tokens.typography.caption.fontSize,
    fontWeight: '600',
    textTransform: 'uppercase',
    paddingHorizontal: tokens.spacing.md,
    marginBottom: tokens.spacing.sm,
  },
  settingItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: tokens.spacing.md,
    paddingVertical: tokens.spacing.md,
    minHeight: 52,
  },
  settingIcon: {
    fontSize: 20,
    width: 32,
  },
  settingLabel: {
    flex: 1,
    color: tokens.colors.white,
    fontSize: tokens.typography.body.fontSize,
  },
  settingRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.spacing.xs,
  },
  settingValue: {
    color: tokens.colors.text.secondary,
    fontSize: tokens.typography.body.fontSize,
  },
  cacheDone: {
    color: tokens.colors.semantic.success,
    fontWeight: '700',
  },
  settingArrow: {
    color: tokens.colors.text.tertiary,
    fontSize: 20,
  },
  logoutButton: {
    marginTop: tokens.spacing.xl,
    marginHorizontal: tokens.spacing.md,
    paddingVertical: tokens.spacing.md,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: tokens.colors.surface,
    borderRadius: tokens.radius.sm,
  },
  logoutText: {
    color: tokens.colors.brand.primary,
    fontSize: tokens.typography.body.fontSize,
    fontWeight: '600',
  },
  version: {
    color: tokens.colors.text.tertiary,
    fontSize: tokens.typography.caption.fontSize,
    textAlign: 'center',
    marginTop: tokens.spacing.md,
    marginBottom: tokens.spacing.xxl,
  },
});
