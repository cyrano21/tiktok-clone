import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, ScrollView, Switch } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { tokens } from '@/theme/tokens';
import { useNavigation, useRouteParams } from '@/navigation/NavigationContext';
import { useSessionStore } from '@/store/sessionStore';
import { useGeneratorStore } from '@/store/generatorStore';
import { WebImagePicker } from '@/components/media/WebImagePicker';
import {
  SHOP_CATEGORIES,
  ProductCategory,
  ProductVariant,
  getProductById,
  createProduct,
  updateProduct,
  formatPrice,
} from '@/services/demoShop';

interface Params {
  productId?: string; // when editing
}

export const ProductEditorScreen: React.FC = () => {
  const insets = useSafeAreaInsets();
  const nav = useNavigation();
  const { productId } = useRouteParams<Params>();
  const existing = productId ? getProductById(productId) : undefined;
  const sellerId = useSessionStore((s) => s.sellerId);

  const [title, setTitle] = useState(existing?.title ?? '');
  const [description, setDescription] = useState(existing?.description ?? '');
  const [price, setPrice] = useState(existing ? String(existing.price) : '');
  const [originalPrice, setOriginalPrice] = useState(existing ? String(existing.originalPrice) : '');
  const [category, setCategory] = useState<ProductCategory>(existing?.category ?? 'fashion');
  const [images, setImages] = useState<string[]>(existing?.images ?? []);
  const [variantsText, setVariantsText] = useState(
    existing ? existing.variants.map((v) => v.label).join(', ') : ''
  );
  const [freeShipping, setFreeShipping] = useState(existing?.freeShipping ?? true);
  const [onSale, setOnSale] = useState(existing?.onSale ?? true);
  const [error, setError] = useState<string | null>(null);

  // Pull back any image created by the generator screen.
  const consumeGenerated = useGeneratorStore((s) => s.consume);
  const lastGenerated = useGeneratorStore((s) => s.lastGenerated);
  useEffect(() => {
    if (lastGenerated) {
      const url = consumeGenerated();
      if (url) setImages((prev) => [...prev, url]);
    }
  }, [lastGenerated, consumeGenerated]);

  const priceNum = parseFloat(price.replace(',', '.'));
  const originalNum = parseFloat(originalPrice.replace(',', '.'));
  const valid = title.trim().length > 2 && !isNaN(priceNum) && priceNum > 0 && images.length > 0;

  const buildVariants = (): ProductVariant[] =>
    variantsText
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean)
      .map((label) => ({ id: label.toLowerCase().replace(/\s+/g, '-'), label }));

  const handleSave = () => {
    if (!valid) {
      setError('Renseigne un titre, un prix valide et au moins une photo.');
      return;
    }
    const input = {
      title: title.trim(),
      description: description.trim(),
      price: priceNum,
      originalPrice: isNaN(originalNum) ? priceNum : originalNum,
      category,
      images,
      variants: buildVariants(),
      freeShipping,
      onSale,
    };
    const saved = existing
      ? updateProduct(existing.id, input)
      : createProduct(sellerId, input);
    if (saved) nav.replace('shop.product', { productId: saved.id });
  };

  const addImage = (url: string) => setImages((prev) => [...prev, url]);
  const removeImage = (i: number) => setImages((prev) => prev.filter((_, idx) => idx !== i));

  const discount = !isNaN(priceNum) && !isNaN(originalNum) && originalNum > priceNum
    ? Math.round(100 - (priceNum / originalNum) * 100)
    : 0;

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => nav.back()} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <Text style={styles.backIcon}>←</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{existing ? 'Modifier le produit' : 'Nouveau produit'}</Text>
        <View style={styles.placeholder} />
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Text style={styles.label}>Photos du produit</Text>
        <WebImagePicker images={images} onAdd={addImage} onRemove={removeImage} />
        <TouchableOpacity
          style={styles.generateBtn}
          onPress={() => nav.push('shop.image.generator', { title, price, baseImage: images[0] })}
        >
          <Text style={styles.generateIcon}>🎨</Text>
          <Text style={styles.generateText}>Générer un visuel produit</Text>
        </TouchableOpacity>

        <Text style={styles.label}>Titre</Text>
        <TextInput
          style={styles.input}
          placeholder="Ex : Veste oversize en denim"
          placeholderTextColor={tokens.colors.text.tertiary}
          value={title}
          onChangeText={setTitle}
        />

        <Text style={styles.label}>Description</Text>
        <TextInput
          style={[styles.input, styles.textarea]}
          placeholder="Décris la matière, la coupe, les avantages…"
          placeholderTextColor={tokens.colors.text.tertiary}
          value={description}
          onChangeText={setDescription}
          multiline
        />

        <View style={styles.priceRow}>
          <View style={styles.priceCol}>
            <Text style={styles.label}>Prix (€)</Text>
            <TextInput
              style={styles.input}
              placeholder="49.90"
              placeholderTextColor={tokens.colors.text.tertiary}
              value={price}
              onChangeText={setPrice}
              keyboardType="decimal-pad"
            />
          </View>
          <View style={styles.priceCol}>
            <Text style={styles.label}>Prix barré (€)</Text>
            <TextInput
              style={styles.input}
              placeholder="89.90"
              placeholderTextColor={tokens.colors.text.tertiary}
              value={originalPrice}
              onChangeText={setOriginalPrice}
              keyboardType="decimal-pad"
            />
          </View>
        </View>
        {discount > 0 && <Text style={styles.discountHint}>Remise affichée : -{discount}%</Text>}

        <Text style={styles.label}>Catégorie</Text>
        <View style={styles.catRow}>
          {SHOP_CATEGORIES.filter((c) => c.id !== 'all').map((c) => (
            <TouchableOpacity
              key={c.id}
              style={[styles.catChip, category === c.id && styles.catChipActive]}
              onPress={() => setCategory(c.id)}
            >
              <Text style={[styles.catText, category === c.id && styles.catTextActive]}>{c.icon} {c.label}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <Text style={styles.label}>Variantes (séparées par des virgules)</Text>
        <TextInput
          style={styles.input}
          placeholder="S, M, L, XL"
          placeholderTextColor={tokens.colors.text.tertiary}
          value={variantsText}
          onChangeText={setVariantsText}
        />

        <View style={styles.toggleRow}>
          <Text style={styles.toggleLabel}>Livraison gratuite</Text>
          <Switch
            value={freeShipping}
            onValueChange={setFreeShipping}
            trackColor={{ false: tokens.colors.surface, true: tokens.colors.brand.primary }}
            thumbColor={tokens.colors.white}
          />
        </View>
        <View style={styles.toggleRow}>
          <Text style={styles.toggleLabel}>Mettre en vente immédiatement</Text>
          <Switch
            value={onSale}
            onValueChange={setOnSale}
            trackColor={{ false: tokens.colors.surface, true: tokens.colors.brand.primary }}
            thumbColor={tokens.colors.white}
          />
        </View>

        {error && <Text style={styles.error}>{error}</Text>}

        <TouchableOpacity style={[styles.saveBtn, !valid && styles.saveBtnDisabled]} onPress={handleSave} disabled={!valid}>
          <Text style={styles.saveBtnText}>
            {existing ? 'Enregistrer les modifications' : `Publier le produit${!isNaN(priceNum) ? ` · ${formatPrice(priceNum)}` : ''}`}
          </Text>
        </TouchableOpacity>
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
  content: { padding: tokens.spacing.md, paddingBottom: tokens.spacing.xxl, gap: tokens.spacing.sm },
  label: { color: tokens.colors.white, fontSize: tokens.typography.body.fontSize, fontWeight: '700', marginTop: tokens.spacing.sm },
  generateBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: tokens.spacing.sm,
    marginTop: tokens.spacing.sm,
    paddingVertical: tokens.spacing.sm,
    borderRadius: tokens.radius.sm,
    borderWidth: 1,
    borderColor: tokens.colors.brand.primary,
    borderStyle: 'dashed',
  },
  generateIcon: { fontSize: 16 },
  generateText: { color: tokens.colors.brand.primary, fontSize: tokens.typography.body.fontSize, fontWeight: '700' },
  input: {
    backgroundColor: tokens.colors.elevated,
    borderRadius: tokens.radius.sm,
    color: tokens.colors.white,
    fontSize: tokens.typography.body.fontSize,
    paddingHorizontal: tokens.spacing.md,
    paddingVertical: tokens.spacing.sm,
    minHeight: 44,
  },
  textarea: { minHeight: 80, textAlignVertical: 'top' },
  priceRow: { flexDirection: 'row', gap: tokens.spacing.md },
  priceCol: { flex: 1 },
  discountHint: { color: tokens.colors.brand.primary, fontSize: tokens.typography.caption.fontSize, fontWeight: '700' },
  catRow: { flexDirection: 'row', flexWrap: 'wrap', gap: tokens.spacing.sm },
  catChip: {
    paddingHorizontal: tokens.spacing.md,
    paddingVertical: 8,
    borderRadius: tokens.radius.full,
    backgroundColor: tokens.colors.elevated,
  },
  catChipActive: { backgroundColor: tokens.colors.brand.primary },
  catText: { color: tokens.colors.text.secondary, fontSize: tokens.typography.body.fontSize },
  catTextActive: { color: tokens.colors.white, fontWeight: '700' },
  toggleRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: tokens.spacing.sm },
  toggleLabel: { color: tokens.colors.white, fontSize: tokens.typography.body.fontSize },
  error: { color: tokens.colors.semantic.error, fontSize: tokens.typography.body.fontSize, marginTop: tokens.spacing.xs },
  saveBtn: {
    marginTop: tokens.spacing.lg,
    height: 52,
    borderRadius: tokens.radius.sm,
    backgroundColor: tokens.colors.brand.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  saveBtnDisabled: { opacity: 0.5 },
  saveBtnText: { color: tokens.colors.white, fontSize: tokens.typography.subhead.fontSize, fontWeight: '800' },
});
