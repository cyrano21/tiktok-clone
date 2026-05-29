import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { tokens } from '@/theme/tokens';
import { useNavigation } from '@/navigation/NavigationContext';

export const VideoCallScreen: React.FC = () => {
  const insets = useSafeAreaInsets();
  const nav = useNavigation();
  const [isMuted, setIsMuted] = useState(false);
  const [isCameraOff, setIsCameraOff] = useState(false);
  const [isSpeakerOn, setIsSpeakerOn] = useState(true);
  const [callDuration, setCallDuration] = useState('02:34');

  return (
    <View style={[styles.container, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
      <View style={styles.remoteVideo}>
        <Text style={styles.remoteVideoPlaceholder}>📹 Remote Video</Text>
      </View>

      <View style={styles.localVideo}>
        {isCameraOff ? (
          <View style={styles.cameraOffPlaceholder}>
            <Text style={styles.cameraOffIcon}>📷</Text>
            <Text style={styles.cameraOffText}>Camera Off</Text>
          </View>
        ) : (
          <Text style={styles.localVideoPlaceholder}>You</Text>
        )}
      </View>

      <View style={styles.topBar}>
        <View style={styles.callInfo}>
          <Text style={styles.callerName}>@sarah_dance</Text>
          <Text style={styles.callDuration}>{callDuration}</Text>
        </View>
        <TouchableOpacity style={styles.minimizeButton} onPress={() => nav.back()}>
          <Text style={styles.minimizeIcon}>⊟</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.controls}>
        <TouchableOpacity
          style={[styles.controlButton, isMuted && styles.controlButtonActive]}
          onPress={() => setIsMuted(!isMuted)}
        >
          <Text style={styles.controlIcon}>{isMuted ? '🔇' : '🎙'}</Text>
          <Text style={styles.controlLabel}>{isMuted ? 'Unmute' : 'Mute'}</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.controlButton, isCameraOff && styles.controlButtonActive]}
          onPress={() => setIsCameraOff(!isCameraOff)}
        >
          <Text style={styles.controlIcon}>{isCameraOff ? '📷' : '📹'}</Text>
          <Text style={styles.controlLabel}>{isCameraOff ? 'Camera On' : 'Camera Off'}</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.controlButton}>
          <Text style={styles.controlIcon}>🔄</Text>
          <Text style={styles.controlLabel}>Flip</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.controlButton, isSpeakerOn && styles.controlButtonActive]}
          onPress={() => setIsSpeakerOn(!isSpeakerOn)}
        >
          <Text style={styles.controlIcon}>{isSpeakerOn ? '🔊' : '🔈'}</Text>
          <Text style={styles.controlLabel}>Speaker</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.endCallButton} onPress={() => nav.back()}>
          <Text style={styles.endCallIcon}>📞</Text>
          <Text style={styles.endCallLabel}>End</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: tokens.colors.black,
  },
  remoteVideo: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: tokens.colors.elevated,
  },
  remoteVideoPlaceholder: {
    color: tokens.colors.text.secondary,
    fontSize: tokens.typography.title.fontSize,
  },
  localVideo: {
    position: 'absolute',
    top: 100,
    right: tokens.spacing.md,
    width: 120,
    height: 160,
    borderRadius: tokens.radius.md,
    backgroundColor: tokens.colors.surface,
    overflow: 'hidden',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
  },
  localVideoPlaceholder: {
    color: tokens.colors.white,
    fontSize: tokens.typography.body.fontSize,
  },
  cameraOffPlaceholder: {
    alignItems: 'center',
    gap: tokens.spacing.xs,
  },
  cameraOffIcon: {
    fontSize: 24,
  },
  cameraOffText: {
    color: tokens.colors.text.secondary,
    fontSize: tokens.typography.caption.fontSize,
  },
  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: tokens.spacing.md,
    paddingTop: tokens.spacing.sm,
    zIndex: 10,
  },
  callInfo: {
    alignItems: 'flex-start',
  },
  callerName: {
    color: tokens.colors.white,
    fontSize: tokens.typography.title.fontSize,
    fontWeight: '700',
  },
  callDuration: {
    color: tokens.colors.text.secondary,
    fontSize: tokens.typography.body.fontSize,
    marginTop: 2,
  },
  minimizeButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.15)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  minimizeIcon: {
    color: tokens.colors.white,
    fontSize: 18,
  },
  controls: {
    position: 'absolute',
    bottom: tokens.spacing.xxl,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: tokens.spacing.lg,
    zIndex: 10,
  },
  controlButton: {
    alignItems: 'center',
    gap: tokens.spacing.xs,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: 'rgba(255,255,255,0.15)',
    justifyContent: 'center',
  },
  controlButtonActive: {
    backgroundColor: 'rgba(255,255,255,0.3)',
  },
  controlIcon: {
    fontSize: 22,
  },
  controlLabel: {
    color: tokens.colors.white,
    fontSize: 9,
    position: 'absolute',
    bottom: -16,
  },
  endCallButton: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: tokens.colors.semantic.error,
    justifyContent: 'center',
    alignItems: 'center',
  },
  endCallIcon: {
    fontSize: 22,
    transform: [{ rotate: '135deg' }],
  },
  endCallLabel: {
    color: tokens.colors.white,
    fontSize: 9,
    position: 'absolute',
    bottom: -16,
  },
});
