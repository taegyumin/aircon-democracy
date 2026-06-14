// 컨트롤 primitive — SegmentedControl(토글) / SelectionGrid(차량·호차·방 선택).

import { View, Pressable, ScrollView, StyleSheet } from 'react-native';
import { TOKEN, SPACE, ELEVATION } from '@aircon/core';
import { AppText } from './AppText';

export function SegmentedControl<T extends string>({ options, value, onChange }: {
  options: { key: T; label: string }[];
  value: T;
  onChange: (key: T) => void;
}) {
  return (
    <View style={styles.segWrap} accessibilityRole="tablist">
      {options.map((o) => {
        const active = o.key === value;
        return (
          <Pressable
            key={o.key}
            onPress={() => onChange(o.key)}
            accessibilityRole="tab"
            accessibilityState={{ selected: active }}
            style={[styles.seg, active && styles.segActive]}
          >
            <AppText variant="label" weight={active ? 'bold' : 'medium'} color={active ? TOKEN.text1 : TOKEN.text3}>
              {o.label}
            </AppText>
          </Pressable>
        );
      })}
    </View>
  );
}

export interface GridItem { key: string; label: string; sub?: string }

export function SelectionGrid({ items, selectedKey, onSelect, columns = 3 }: {
  items: GridItem[];
  selectedKey?: string | null;
  onSelect: (key: string) => void;
  columns?: number;
}) {
  return (
    <View style={styles.grid}>
      {items.map((it) => {
        const active = it.key === selectedKey;
        return (
          <Pressable
            key={it.key}
            onPress={() => onSelect(it.key)}
            accessibilityRole="button"
            accessibilityState={{ selected: active }}
            style={({ pressed }) => [
              styles.cell,
              { width: `${100 / columns}%` },
              pressed && { opacity: 0.9 },
            ]}
          >
            <View style={[styles.cellInner, active ? styles.cellActive : null]}>
              <AppText variant="bodyLg" weight={active ? 'bold' : 'semibold'} color={active ? '#FFFFFF' : TOKEN.text1} center numberOfLines={1}>
                {it.label}
              </AppText>
              {it.sub ? <AppText variant="micro" color={active ? '#FFFFFFCC' : TOKEN.text3} center numberOfLines={1}>{it.sub}</AppText> : null}
            </View>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  segWrap: {
    flexDirection: 'row',
    backgroundColor: TOKEN.surface2,
    borderRadius: TOKEN.r.md,
    padding: 4,
    gap: 4,
  },
  seg: { flex: 1, minHeight: 40, alignItems: 'center', justifyContent: 'center', borderRadius: TOKEN.r.sm },
  segActive: { backgroundColor: TOKEN.surface, ...ELEVATION.sh1 },
  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  cell: { padding: 4 },
  cellInner: {
    minHeight: SPACE.touchMin,
    paddingVertical: SPACE.s2,
    paddingHorizontal: SPACE.s2,
    borderRadius: TOKEN.r.md,
    borderWidth: 1.5,
    borderColor: TOKEN.border,
    backgroundColor: TOKEN.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cellActive: { backgroundColor: TOKEN.cold, borderColor: TOKEN.cold },
});
