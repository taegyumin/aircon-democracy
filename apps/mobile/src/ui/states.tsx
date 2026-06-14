// 상태 primitive — EmptyState / ErrorState / Skeleton. spinner+raw text 졸업.

import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { SearchX, WifiOff } from 'lucide-react-native';
import { TOKEN, SPACE } from '@aircon/core';
import { AppText } from './AppText';
import { Button } from './Button';

export function EmptyState({ title, desc, icon }: { title: string; desc?: string; icon?: React.ReactNode }) {
  return (
    <View style={styles.center}>
      {icon ?? <SearchX size={36} color={TOKEN.text3} />}
      <AppText variant="bodyLg" weight="semibold" center color={TOKEN.text2}>{title}</AppText>
      {desc ? <AppText variant="caption" center color={TOKEN.text3}>{desc}</AppText> : null}
    </View>
  );
}

export function ErrorState({ message, onRetry }: { message?: string; onRetry?: () => void }) {
  return (
    <View style={styles.center}>
      <WifiOff size={36} color={TOKEN.hot} />
      <AppText variant="bodyLg" weight="semibold" center>잠시 문제가 생겼어요</AppText>
      <AppText variant="caption" center color={TOKEN.text3}>{message ?? '네트워크를 확인하고 다시 시도해 주세요.'}</AppText>
      {onRetry ? <View style={{ marginTop: SPACE.s2 }}><Button label="다시 시도" variant="secondary" full={false} onPress={onRetry} /></View> : null}
    </View>
  );
}

export function Loading({ label }: { label?: string }) {
  return (
    <View style={styles.center}>
      <ActivityIndicator color={TOKEN.cold} />
      {label ? <AppText variant="caption" color={TOKEN.text3}>{label}</AppText> : null}
    </View>
  );
}

export function Skeleton({ height = 60, style }: { height?: number; style?: object }) {
  return <View style={[styles.skeleton, { height }, style]} />;
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: SPACE.s2, padding: SPACE.s6 },
  skeleton: { backgroundColor: TOKEN.surface2, borderRadius: TOKEN.r.md, opacity: 0.7 },
});
