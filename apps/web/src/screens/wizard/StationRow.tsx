'use client';

// 지하철역 1행 (landing nearby list + 검색 결과 공통).

import { TOKEN, FONT, lineColor, formatDistance, type Station } from '@aircon/core';

interface Props {
  station: Station;
  distance?: number;
  loading?: boolean;
  onTap: () => void;
}

export function StationRow({ station, distance, loading, onTap }: Props) {
  return (
    <button
      onClick={loading ? undefined : onTap}
      disabled={loading}
      style={{
        display: 'flex', alignItems: 'center', gap: 12,
        width: '100%', padding: '12px 14px',
        background: TOKEN.surface, border: `1px solid ${TOKEN.border}`,
        borderRadius: TOKEN.r.md, textAlign: 'left',
        cursor: loading ? 'wait' : 'pointer', fontFamily: FONT,
        opacity: loading ? 0.6 : 1,
      }}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 2, flexShrink: 0, alignItems: 'center', minWidth: 24 }}>
        {station.lines.slice(0, 2).map((l) => (
          <span key={l} style={{
            width: 14, height: 14, borderRadius: '50%', background: lineColor(l), color: '#fff',
            fontSize: 9, fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            {l.match(/^\d+호선$/) ? l.replace('호선', '') : ''}
          </span>
        ))}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: TOKEN.text1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {station.name}
        </div>
        <div style={{ fontSize: 11, color: TOKEN.text3, marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {station.lines.join(' · ')} · {station.city}
        </div>
      </div>
      {distance !== undefined && (
        <span style={{ fontSize: 11, color: TOKEN.text3, flexShrink: 0 }}>{formatDistance(distance)}</span>
      )}
    </button>
  );
}
