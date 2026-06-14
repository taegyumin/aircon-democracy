// TopBar — wizard 내부 헤더 단일 출처 (DESIGN.md 헤더 SSOT). 뒤로 + 타이틀 + 우측 액션.
// expo-router Stack 헤더를 쓰는 화면은 이걸 안 쓴다. 자체 헤더가 필요한 곳만.

import { View, Pressable, StyleSheet } from 'react-native';
import { ChevronLeft } from 'lucide-react-native';
import { TOKEN, SPACE } from '@aircon/core';
import { AppText } from './AppText';

export function TopBar({ title, onBack, backLabel, right }: {
  title: string;
  onBack?: () => void;
  backLabel?: string;
  right?: React.ReactNode;
}) {
  return (
    <View style={styles.bar}>
      {onBack ? (
        <Pressable onPress={onBack} accessibilityRole="button" accessibilityLabel={backLabel ?? '뒤로'} hitSlop={10} style={styles.back}>
          <ChevronLeft size={24} color={TOKEN.text1} />
          {backLabel ? <AppText variant="body" color={TOKEN.text2}>{backLabel}</AppText> : null}
        </Pressable>
      ) : <View style={styles.back} />}
      <AppText variant="title2" numberOfLines={1} style={styles.title}>{title}</AppText>
      <View style={styles.right}>{right}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: SPACE.topBarHeight,
    paddingHorizontal: SPACE.s3,
    backgroundColor: TOKEN.surface,
    borderBottomWidth: 1,
    borderBottomColor: TOKEN.border,
  },
  back: { flexDirection: 'row', alignItems: 'center', minWidth: 44, minHeight: 44, justifyContent: 'flex-start' },
  title: { flex: 1, textAlign: 'center' },
  right: { minWidth: 44, minHeight: 44, alignItems: 'flex-end', justifyContent: 'center' },
});
