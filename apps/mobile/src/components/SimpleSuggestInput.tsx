// 텍스트 자동완성 입력 (RN) — 기차/시외버스 wizard에서 역·터미널 검색용. 디자인 시스템 적용.
// web의 train/SimpleSuggestInput.tsx RN 포팅. label 단위로만 동작 (지하철과 다름).

import { useState } from 'react';
import { View, Pressable, StyleSheet } from 'react-native';
import { TOKEN, SPACE, ELEVATION } from '@aircon/core';
import { AppText } from '../ui/AppText';
import { Input } from '../ui/Input';

interface Props {
  value: string;
  setValue: (v: string) => void;
  placeholder: string;
  suggestions: string[];
}

export function SimpleSuggestInput({ value, setValue, placeholder, suggestions }: Props) {
  const [focused, setFocused] = useState(false);
  const showList = focused && value.trim() !== '' && suggestions.length > 0 &&
    !suggestions.some((s) => s === value.trim());

  return (
    <View>
      <Input
        value={value}
        onChangeText={setValue}
        onFocus={() => setFocused(true)}
        onBlur={() => setTimeout(() => setFocused(false), 120)}
        placeholder={placeholder}
        autoCorrect={false}
        autoCapitalize="none"
      />
      {showList && (
        <View style={styles.list}>
          {suggestions.slice(0, 6).map((s, i) => (
            <Pressable
              key={s}
              onPress={() => { setValue(s); setFocused(false); }}
              accessibilityRole="button"
              style={({ pressed }) => [styles.row, i > 0 && styles.rowBorder, pressed && { backgroundColor: TOKEN.surface2 }]}
            >
              <AppText variant="body">{s}</AppText>
            </Pressable>
          ))}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  list: {
    marginTop: SPACE.s2,
    backgroundColor: TOKEN.surface,
    borderWidth: 1,
    borderColor: TOKEN.border,
    borderRadius: TOKEN.r.md,
    overflow: 'hidden',
    ...ELEVATION.sh1,
  },
  row: { minHeight: SPACE.touchMin, justifyContent: 'center', paddingVertical: SPACE.s2, paddingHorizontal: SPACE.s4 },
  rowBorder: { borderTopWidth: 1, borderTopColor: TOKEN.border },
});
