// Input / Field — 일관 텍스트 입력. Field = label + Input + helper/error 묶음.

import { useState } from 'react';
import { View, TextInput, StyleSheet, type TextInputProps } from 'react-native';
import { TOKEN, SPACE, TYPE } from '@aircon/core';
import { AppText } from './AppText';

interface InputProps extends TextInputProps {
  error?: boolean;
}

export function Input({ error, style, ...rest }: InputProps) {
  const [focused, setFocused] = useState(false);
  return (
    <TextInput
      placeholderTextColor={TOKEN.text3}
      onFocus={(e) => { setFocused(true); rest.onFocus?.(e); }}
      onBlur={(e) => { setFocused(false); rest.onBlur?.(e); }}
      style={[
        styles.input,
        { borderColor: error ? TOKEN.hot : focused ? TOKEN.cold : TOKEN.border },
        style,
      ]}
      {...rest}
    />
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
});
