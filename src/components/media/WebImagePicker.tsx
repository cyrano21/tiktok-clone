import React from 'react';
import { View, Text, TouchableOpacity, Image, StyleSheet } from 'react-native';
import { tokens } from '@/theme/tokens';

interface Props {
  images: string[];
  onAdd: (url: string) => void;
  onRemove: (index: number) => void;
}

const SAMPLE_IMAGES = [
  'https://picsum.photos/seed/np1/600/800',
  'https://picsum.photos/seed/np2/600/800',
  'https://picsum.photos/seed/np3/600/800',
];

// Native fallback: adds sample images. The web version uses a real file picker.
export const WebImagePicker: React.FC<Props> = ({ images, onAdd, onRemove }) => {
  return (
    <View style={styles.wrap}>
      {images.map((src, i) => (
        <View key={src + i} style={styles.thumb}>
          <Image source={{ uri: src }} style={styles.img} />
          <TouchableOpacity style={styles.remove} onPress={() => onRemove(i)}>
            <Text style={styles.removeText}>✕</Text>
          </TouchableOpacity>
        </View>
      ))}
      <TouchableOpacity style={styles.add} onPress={() => onAdd(SAMPLE_IMAGES[images.length % SAMPLE_IMAGES.length])}>
        <Text style={styles.addPlus}>＋</Text>
        <Text style={styles.addLabel}>Photo</Text>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  thumb: { width: 84, height: 110, borderRadius: 10, overflow: 'hidden', backgroundColor: tokens.colors.elevated },
  img: { width: '100%', height: '100%' },
  remove: { position: 'absolute', top: 4, right: 4, width: 22, height: 22, borderRadius: 11, backgroundColor: 'rgba(0,0,0,0.65)', justifyContent: 'center', alignItems: 'center' },
  removeText: { color: '#fff', fontSize: 12 },
  add: { width: 84, height: 110, borderRadius: 10, borderWidth: 1, borderColor: tokens.colors.surface, justifyContent: 'center', alignItems: 'center', gap: 4 },
  addPlus: { color: tokens.colors.text.secondary, fontSize: 26 },
  addLabel: { color: tokens.colors.text.secondary, fontSize: 11 },
});

export default WebImagePicker;
