import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Dimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { tokens } from '@/theme/tokens';
import { useNavigation } from '@/navigation/NavigationContext';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

const DURATIONS = ['15s', '60s', '3m', '10m'];
const SPEED_OPTIONS = ['0.3x', '0.5x', '1x', '2x', '3x'];

export const RecordScreen: React.FC = () => {
  const insets = useSafeAreaInsets();
  const nav = useNavigation();
  const [selectedDuration, setSelectedDuration] = useState('60s');
  const [isRecording, setIsRecording] = useState(false);
  const [isFrontCamera, setIsFrontCamera] = useState(true);

  return (
    <View style={[styles.container, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
      <View style={styles.cameraPreview}>
        <Text style={styles.cameraPlaceholder}>📷 Camera Preview</Text>
      </View>

      <View style={styles.topControls} pointerEvents="box-none">
        <TouchableOpacity style={styles.topButton} onPress={() => nav.back()}>
          <Text style={styles.topButtonText}>✕</Text>
        </TouchableOpacity>
        <View style={styles.topCenter} pointerEvents="box-none">
          <TouchableOpacity style={styles.soundPicker}>
            <Text style={styles.soundPickerText}>♪ Add sound</Text>
          </TouchableOpacity>
        </View>
        <View style={styles.topRight} />
      </View>

      <View style={styles.sideControls} pointerEvents="box-none">
        <TouchableOpacity style={styles.sideButton} onPress={() => setIsFrontCamera(!isFrontCamera)}>
          <Text style={styles.sideIcon}>🔄</Text>
          <Text style={styles.sideLabel}>Flip</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.sideButton}>
          <Text style={styles.sideIcon}>⚡</Text>
          <Text style={styles.sideLabel}>Flash</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.sideButton}>
          <Text style={styles.sideIcon}>⏱</Text>
          <Text style={styles.sideLabel}>Timer</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.sideButton}>
          <Text style={styles.sideIcon}>✨</Text>
          <Text style={styles.sideLabel}>Effects</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.sideButton}>
          <Text style={styles.sideIcon}>🎨</Text>
          <Text style={styles.sideLabel}>Filters</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.bottomControls} pointerEvents="box-none">
        <View style={styles.durationRow}>
          {DURATIONS.map((dur) => (
            <TouchableOpacity
              key={dur}
              style={[styles.durationChip, selectedDuration === dur && styles.durationChipActive]}
              onPress={() => setSelectedDuration(dur)}
            >
              <Text style={[styles.durationText, selectedDuration === dur && styles.durationTextActive]}>
                {dur}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <View style={styles.recordRow}>
          <TouchableOpacity style={styles.effectsButton}>
            <Text style={styles.effectsIcon}>✨</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.recordButton, isRecording && styles.recordButtonActive]}
            onPress={() => {
              if (isRecording) {
                setIsRecording(false);
                nav.push('create.publish');
              } else {
                setIsRecording(true);
              }
            }}
          >
            <View style={[styles.recordInner, isRecording && styles.recordInnerActive]} />
          </TouchableOpacity>

          <TouchableOpacity style={styles.uploadButton} onPress={() => nav.push('create.edit')}>
            <Text style={styles.uploadIcon}>📁</Text>
            <Text style={styles.uploadLabel}>Upload</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: tokens.colors.black,
  },
  cameraPreview: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: tokens.colors.elevated,
  },
  cameraPlaceholder: {
    color: tokens.colors.text.secondary,
    fontSize: tokens.typography.title.fontSize,
  },
  topControls: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: tokens.spacing.md,
    paddingTop: tokens.spacing.sm,
    zIndex: 10,
  },
  topButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  topButtonText: {
    color: tokens.colors.white,
    fontSize: 24,
  },
  topCenter: {
    flex: 1,
    alignItems: 'center',
  },
  soundPicker: {
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderRadius: tokens.radius.full,
    paddingHorizontal: tokens.spacing.md,
    paddingVertical: tokens.spacing.xs,
  },
  soundPickerText: {
    color: tokens.colors.white,
    fontSize: tokens.typography.body.fontSize,
    fontWeight: '500',
  },
  topRight: { width: 40 },
  sideControls: {
    position: 'absolute',
    right: tokens.spacing.md,
    top: '25%',
    gap: tokens.spacing.lg,
    alignItems: 'center',
    zIndex: 10,
  },
  sideButton: {
    alignItems: 'center',
    gap: 4,
  },
  sideIcon: {
    fontSize: 24,
  },
  sideLabel: {
    color: tokens.colors.white,
    fontSize: tokens.typography.caption.fontSize,
  },
  bottomControls: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingBottom: tokens.spacing.xl,
    zIndex: 10,
  },
  durationRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: tokens.spacing.md,
    marginBottom: tokens.spacing.lg,
  },
  durationChip: {
    paddingHorizontal: tokens.spacing.md,
    paddingVertical: tokens.spacing.xs,
    borderRadius: tokens.radius.full,
  },
  durationChipActive: {
    backgroundColor: 'rgba(255,255,255,0.2)',
  },
  durationText: {
    color: tokens.colors.text.secondary,
    fontSize: tokens.typography.body.fontSize,
    fontWeight: '500',
  },
  durationTextActive: {
    color: tokens.colors.white,
    fontWeight: '700',
  },
  recordRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: tokens.spacing.xxl,
  },
  effectsButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  effectsIcon: {
    fontSize: 24,
  },
  recordButton: {
    width: 80,
    height: 80,
    borderRadius: 40,
    borderWidth: 4,
    borderColor: tokens.colors.brand.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  recordButtonActive: {
    borderColor: tokens.colors.brand.primary,
  },
  recordInner: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: tokens.colors.brand.primary,
  },
  recordInnerActive: {
    width: 32,
    height: 32,
    borderRadius: tokens.radius.sm,
  },
  uploadButton: {
    alignItems: 'center',
    gap: 4,
  },
  uploadIcon: {
    fontSize: 24,
  },
  uploadLabel: {
    color: tokens.colors.white,
    fontSize: tokens.typography.caption.fontSize,
  },
});
