// Input / Field — 일관 텍스트 입력. Field = label + Input + helper/error 묶음.
// clearable: 크로스플랫폼 × 버튼 (iOS clearButtonMode는 Android 미지원이라 직접 렌더).

import { useState } from 'react';
import { View, TextInput, Pressable, StyleSheet, type TextInputProps } from 'react-native';
import { X } from 'lucide-react-native';
import { TOKEN, SPACE, TYPE } from '@aircon/core';
import { AppText } from './AppText';

interface InputProps extends TextInputProps {
  error?: boolean;
  clearable?: boolean;
}

export function Input({ error, clearable, style, value, onChangeText, onFocus, onBlur, ...rest }: InputProps) {
  const [focused, setFocused] = useState(false);
  const showClear = clearable && !!value && value.length > 0;
  const borderColor = error ? TOKEN.hot : focused ? TOKEN.cold : TOKEN.border;

  // {...rest}를 먼저 펼치고, 합성 핸들러/스타일을 뒤에 둬서 caller가 Input의 focus 추적을 덮지 않게 한다.
  const field = (
    <TextInput
      {...rest}
      value={value}
      onChangeText={onChangeText}
      placeholderTextColor={TOKEN.text3}
      onFocus={(e) => { setFocused(true); onFocus?.(e); }}
      onBlur={(e) => { setFocused(false); onBlur?.(e); }}
      style={[styles.input, { borderColor }, clearable ? styles.inputClearable : null, style]}
    />
  );

  if (!clearable) return field;
  return (
    <View style={styles.wrap}>
      {field}
      {showClear && (
        <Pressable
          onPress={() => onChangeText?.('')}
          accessibilityRole="button"
          accessibilityLabel="입력 지우기"
          hitSlop={10}
          style={styles.clear}
        >
          <X size={18} color={TOKEN.text3} />
        </Pressable>
      )}
    </View>
  );
}

interface FieldProps extends InputProps {
  label?: string;
  helper?: string;
  errorText?: string | null;
}

export function Field({ label, helper, errorText, ...inputProps }: FieldProps) {
  const hasError = !!errorText;
  return (
    <View style={{ gap: SPACE.s2 }}>
      {label && <AppText variant="label" color={TOKEN.text2}>{label}</AppText>}
      <Input error={hasError} {...inputProps} />
      {hasError ? (
        <AppText variant="caption" color={TOKEN.hot}>{errorText}</AppText>
      ) : helper ? (
        <AppText variant="caption" color={TOKEN.text3}>{helper}</AppText>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  input: {
    minHeight: SPACE.touchMin,
    paddingHorizontal: SPACE.s4,
    paddingVertical: SPACE.s3,
    borderWidth: 1.5,
    borderRadius: TOKEN.r.md,
    backgroundColor: TOKEN.surface,
    fontSize: TYPE.body.fontSize,
    color: TOKEN.text1,
  },
  inputClearable: { paddingRight: SPACE.s8 },
  wrap: { position: 'relative', justifyContent: 'center' },
  clear: { position: 'absolute', right: SPACE.s2, height: SPACE.touchMin, width: SPACE.touchMin, alignItems: 'center', justifyContent: 'center' },
});
