import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { tokens } from '@/theme/tokens';
import { useNavigation } from '@/navigation/NavigationContext';

const EFFECTS = ['None', 'Beauty', 'Smooth', 'Warm', 'Cool', 'Vintage', 'Dramatic'];
const FILTERS = ['Normal', 'Vivid', 'B&W', 'Sepia', 'Neon', 'Sunset'];

export const LiveBroadcastScreen: React.FC = () => {
  const insets = useSafeAreaInsets();
  const nav = useNavigation();
  const [isLive, setIsLive] = useState(false);
  const [selectedEffect, setSelectedEffect] = useState('None');
  const [selectedFilter, setSelectedFilter] = useState('Normal');
  const [viewerCount, setViewerCount] = useState(0);
  const [isFrontCamera, setIsFrontCamera] = useState(true);
  const [isMuted, setIsMuted] = useState(false);

  return (
    <View style={[styles.container, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
      <View style={styles.cameraPreview}>
        <Text style={styles.previewPlaceholder}>📷 Camera Preview</Text>
      </View>

      <View style={styles.topControls}>
        <TouchableOpacity style={styles.closeButton} onPress={() => nav.back()}>
          <Text style={styles.closeIcon}>✕</Text>
        </TouchableOpacity>
        {isLive && (
          <View style={styles.liveIndicator}>
            <View style={styles.liveDot} />
            <Text style={styles.liveText}>LIVE</Text>
            <Text style={styles.viewerText}>{viewerCount} viewers</Text>
          </View>
        )}
        <TouchableOpacity style={styles.flipButton} onPress={() => setIsFrontCamera((value) => !value)}>
          <Text style={styles.flipIcon}>🔄</Text>
        </TouchableOpacity>
      </View>

      {!isLive && (
        <View style={styles.setupPanel}>
          <Text style={styles.setupTitle}>Go Live</Text>

          <View style={styles.effectsSection}>
            <Text style={styles.sectionLabel}>Effects</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <View style={styles.effectsRow}>
                {EFFECTS.map((effect) => (
                  <TouchableOpacity
                    key={effect}
                    style={[styles.effectChip, selectedEffect === effect && styles.effectChipActive]}
                    onPress={() => setSelectedEffect(effect)}
                  >
                    <Text style={[styles.effectText, selectedEffect === effect && styles.effectTextActive]}>
                      {effect}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </ScrollView>
          </View>

          <View style={styles.filtersSection}>
            <Text style={styles.sectionLabel}>Filters</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <View style={styles.filtersRow}>
                {FILTERS.map((filter) => (
                  <TouchableOpacity
                    key={filter}
                    style={[styles.filterChip, selectedFilter === filter && styles.filterChipActive]}
                    onPress={() => setSelectedFilter(filter)}
                  >
                    <Text style={[styles.filterText, selectedFilter === filter && styles.filterTextActive]}>
                      {filter}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </ScrollView>
          </View>

          <TouchableOpacity style={styles.goLiveButton} onPress={() => setIsLive(true)}>
            <Text style={styles.goLiveText}>Go LIVE</Text>
          </TouchableOpacity>
        </View>
      )}

      {isLive && (
        <View style={styles.liveControls}>
          <TouchableOpacity style={styles.controlButton} onPress={() => setSelectedEffect((value) => value === 'None' ? 'Beauty' : 'None')}>
            <Text style={styles.controlIcon}>✨</Text>
            <Text style={styles.controlLabel}>Effects</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.controlButton} onPress={() => setSelectedFilter((value) => value === 'Normal' ? 'Vivid' : 'Normal')}>
            <Text style={styles.controlIcon}>🎨</Text>
            <Text style={styles.controlLabel}>Filters</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.controlButton} onPress={() => setIsMuted((value) => !value)}>
            <Text style={styles.controlIcon}>{isMuted ? '🔇' : '🎙'}</Text>
            <Text style={styles.controlLabel}>Mute</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.endButton}
            onPress={() => { setIsLive(false); nav.back(); }}
          >
            <Text style={styles.endButtonText}>End</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: tokens.colors.black },
  cameraPreview: { ...StyleSheet.absoluteFillObject, justifyContent: 'center', alignItems: 'center', backgroundColor: tokens.colors.elevated },
  previewPlaceholder: { color: tokens.colors.text.secondary, fontSize: tokens.typography.title.fontSize },
  topControls: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: tokens.spacing.md, zIndex: 10 },
  closeButton: { width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center' },
  closeIcon: { color: tokens.colors.white, fontSize: 18 },
  liveIndicator: { flexDirection: 'row', alignItems: 'center', gap: tokens.spacing.xs, backgroundColor: 'rgba(0,0,0,0.5)', borderRadius: tokens.radius.full, paddingHorizontal: tokens.spacing.md, paddingVertical: tokens.spacing.xs },
  liveDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: tokens.colors.semantic.live },
  liveText: { color: tokens.colors.semantic.live, fontSize: tokens.typography.caption.fontSize, fontWeight: '700' },
  viewerText: { color: tokens.colors.white, fontSize: tokens.typography.caption.fontSize, marginLeft: tokens.spacing.xs },
  flipButton: { width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center' },
  flipIcon: { fontSize: 18 },
  setupPanel: { position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: 'rgba(0,0,0,0.85)', borderTopLeftRadius: tokens.radius.lg, borderTopRightRadius: tokens.radius.lg, padding: tokens.spacing.lg, zIndex: 10 },
  setupTitle: { color: tokens.colors.white, fontSize: tokens.typography.headline.fontSize, fontWeight: '700', textAlign: 'center', marginBottom: tokens.spacing.lg },
  effectsSection: { marginBottom: tokens.spacing.lg },
  sectionLabel: { color: tokens.colors.text.secondary, fontSize: tokens.typography.body.fontSize, fontWeight: '500', marginBottom: tokens.spacing.sm },
  effectsRow: { flexDirection: 'row', gap: tokens.spacing.sm },
  effectChip: { paddingHorizontal: tokens.spacing.md, paddingVertical: tokens.spacing.sm, borderRadius: tokens.radius.full, backgroundColor: tokens.colors.elevated },
  effectChipActive: { backgroundColor: tokens.colors.brand.primary },
  effectText: { color: tokens.colors.text.secondary, fontSize: tokens.typography.body.fontSize },
  effectTextActive: { color: tokens.colors.white, fontWeight: '600' },
  filtersSection: { marginBottom: tokens.spacing.xl },
  filtersRow: { flexDirection: 'row', gap: tokens.spacing.sm },
  filterChip: { paddingHorizontal: tokens.spacing.md, paddingVertical: tokens.spacing.sm, borderRadius: tokens.radius.full, backgroundColor: tokens.colors.elevated },
  filterChipActive: { backgroundColor: tokens.colors.brand.secondary },
  filterText: { color: tokens.colors.text.secondary, fontSize: tokens.typography.body.fontSize },
  filterTextActive: { color: tokens.colors.black, fontWeight: '600' },
  goLiveButton: { backgroundColor: tokens.colors.semantic.live, borderRadius: tokens.radius.full, paddingVertical: tokens.spacing.md, alignItems: 'center' },
  goLiveText: { color: tokens.colors.white, fontSize: tokens.typography.subhead.fontSize, fontWeight: '700' },
  liveControls: { position: 'absolute', bottom: tokens.spacing.xl, left: 0, right: 0, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: tokens.spacing.lg, zIndex: 10 },
  controlButton: { alignItems: 'center', gap: 4 },
  controlIcon: { fontSize: 24 },
  controlLabel: { color: tokens.colors.white, fontSize: tokens.typography.caption.fontSize },
  endButton: { backgroundColor: tokens.colors.semantic.live, borderRadius: tokens.radius.full, paddingHorizontal: tokens.spacing.xl, paddingVertical: tokens.spacing.sm },
  endButtonText: { color: tokens.colors.white, fontSize: tokens.typography.body.fontSize, fontWeight: '700' },
});
