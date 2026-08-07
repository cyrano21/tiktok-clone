import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, TextInput } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { tokens } from '@/theme/tokens';
import { useNavigation } from '@/navigation/NavigationContext';

const DEFAULT_SCRAPER_URL = process.env.NEXT_PUBLIC_SCRAPER_URL || 'http://localhost:8501';

export const StudioScraperScreen: React.FC = () => {
  const insets = useSafeAreaInsets();
  const nav = useNavigation();
  const [scraperUrl, setScraperUrl] = useState(DEFAULT_SCRAPER_URL);
  const [isLoaded, setIsLoaded] = useState(false);

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => nav.back()} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <Text style={styles.backIcon}>←</Text>
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle}>🔍 Scraper Intelligence</Text>
          <Text style={styles.headerSubtitle}>Analytics TikTok en temps réel</Text>
        </View>
        <View style={{ width: 28 }} />
      </View>

      {/* URL bar */}
      <View style={styles.urlBar}>
        <Text style={styles.urlIcon}>🌐</Text>
        <TextInput
          style={styles.urlInput}
          value={scraperUrl}
          onChangeText={setScraperUrl}
          placeholder="URL du dashboard scraper..."
          placeholderTextColor={tokens.colors.text.tertiary}
          autoCapitalize="none"
          autoCorrect={false}
          selectTextOnFocus
        />
        <TouchableOpacity
          style={styles.urlButton}
          onPress={() => setIsLoaded(false)}
        >
          <Text style={styles.urlButtonText}>↻</Text>
        </TouchableOpacity>
      </View>

      {/* Info banner */}
      <View style={styles.banner}>
        <Text style={styles.bannerText}>
          💡 Le dashboard Scraper (Streamlit) doit être lancé séparément. Lancez{' '}
          <Text style={styles.bannerCode}>streamlit run dashboard.py</Text>{' '}
          dans le dossier tiktok_scraper pour activer l'analyse.
        </Text>
      </View>

      {/* Iframe container */}
      <View style={styles.iframeContainer}>
        {!isLoaded && (
          <View style={styles.loadingOverlay}>
            <Text style={styles.loadingIcon}>📊</Text>
            <Text style={styles.loadingText}>Chargement du dashboard...</Text>
            <TouchableOpacity
              style={styles.loadButton}
              onPress={() => setIsLoaded(true)}
            >
              <Text style={styles.loadButtonText}>Charger le dashboard</Text>
            </TouchableOpacity>
          </View>
        )}
        {isLoaded && (
          <iframe
            src={scraperUrl}
            style={{
              width: '100%',
              height: '100%',
              border: 'none',
              borderRadius: 12,
            }}
            title="TikTok Scraper Dashboard"
            onLoad={() => setIsLoaded(true)}
            sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
          />
        )}
      </View>
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
  headerCenter: { flex: 1, alignItems: 'center' },
  headerTitle: { color: tokens.colors.white, fontSize: tokens.typography.title.fontSize, fontWeight: '700' },
  headerSubtitle: { color: tokens.colors.text.secondary, fontSize: tokens.typography.caption.fontSize, marginTop: 2 },
  urlBar: {
    flexDirection: 'row',
    alignItems: 'center',
    margin: tokens.spacing.md,
    backgroundColor: tokens.colors.elevated,
    borderRadius: tokens.radius.md,
    paddingHorizontal: tokens.spacing.sm,
    gap: 8,
  },
  urlIcon: { fontSize: 14 },
  urlInput: {
    flex: 1,
    color: tokens.colors.white,
    fontSize: tokens.typography.caption.fontSize,
    paddingVertical: 10,
  },
  urlButton: {
    backgroundColor: tokens.colors.brand.primary,
    borderRadius: tokens.radius.sm,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  urlButtonText: { color: tokens.colors.white, fontSize: 14, fontWeight: '700' },
  banner: {
    marginHorizontal: tokens.spacing.md,
    marginBottom: tokens.spacing.sm,
    backgroundColor: tokens.colors.brand.primary + '15',
    borderRadius: tokens.radius.md,
    padding: tokens.spacing.sm,
  },
  bannerText: { color: tokens.colors.text.secondary, fontSize: tokens.typography.caption.fontSize, lineHeight: 18 },
  bannerCode: { color: tokens.colors.brand.primary, fontFamily: 'monospace', fontWeight: '700' },
  iframeContainer: {
    flex: 1,
    marginHorizontal: tokens.spacing.md,
    marginBottom: tokens.spacing.md,
    borderRadius: tokens.radius.md,
    overflow: 'hidden',
    backgroundColor: tokens.colors.elevated,
  },
  loadingOverlay: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  loadingIcon: { fontSize: 48 },
  loadingText: { color: tokens.colors.text.secondary, fontSize: tokens.typography.body.fontSize },
  loadButton: {
    backgroundColor: tokens.colors.brand.primary,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: tokens.radius.md,
    marginTop: 8,
  },
  loadButtonText: { color: tokens.colors.white, fontSize: tokens.typography.body.fontSize, fontWeight: '700' },
});
