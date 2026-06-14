// AppText — 타입 스케일 단일 진입점. 모든 화면이 RN Text 대신 이걸 import.
// 폰트 스케일: 네이티브 scaling 사용(수동 곱 금지 — React19/RN0.81 Text 회귀 회피) + maxFontSizeMultiplier 캡.
// 굵기 강조는 weight prop (variant 폭증 방지). 시스템 폰트(Pretendard 번들은 v1.1).

import { Text, type TextProps, type TextStyle } from 'react-native';
import { TYPE, TOKEN, WEIGHT, type TypeVariant, type WeightKey } from '@aircon/core';

interface Props extends TextProps {
  variant?: TypeVariant;
  weight?: WeightKey;
  color?: string;
  center?: boolean;
}

export function AppText({
  variant = 'body',
  weight,
  color,
  center,
  style,
  maxFontSizeMultiplier = 1.3,
  ...rest
}: Props) {
  const base = TYPE[variant] as TextStyle;
  return (
    <Text
      maxFontSizeMultiplier={maxFontSizeMultiplier}
      style={[
        base,
        { color: color ?? TOKEN.text1 },
        weight ? { fontWeight: WEIGHT[weight] as TextStyle['fontWeight'] } : null,
        center ? { textAlign: 'center' } : null,
        style,
      ]}
      {...rest}
    />
  );
}
