// 텍스트 자동완성 입력 (RN) — 기차/시외버스 wizard에서 역·터미널 검색용.
// web의 train/SimpleSuggestInput.tsx RN 포팅. label 단위로만 동작 (지하철과 다름).

import { useState } from 'react';
import { View, Text, TextInput, Pressable, StyleSheet } from 'react-native';
import { TOKEN } from '@aircon/core';

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
      <TextInput
        value={value}
        onChangeText={setValue}
        onFocus={() => setFocused(true)}
        onBlur={() => setTimeout(() => setFocused(false), 120)}
        placeholder={placeholder}
        placeholderTextColor={TOKEN.text3}
        style={[styles.input, !!value && styles.inputFilled]}
        autoCorrect={false}
        autoCapitalize="none"
      />
      {showList && (
        <View style={styles.list}>
          {suggestions.slice(0, 6).map((s) => (
            <Pressable
              key={s}
              onPress={() => { setValue(s); setFocused(false); }}
              style={styles.row}
            >
              <Text style={styles.rowText}>{s}</Text>
            </Pressable>
          ))}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  input: {
    padding: 13,
    borderWidth: 2,
    borderColor: TOKEN.border,
    borderRadius: TOKEN.r.md,
    fontSize: 14,
    color: TOKEN.text1,
    backgroundColor: TOKEN.bg,
  },
  inputFilled: {
    borderColor: TOKEN.cold,
  },
  list: {
    marginTop: 6,
    backgroundColor: TOKEN.surface,
    borderWidth: 1,
    borderColor: TOKEN.border,
    borderRadius: TOKEN.r.md,
    overflow: 'hidden',
  },
  row: {
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderBottomWidth: 1,
    borderBottomColor: TOKEN.border,
  },
  rowText: {
    fontSize: 13,
    color: TOKEN.text1,
  },
});
