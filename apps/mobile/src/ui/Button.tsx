// Button — 단일 버튼 primitive. variant/size/loading/disabled/full. 44pt+ 터치타겟, a11y 내장.
// press 피드백은 RN Pressable의 pressed 상태(순수 RN이라 안전).

import { Pressable, ActivityIndicator, View, StyleSheet, type ViewStyle } from 'react-native';
import { TOKEN, SPACE } from '@aircon/core';
import { AppText } from './AppText';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';
type Size = 'lg' | 'md';

interface Props {
  label: string;
  onPress: () => void;
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  disabled?: boolean;
  full?: boolean;
  leading?: React.ReactNode;
  style?: ViewStyle;
}

const FILL: Record<Variant, { bg: string; fg: string; border?: string }> = {
  primary: { bg: TOKEN.cold, fg: '#FFFFFF' },
  secondary: { bg: TOKEN.surface, fg: TOKEN.text1, border: TOKEN.border },
  ghost: { bg: 'transparent', fg: TOKEN.cold },
  danger: { bg: TOKEN.hot, fg: '#FFFFFF' },
};

export function Button({
  label, onPress, variant = 'primary', size = 'lg',
  loading = false, disabled = false, full = true, leading, style,
}: Props) {
  const c = FILL[variant];
  const isOff = disabled || loading;
  const height = size === 'lg' ? 52 : SPACE.touchMin;
  return (
    <Pressable
      onPress={onPress}
      disabled={isOff}
      accessibilityRole="button"
      accessibilityState={{ disabled: isOff, busy: loading }}
      style={({ pressed }) => [
        styles.base,
        { height, backgroundColor: isOff && variant !== 'ghost' ? TOKEN.border : c.bg },
        c.border ? { borderWidth: 1.5, borderColor: c.border } : null,
        full ? { alignSelf: 'stretch' } : { alignSelf: 'flex-start', paddingHorizontal: SPACE.s6 },
        pressed && !isOff ? { opacity: 0.85, transform: [{ scale: 0.99 }] } : null,
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={variant === 'secondary' || variant === 'ghost' ? TOKEN.cold : '#FFFFFF'} />
      ) : (
        <View style={styles.row}>
          {leading}
          <AppText variant="bodyLg" weight="bold" color={isOff && variant !== 'ghost' ? TOKEN.text3 : c.fg}>
            {label}
          </AppText>
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    borderRadius: TOKEN.r.lg,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: SPACE.s5,
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: SPACE.s2 },
});
