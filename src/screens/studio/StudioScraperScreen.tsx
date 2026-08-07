import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, TextInput } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { tokens } from '@/theme/tokens';
import { useNavigation } from '@/navigation/NavigationContext';

const DEFAULT_SCRAPER_URL = process.env.NEXT_PUBLIC_SCRAPER_URL || '';

/** Detect whether we're running on localhost — allow HTTP for dev. */
const isLocalDev =
  typeof window !== 'undefined' &&
  (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1');

const AUTO_DETECT_URL = isLocalDev ? 'http://127.0.0.1:8501/' : '';

export const StudioScraperScreen: React.FC = () => {
  const insets = useSafeAreaInsets();
  const nav = useNavigation();
  const [scraperUrl, setScraperUrl] = useState(DEFAULT_SCRAPER_URL);
  const [isLoaded, setIsLoaded] = useState(false);
  const configuredOrigin = (() => {
    try { return DEFAULT_SCRAPER_URL ? new URL(DEFAULT_SCRAPER_URL).origin : ''; } catch { return ''; }
  })();
  /** Allow HTTP for local dev, enforce HTTPS for production. */
  const canLoad = (() => {
    try {
      const url = new URL(scraperUrl);
      if (isLocalDev && (url.hostname === 'localhost' || url.hostname === '127.0.0.1')) return true;
      return url.protocol === 'https:' && !!configuredOrigin && url.origin === configuredOrigin;
    } catch { return false; }
  })();

  // Auto-load when a valid URL is detected (Streamlit on 8501, or configured URL).
  const effectiveUrl = scraperUrl || AUTO_DETECT_URL;
  const canAutoLoad = (() => {
    try {
      const url = new URL(effectiveUrl);
      if (isLocalDev && (url.hostname === 'localhost' || url.hostname === '127.0.0.1')) return true;
      return url.protocol === 'https:' && !!configuredOrigin && url.origin === configuredOrigin;
    } catch { return false; }
  })();

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
          onPress={() => { if (canLoad) setIsLoaded(false); }}
        >
          <Text style={styles.urlButtonText}>↻</Text>
        </TouchableOpacity>
      </View>

      {/* Info banner */}
      <View style={styles.banner}>
        <Text style={styles.bannerText}>
          {configuredOrigin ? 'Le dashboard Scraper sécurisé est disponible sur l’origine configurée.' : 'Le dashboard Scraper n’est pas configuré pour cet environnement.'}
        </Text>
      </View>

      {/* Iframe container */}
      <View style={styles.iframeContainer}>
        {!isLoaded && (
          <View style={styles.loadingOverlay}>
            <Text style={styles.loadingIcon}>📊</Text>
            <Text style={styles.loadingText}>Dashboard Scraper TikTok</Text>
            <Text style={styles.bannerText}>
              {canAutoLoad
                ? 'Streamlit détecté sur le port 8501. Prêt à charger.'
                : configuredOrigin
                  ? 'Dashboard configuré, prêt à charger.'
                  : 'Lancez Streamlit (streamlit run dashboard.py) sur le port 8501, ou configurez NEXT_PUBLIC_SCRAPER_URL.'}
            </Text>
            {canAutoLoad ? (
              <TouchableOpacity style={styles.loadButton} onPress={() => { setScraperUrl(effectiveUrl); setIsLoaded(true); }}>
                <Text style={styles.loadButtonText}>🚀 Charger le dashboard</Text>
              </TouchableOpacity>
            ) : canLoad ? (
              <TouchableOpacity style={styles.loadButton} onPress={() => setIsLoaded(true)}>
                <Text style={styles.loadButtonText}>Charger le dashboard</Text>
              </TouchableOpacity>
            ) : null}
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
            sandbox="allow-scripts allow-forms allow-same-origin"
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
