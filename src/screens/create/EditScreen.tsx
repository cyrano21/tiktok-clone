import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Dimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { tokens } from '@/theme/tokens';
import { useNavigation } from '@/navigation/NavigationContext';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

interface EditTool {
  id: string;
  icon: string;
  label: string;
}

const EDIT_TOOLS: EditTool[] = [
  { id: 'trim', icon: '✂️', label: 'Trim' },
  { id: 'speed', icon: '⏩', label: 'Speed' },
  { id: 'text', icon: '𝐓', label: 'Text' },
  { id: 'stickers', icon: '😀', label: 'Stickers' },
  { id: 'effects', icon: '✨', label: 'Effects' },
  { id: 'filters', icon: '🎨', label: 'Filters' },
  { id: 'voiceover', icon: '🎙', label: 'Voiceover' },
  { id: 'volume', icon: '🔊', label: 'Volume' },
];

export const EditScreen: React.FC = () => {
  const insets = useSafeAreaInsets();
  const nav = useNavigation();
  const [activeTool, setActiveTool] = useState<string | null>(null);

  return (
    <View style={[styles.container, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => nav.back()}>
          <Text style={styles.headerButton}>Cancel</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Edit</Text>
        <TouchableOpacity onPress={() => nav.push('create.publish')}>
          <Text style={styles.headerButton}>Done</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.previewContainer}>
        <View style={styles.videoPreview}>
          <Text style={styles.previewPlaceholder}>🎬 Video Preview</Text>
        </View>
      </View>

      <View style={styles.timeline}>
        <View style={styles.timelineTrack}>
          <View style={styles.timelineThumb} />
          {Array.from({ length: 10 }).map((_, i) => (
            <View key={i} style={styles.timelineFrame} />
          ))}
        </View>
        <View style={styles.timelineInfo}>
          <Text style={styles.timelineTime}>0:00</Text>
          <Text style={styles.timelineTime}>0:30</Text>
        </View>
      </View>

      <View style={styles.toolsSection}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.toolsContent}
        >
          {EDIT_TOOLS.map((tool) => (
            <TouchableOpacity
              key={tool.id}
              style={[styles.toolButton, activeTool === tool.id && styles.toolButtonActive]}
              onPress={() => setActiveTool(activeTool === tool.id ? null : tool.id)}
            >
              <Text style={styles.toolIcon}>{tool.icon}</Text>
              <Text style={[styles.toolLabel, activeTool === tool.id && styles.toolLabelActive]}>
                {tool.label}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: tokens.colors.black,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: tokens.spacing.md,
    paddingVertical: tokens.spacing.sm,
  },
  headerTitle: {
    color: tokens.colors.white,
    fontSize: tokens.typography.title.fontSize,
    fontWeight: '700',
  },
  headerButton: {
    color: tokens.colors.white,
    fontSize: tokens.typography.body.fontSize,
  },
  previewContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: tokens.spacing.xl,
  },
  videoPreview: {
    width: SCREEN_WIDTH * 0.6,
    aspectRatio: 9 / 16,
    backgroundColor: tokens.colors.elevated,
    borderRadius: tokens.radius.md,
    justifyContent: 'center',
    alignItems: 'center',
  },
  previewPlaceholder: {
    color: tokens.colors.text.secondary,
    fontSize: tokens.typography.body.fontSize,
  },
  timeline: {
    paddingHorizontal: tokens.spacing.md,
    marginBottom: tokens.spacing.md,
  },
  timelineTrack: {
    height: 48,
    backgroundColor: tokens.colors.elevated,
    borderRadius: tokens.radius.sm,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 2,
    overflow: 'hidden',
  },
  timelineThumb: {
    position: 'absolute',
    left: '30%',
    width: 2,
    height: '100%',
    backgroundColor: tokens.colors.white,
    zIndex: 1,
  },
  timelineFrame: {
    flex: 1,
    height: 40,
    backgroundColor: tokens.colors.surface,
    marginHorizontal: 1,
    borderRadius: 2,
  },
  timelineInfo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: tokens.spacing.xs,
  },
  timelineTime: {
    color: tokens.colors.text.secondary,
    fontSize: tokens.typography.caption.fontSize,
  },
  toolsSection: {
    paddingVertical: tokens.spacing.md,
    borderTopWidth: 0.5,
    borderTopColor: tokens.colors.surface,
  },
  toolsContent: {
    paddingHorizontal: tokens.spacing.md,
    gap: tokens.spacing.lg,
  },
  toolButton: {
    alignItems: 'center',
    gap: tokens.spacing.xs,
  },
  toolButtonActive: {
    opacity: 1,
  },
  toolIcon: {
    fontSize: 24,
  },
  toolLabel: {
    color: tokens.colors.text.secondary,
    fontSize: tokens.typography.caption.fontSize,
  },
  toolLabelActive: {
    color: tokens.colors.white,
    fontWeight: '600',
  },
});
