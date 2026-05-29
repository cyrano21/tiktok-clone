import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { tokens } from '@/theme/tokens';
import { MediaFilters, DEFAULT_FILTERS, MediaType } from '@/store/studioStore';

export interface EditorResult {
  type: MediaType;
  sourceUrl: string;
  thumbnailUrl: string;
  overlayText: string;
  filters: MediaFilters;
  trimStart: number;
  trimEnd: number;
}

interface Props {
  onExport: (result: EditorResult) => void;
  productMode?: boolean;
}

// Native fallback. The real editor lives in WebMediaEditor.web.tsx and is used on web.
export const WebMediaEditor: React.FC<Props> = () => {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Éditeur média</Text>
      <Text style={styles.text}>
        L'éditeur complet (caméra, filtres, texte, découpage) est disponible dans la version web de l'application.
      </Text>
    </View>
  );
};

export { DEFAULT_FILTERS };

const styles = StyleSheet.create({
  container: { padding: tokens.spacing.lg, gap: tokens.spacing.sm, alignItems: 'center' },
  title: { color: tokens.colors.white, fontSize: tokens.typography.subhead.fontSize, fontWeight: '700' },
  text: { color: tokens.colors.text.secondary, fontSize: tokens.typography.body.fontSize, textAlign: 'center' },
});

export default WebMediaEditor;
