'use client';

// 지하철 역 자동완성 — Station 객체 단위. 선택 후 chip 클릭으로 reset.
// Claude Design v2 스타일: selected 모드는 2-line chip (typeLabel 작게 + val 크게 + check).

import { TOKEN, FONT, stationDisplay, type Station } from '@aircon/core';
import { fieldStyle } from '../styles';

interface Props {
  // chip 안쪽 typeLabel용. "이전 역" / "다음 역" 같은 간결한 형태.
  label: string;
  query: string;
  setQuery: (v: string) => void;
  station: Station | null;
  setStation: (v: Station | null) => void;
  suggestions: Station[];
  placeholder: string;
}

function CheckIcon({ size = 14, color = TOKEN.ok }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="M4.5 12.5l5 5L19.5 7" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function StationAutocomplete({ label, query, setQuery, station, setStation, suggestions, placeholder }: Props) {
  if (station) {
    // Filled chip — 디자인 v2 시안: 64px height, typeLabel small + val large + ✓.
    // 전체 클릭으로 reset (변경 버튼 별도 노출 안 함 — 시안 minimalism).
    return (
      <button
        onClick={() => { setStation(null); setQuery(''); }}
        style={{
          width: '100%', height: 64,
          background: TOKEN.surface,
          border: `2px solid ${TOKEN.border}`,
          borderRadius: 14,
          display: 'flex', alignItems: 'center', padding: '0 13px', gap: 10,
          cursor: 'pointer', textAlign: 'left',
          boxShadow: '0 1px 5px rgba(0,0,0,0.06)',
          fontFamily: FONT,
        }}
        aria-label={`${stationDisplay(station.name)} — 클릭해서 변경`}
      >
        <div style={{ width: 8, height: 8, borderRadius: '50%', flexShrink: 0, background: TOKEN.text1 }} aria-hidden />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 10, color: TOKEN.text3, fontWeight: 500, marginBottom: 2 }}>{label}</div>
          <div
            style={{
              fontSize: 15, fontWeight: 700, color: TOKEN.text1, lineHeight: 1,
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            }}
          >
            {station.name}
          </div>
        </div>
        <CheckIcon />
      </button>
    );
  }

  // Empty/typing state — input + suggestion list 아래.
  // chip 시안과 시각적 align: 64px height, 같은 radius.
  return (
    <div>
      <input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder={placeholder || label}
        style={{
          ...fieldStyle(!!query),
          height: 64,
          borderRadius: 14,
        }}
        aria-label={label}
      />
      {suggestions.length > 0 && (
        <div style={{ marginTop: 6, display: 'flex', flexDirection: 'column', gap: 4 }}>
          {suggestions.map((s) => (
            <button
              key={s.id}
              onClick={() => { setStation(s); setQuery(''); }}
              style={{
                display: 'flex', alignItems: 'center', gap: 10,
                padding: '10px 14px',
                background: TOKEN.surface, border: `1px solid ${TOKEN.border}`,
                borderRadius: TOKEN.r.md, cursor: 'pointer', fontFamily: FONT,
                textAlign: 'left',
              }}
            >
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: TOKEN.text1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {s.name}
                </div>
                <div style={{ fontSize: 11, color: TOKEN.text3, marginTop: 1 }}>
                  {s.lines.join(' · ')} · {s.city}
                </div>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
