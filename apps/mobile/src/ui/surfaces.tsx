// 표면 primitive — Card / ListRow / Badge / Chip / SectionHeader.
// 일관 radius/shadow/padding + 44pt 터치타겟 + a11y.

import { View, Pressable, StyleSheet, type ViewStyle, type StyleProp } from 'react-native';
import { ChevronRight } from 'lucide-react-native';
import { TOKEN, SPACE, ELEVATION } from '@aircon/core';
import { AppText } from './AppText';

export function Card({ children, style, onPress, accessibilityLabel }: {
  children: React.ReactNode; style?: StyleProp<ViewStyle>; onPress?: () => void; accessibilityLabel?: string;
}) {
  if (onPress) {
    return (
      <Pressable
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel}
        style={({ pressed }) => [styles.card, pressed && { opacity: 0.9 }, style]}
      >
        {children}
      </Pressable>
    );
  }
  return <View style={[styles.card, style]}>{children}</View>;
}

export function ListRow({
  title, sub, leading, trailing, onPress, accent, titleColor, titleVariant = 'title2',
}: {
  title: string;
  sub?: string;
  leading?: React.ReactNode;
  trailing?: React.ReactNode;
  onPress?: () => void;
  accent?: boolean;
  titleColor?: string;
  titleVariant?: 'title2' | 'bodyLg';
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={title}
      style={({ pressed }) => [
        styles.row,
        accent && { borderColor: TOKEN.cold, borderWidth: 1.5 },
        pressed && { opacity: 0.9 },
      ]}
    >
      {leading && <View style={styles.rowLeading}>{leading}</View>}
      <View style={styles.rowText}>
        <AppText variant={titleVariant} color={titleColor} numberOfLines={1}>{title}</AppText>
        {sub ? <AppText variant="caption" color={TOKEN.text2} numberOfLines={1} style={{ marginTop: 2 }}>{sub}</AppText> : null}
      </View>
      {trailing ?? <ChevronRight size={20} color={TOKEN.text3} />}
    </Pressable>
  );
}

export function Badge({ label, color = TOKEN.cold, bg = TOKEN.coldBg }: { label: string; color?: string; bg?: string }) {
  return (
    <View style={[styles.badge, { backgroundColor: bg }]}>
      <AppText variant="micro" color={color}>{label}</AppText>
    </View>
  );
}

export function Chip({ label, active, onPress }: { label: string; active?: boolean; onPress?: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      style={({ pressed }) => [
        styles.chip,
        active ? { backgroundColor: TOKEN.cold, borderColor: TOKEN.cold } : { backgroundColor: TOKEN.surface, borderColor: TOKEN.border },
        pressed && { opacity: 0.9 },
      ]}
    >
      <AppText variant="label" color={active ? '#FFFFFF' : TOKEN.text1}>{label}</AppText>
    </Pressable>
  );
}

export function SectionHeader({ children }: { children: string }) {
  return <AppText variant="micro" color={TOKEN.text3} style={styles.section}>{children.toUpperCase()}</AppText>;
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: TOKEN.surface,
    borderRadius: TOKEN.r.lg,
    borderWidth: 1,
    borderColor: TOKEN.border,
    padding: SPACE.s4,
    ...ELEVATION.sh1,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACE.s3,
    minHeight: 60,
    paddingVertical: SPACE.s3,
    paddingHorizontal: SPACE.s4,
    backgroundColor: TOKEN.surface,
    borderRadius: TOKEN.r.lg,
    borderWidth: 1,
    borderColor: TOKEN.border,
    ...ELEVATION.sh1,
  },
  rowLeading: { width: 44, height: 44, borderRadius: TOKEN.r.md, alignItems: 'center', justifyContent: 'center' },
  rowText: { flex: 1, minWidth: 0 },
  badge: { paddingHorizontal: SPACE.s2, paddingVertical: 3, borderRadius: TOKEN.r.pill },
  chip: { paddingHorizontal: SPACE.s4, paddingVertical: SPACE.s2, borderRadius: TOKEN.r.pill, borderWidth: 1.5, minHeight: 40, alignItems: 'center', justifyContent: 'center' },
  section: { marginBottom: SPACE.s3 },
});
