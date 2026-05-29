import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { tokens } from '@/theme/tokens';

interface Props {
  data: number[];
  labels?: string[];
  height?: number;
  color?: string;
}

function formatShort(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1).replace('.0', '')}M`;
  if (n >= 1000) return `${(n / 1000).toFixed(1).replace('.0', '')}k`;
  return String(Math.round(n));
}

export const MiniBarChart: React.FC<Props> = ({
  data,
  labels,
  height = 120,
  color = tokens.colors.brand.primary,
}) => {
  const max = Math.max(1, ...data);
  return (
    <View style={styles.wrap}>
      <View style={[styles.bars, { height }]}>
        {data.map((v, i) => {
          const h = Math.max(4, (v / max) * (height - 18));
          return (
            <View key={i} style={styles.col}>
              <Text style={styles.value}>{formatShort(v)}</Text>
              <View style={[styles.bar, { height: h, backgroundColor: color }]} />
            </View>
          );
        })}
      </View>
      {labels && (
        <View style={styles.labels}>
          {labels.map((l, i) => (
            <Text key={i} style={styles.label}>{l}</Text>
          ))}
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  wrap: { width: '100%' },
  bars: { flexDirection: 'row', alignItems: 'flex-end', gap: 6 },
  col: { flex: 1, alignItems: 'center', justifyContent: 'flex-end', gap: 4 },
  value: { color: tokens.colors.text.secondary, fontSize: 9, fontWeight: '600' },
  bar: { width: '70%', borderRadius: 4 },
  labels: { flexDirection: 'row', marginTop: 6 },
  label: { flex: 1, textAlign: 'center', color: tokens.colors.text.tertiary, fontSize: 10 },
});
