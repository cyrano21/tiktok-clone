import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { tokens } from '@/theme/tokens';
import { useNavigation, useRouteParams } from '@/navigation/NavigationContext';
import { useGeneratorStore } from '@/store/generatorStore';
import { WebImageGenerator } from '@/components/media/WebImageGenerator';

interface Params {
  title?: string;
  price?: string;
  baseImage?: string;
}

export const ImageGeneratorScreen: React.FC = () => {
  const insets = useSafeAreaInsets();
  const nav = useNavigation();
  const { title, price, baseImage } = useRouteParams<Params>();
  const setLastGenerated = useGeneratorStore((s) => s.setLastGenerated);

  const handleGenerate = (result: { dataUrl: string }) => {
    setLastGenerated(result.dataUrl);
    nav.back();
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => nav.back()} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <Text style={styles.backIcon}>←</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Générateur d'image</Text>
        <View style={styles.placeholder} />
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Text style={styles.intro}>Crée un visuel produit prêt à publier — choisis un format, un style, ajoute ton texte et ta photo.</Text>
        <WebImageGenerator
          defaultTitle={title}
          defaultPrice={price}
          baseImage={baseImage}
          onGenerate={handleGenerate}
        />
      </ScrollView>
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
  headerTitle: { color: tokens.colors.white, fontSize: tokens.typography.title.fontSize, fontWeight: '700' },
  placeholder: { width: 28 },
  content: { padding: tokens.spacing.md, paddingBottom: tokens.spacing.xxl, gap: tokens.spacing.md },
  intro: { color: tokens.colors.text.secondary, fontSize: tokens.typography.body.fontSize, lineHeight: 19 },
});
