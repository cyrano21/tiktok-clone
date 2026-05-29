import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { tokens } from '@/theme/tokens';

export interface GeneratorResult {
  dataUrl: string;
}

interface Props {
  defaultTitle?: string;
  defaultPrice?: string;
  baseImage?: string;
  onGenerate: (result: GeneratorResult) => void;
}

// Native fallback. The real canvas generator lives in WebImageGenerator.web.tsx.
export const WebImageGenerator: React.FC<Props> = ({ defaultTitle = 'Produit', onGenerate }) => {
  return (
    <View style={styles.container}>
      <Text style={styles.text}>
        Le générateur d'image (canvas, styles, badges) est disponible dans la version web.
      </Text>
      <TouchableOpacity
        style={styles.btn}
        onPress={() => onGenerate({ dataUrl: `https://picsum.photos/seed/${encodeURIComponent(defaultTitle)}/600/800` })}
      >
        <Text style={styles.btnText}>Générer une image de démo</Text>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { padding: tokens.spacing.lg, gap: tokens.spacing.md, alignItems: 'center' },
  text: { color: tokens.colors.text.secondary, fontSize: tokens.typography.body.fontSize, textAlign: 'center' },
  btn: { backgroundColor: tokens.colors.brand.primary, borderRadius: tokens.radius.sm, paddingHorizontal: tokens.spacing.lg, paddingVertical: tokens.spacing.md },
  btnText: { color: tokens.colors.white, fontWeight: '700' },
});

export default WebImageGenerator;
