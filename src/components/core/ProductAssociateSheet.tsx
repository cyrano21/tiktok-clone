import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, TextInput, ScrollView, Image, Dimensions, ActivityIndicator } from 'react-native';
import { BottomSheet } from '@/components/shared/BottomSheet';
import { tokens } from '@/theme/tokens';
import { Video, VideoProductMatch } from '@/types';
import { productMatchService, VideoProductMatchCandidate } from '@/services/productMatchService';
import { scraperBridge } from '@/services/scraperBridge';
import { useFeedStore } from '@/store/feedStore';
import { formatPrice } from '@/services/demoShop';

interface ProductAssociateSheetProps {
  isVisible: boolean;
  onClose: () => void;
  video: Video;
}

const SEARCH_DEBOUNCE_MS = 350;

export const ProductAssociateSheet: React.FC<ProductAssociateSheetProps> = ({ isVisible, onClose, video }) => {
  const setProductMatches = useFeedStore((state) => state.setProductMatches);
  const [query, setQuery] = useState('');
  const [candidates, setCandidates] = useState<VideoProductMatchCandidate[]>([]);
  const [busy, setBusy] = useState(false);
  const [approvingId, setApprovingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const initialQuery = useMemo(
    () => (video.description || '').replace(/#\S+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 120),
    [video.description],
  );

  useEffect(() => {
    if (isVisible) {
      setQuery(initialQuery);
      setCandidates([]);
      setError(null);
      setMessage(null);
      setBusy(false);
    }
  }, [isVisible, initialQuery]);

  const runSearch = useCallback(async (text: string) => {
    const trimmed = text.trim();
    if (trimmed.length < 2) {
      setCandidates([]);
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const hashtags = (video.hashtags || []).map((tag) => tag.name);
      const results = await productMatchService.candidates({ title: trimmed, hashtags, limit: 8 });
      setCandidates(results);
      if (results.length === 0) setError('Aucun produit correspondant dans le catalogue Orchidy.');
    } catch {
      setCandidates([]);
      setError('Recherche indisponible. Le catalogue Orchidy est-il joignable ?');
    } finally {
      setBusy(false);
    }
  }, [video.hashtags]);

  const handleQueryChange = useCallback((text: string) => {
    setQuery(text);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => void runSearch(text), SEARCH_DEBOUNCE_MS);
  }, [runSearch]);

  useEffect(() => () => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
  }, []);

  const approve = useCallback(async (candidate: VideoProductMatchCandidate) => {
    setApprovingId(candidate.orchidyCatalogItemId);
    setMessage(null);
    const ok = await scraperBridge.approveProductMatch(video.id, {
      orchidyCatalogItemId: candidate.orchidyCatalogItemId,
      confidence: candidate.score,
    });
    setApprovingId(null);
    if (!ok) {
      setError('Connexion requise ou service indisponible : approbation non enregistrée.');
      return;
    }
    const match: VideoProductMatch = {
      id: `scraper-match-${video.id}-${Date.now()}`,
      orchidyCatalogItemId: candidate.orchidyCatalogItemId,
      variantKey: '',
      confidence: candidate.score,
      source: 'manual',
      status: 'approved',
    };
    const existing = video.productMatches ?? [];
    setProductMatches(video.id, [match, ...existing.filter((m) => m.orchidyCatalogItemId !== match.orchidyCatalogItemId)]);
    setMessage('Produit associé à la vidéo.');
    setTimeout(onClose, 700);
  }, [video, setProductMatches, onClose]);

  const sheetHeight = Math.min(640, Math.max(440, Dimensions.get('window').height * 0.78));

  return (
    <BottomSheet isVisible={isVisible} onClose={onClose} height={sheetHeight}>
      <View style={styles.container}>
        <View style={styles.headerRow}>
          <View style={styles.headerText}>
            <Text style={styles.title}>Associer un produit</Text>
            <Text style={styles.subtitle}>Vidéo de @{video.user.username} · vérifié au checkout Orchidy</Text>
          </View>
          <TouchableOpacity onPress={onClose} style={styles.closeButton}>
            <Text style={styles.closeText}>×</Text>
          </TouchableOpacity>
        </View>

        <TextInput
          style={styles.searchInput}
          value={query}
          onChangeText={handleQueryChange}
          placeholder="Rechercher dans le catalogue Orchidy…"
          placeholderTextColor={tokens.colors.text.tertiary}
          autoCapitalize="none"
          maxLength={200}
        />

        {message ? <Text style={styles.successMessage}>{message}</Text> : null}
        {error && candidates.length === 0 ? <Text style={styles.errorMessage}>{error}</Text> : null}

        {busy ? (
          <View style={styles.centerState}>
            <ActivityIndicator color={tokens.colors.brand.primary} />
            <Text style={styles.centerText}>Recherche du catalogue…</Text>
          </View>
        ) : null}

        <ScrollView style={styles.results} keyboardShouldPersistTaps="handled">
          {candidates.map((candidate) => {
            const approved = (video.productMatches ?? []).some(
              (m) => m.orchidyCatalogItemId === candidate.orchidyCatalogItemId && m.status !== 'suggested',
            );
            return (
              <View key={candidate.orchidyCatalogItemId} style={styles.resultRow}>
                <Image source={{ uri: candidate.images[0] || '/logo_orky.png' }} style={styles.resultThumb} />
                <View style={styles.resultInfo}>
                  <Text style={styles.resultTitle} numberOfLines={2}>{candidate.title}</Text>
                  <Text style={styles.resultMeta}>
                    {candidate.price !== undefined ? formatPrice(candidate.price, candidate.currency) : ''}
                    {candidate.score > 0 ? ` · correspondance ${Math.round(candidate.score * 100)}%` : ''}
                  </Text>
                </View>
                <TouchableOpacity
                  style={[styles.approveButton, approved && styles.approveButtonDone]}
                  onPress={() => void approve(candidate)}
                  disabled={approvingId !== null || approved}
                >
                  <Text style={styles.approveText}>
                    {approvingId === candidate.orchidyCatalogItemId ? '…' : approved ? '✓' : 'Associer'}
                  </Text>
                </TouchableOpacity>
              </View>
            );
          })}
        </ScrollView>

        {candidates.length > 0 ? (
          <Text style={styles.footnote}>L'approbation rendra le produit achetable sur cette vidéo externe.</Text>
        ) : null}
      </View>
    </BottomSheet>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, paddingHorizontal: tokens.spacing.md },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: tokens.spacing.md, gap: tokens.spacing.sm },
  headerText: { flex: 1, minWidth: 0 },
  title: { color: tokens.colors.white, fontSize: tokens.typography.title.fontSize, fontWeight: '800' },
  subtitle: { color: tokens.colors.text.secondary, marginTop: 3 },
  closeButton: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  closeText: { color: tokens.colors.white, fontSize: 30, lineHeight: 32 },
  searchInput: { borderRadius: tokens.radius.md, backgroundColor: tokens.colors.surface, color: tokens.colors.white, paddingHorizontal: tokens.spacing.md, paddingVertical: 12, fontSize: tokens.typography.body.fontSize },
  successMessage: { color: '#4ade80', marginTop: tokens.spacing.sm, fontWeight: '700' },
  errorMessage: { color: tokens.colors.text.secondary, marginTop: tokens.spacing.sm },
  centerState: { alignItems: 'center', paddingVertical: tokens.spacing.xl, gap: tokens.spacing.sm },
  centerText: { color: tokens.colors.text.secondary },
  results: { flex: 1, marginTop: tokens.spacing.md },
  resultRow: { flexDirection: 'row', alignItems: 'center', gap: tokens.spacing.sm, paddingVertical: tokens.spacing.sm, borderBottomWidth: 1, borderBottomColor: tokens.colors.surface },
  resultThumb: { width: 52, height: 52, borderRadius: tokens.radius.xs, backgroundColor: tokens.colors.surface },
  resultInfo: { flex: 1, minWidth: 0 },
  resultTitle: { color: tokens.colors.white, fontSize: tokens.typography.caption.fontSize, fontWeight: '600' },
  resultMeta: { color: tokens.colors.text.secondary, fontSize: tokens.typography.caption.fontSize, marginTop: 2 },
  approveButton: { backgroundColor: tokens.colors.brand.primary, borderRadius: tokens.radius.xs, paddingHorizontal: tokens.spacing.sm, paddingVertical: 8, minWidth: 72, alignItems: 'center' },
  approveButtonDone: { backgroundColor: tokens.colors.surface },
  approveText: { color: tokens.colors.white, fontSize: tokens.typography.caption.fontSize, fontWeight: '800' },
  footnote: { color: tokens.colors.text.tertiary, fontSize: 10, textAlign: 'center', paddingVertical: tokens.spacing.sm },
});
