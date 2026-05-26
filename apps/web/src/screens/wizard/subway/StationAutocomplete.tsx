'use client';

// 지하철 역 자동완성 — Station 객체 단위. 선택 후 '변경' 버튼으로 reset.

import { TOKEN, FONT, type Station } from '@aircon/core';
import { Label } from '../Label';
import { fieldStyle } from '../styles';

interface Props {
  label: string;
  query: string;
  setQuery: (v: string) => void;
  station: Station | null;
  setStation: (v: Station | null) => void;
  suggestions: Station[];
  placeholder: string;
}

export function StationAutocomplete({ label, query, setQuery, station, setStation, suggestions, placeholder }: Props) {
  if (station) {
    return (
      <div>
        <Label>{label}</Label>
        <div style={{
          display: 'flex', alignItems: 'center', gap: 10,
          padding: '12px 14px',
          background: TOKEN.coldBg, border: `2px solid ${TOKEN.cold}`,
          borderRadius: TOKEN.r.md,
        }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: TOKEN.text1 }}>{station.name}</div>
            <div style={{ fontSize: 11, color: TOKEN.text3, marginTop: 2 }}>
              {station.lines.join(' · ')}{station.city ? ' · ' + station.city : ''}
            </div>
          </div>
          <button
            onClick={() => { setStation(null); setQuery(''); }}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: TOKEN.text2, fontSize: 13, fontFamily: FONT }}
          >
            변경
          </button>
        </div>
      </div>
    );
  }
  return (
    <div>
      <Label>{label}</Label>
      <input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder={placeholder}
        style={fieldStyle(!!query)}
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
