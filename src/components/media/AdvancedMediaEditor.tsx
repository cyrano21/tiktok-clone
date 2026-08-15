import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { tokens } from '@/theme/tokens';
import type { AdvancedEditorResult } from './AdvancedMediaEditor.types';

interface Props {
  onExport: (result: AdvancedEditorResult) => void;
  productMode?: boolean;
}

export const AdvancedMediaEditor: React.FC<Props> = () => {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Studio Timeline</Text>
      <Text style={styles.text}>
        La timeline multi-clips est disponible dans la version web. Le parcours natif reste désactivé tant que le rendu multi-source n’est pas branché au client mobile.
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { padding: tokens.spacing.lg, gap: tokens.spacing.sm, alignItems: 'center' },
  title: { color: tokens.colors.white, fontSize: tokens.typography.subhead.fontSize, fontWeight: '700' },
  text: { color: tokens.colors.text.secondary, fontSize: tokens.typography.body.fontSize, textAlign: 'center' },
});

export default AdvancedMediaEditor;
