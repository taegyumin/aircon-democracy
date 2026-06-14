// IconButton — 44pt 터치타겟 보장 + accessibilityLabel 필수. 아이콘 버튼 표준.

import { Pressable, StyleSheet, type ViewStyle } from 'react-native';
import { SPACE, TOKEN } from '@aircon/core';

export function IconButton({ children, onPress, label, variant = 'plain', style }: {
  children: React.ReactNode;
  onPress: () => void;
  label: string;
  variant?: 'plain' | 'filled' | 'tonal';
  style?: ViewStyle;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      hitSlop={8}
      style={({ pressed }) => [
        styles.base,
        variant === 'filled' && { backgroundColor: TOKEN.cold },
        variant === 'tonal' && { backgroundColor: TOKEN.surface2, borderWidth: 1, borderColor: TOKEN.border },
        pressed && { opacity: 0.7 },
        style,
      ]}
    >
      {children}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    minWidth: SPACE.touchMin,
    minHeight: SPACE.touchMin,
    borderRadius: TOKEN.r.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
