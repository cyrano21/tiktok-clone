import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';

export function DesktopFeedControls() {
  const handlePrev = () => {
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('orky:prev-video'));
    }
  };

  const handleNext = () => {
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('orky:next-video'));
    }
  };

  return (
    <View style={styles.container}>
      <TouchableOpacity
        style={styles.controlBtn}
        activeOpacity={0.8}
        onPress={handlePrev}
        accessibilityLabel="Vidéo précédente"
      >
        <Text style={styles.controlIcon}>▲</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.controlBtn}
        activeOpacity={0.8}
        onPress={handleNext}
        accessibilityLabel="Vidéo suivante"
      >
        <Text style={styles.controlIcon}>▼</Text>
      </TouchableOpacity>

      <View style={styles.hintContainer}>
        <Text style={styles.hintText}>Touches</Text>
        <Text style={styles.hintKey}>↑ / ↓</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginLeft: 16,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  controlBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#161624',
    borderWidth: 1,
    borderColor: '#2A2A3E',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.3,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
  },
  controlIcon: {
    color: '#E0E0EE',
    fontSize: 14,
    fontWeight: '800',
  },
  hintContainer: {
    alignItems: 'center',
    marginTop: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
  },
  hintText: {
    fontSize: 9,
    color: '#6E6E82',
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  hintKey: {
    fontSize: 11,
    color: '#9E9EB6',
    fontWeight: '700',
    marginTop: 2,
  },
});
