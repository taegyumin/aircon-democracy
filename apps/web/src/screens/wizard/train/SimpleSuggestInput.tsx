'use client';

// 텍스트 전용 자동완성 입력 — 기차 wizard에서 역명 입력에 사용.
// (지하철 wizard는 Station 객체 단위로 동작하므로 별도 StationAutocomplete를 씀.)

import { useState } from 'react';
import { TOKEN, FONT } from '@aircon/core';
import { fieldStyle } from '../styles';

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
    <div style={{ position: 'relative' }}>
      <input
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onFocus={() => setFocused(true)}
        onBlur={() => setTimeout(() => setFocused(false), 120)}
        placeholder={placeholder}
        style={fieldStyle(!!value)}
      />
      {showList && (
        <div style={{
          position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 10,
          marginTop: 4, background: TOKEN.surface,
          border: `1px solid ${TOKEN.border}`, borderRadius: TOKEN.r.md,
          boxShadow: '0 4px 14px rgba(0,0,0,0.08)', overflow: 'hidden',
        }}>
          {suggestions.slice(0, 6).map((s) => (
            <button
              key={s}
              onMouseDown={(e) => { e.preventDefault(); setValue(s); setFocused(false); }}
              style={{
                display: 'block', width: '100%', textAlign: 'left',
                padding: '10px 14px', background: 'transparent', border: 'none',
                borderBottom: `1px solid ${TOKEN.border}`,
                fontSize: 13, color: TOKEN.text1, cursor: 'pointer', fontFamily: FONT,
              }}
            >
              {s}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
