'use client';

// 지하철 wizard "열차 기다리는 중" mode — 단일 역 선택 → 승강장 단위 투표.

import { TOKEN, type Station } from '@aircon/core';
import { primaryButtonStyle } from '../styles';
import { StationAutocomplete } from './StationAutocomplete';

export interface PlatformModeBodyProps {
  query: string; setQuery: (v: string) => void;
  station: Station | null; setStation: (v: Station | null) => void;
  suggestions: Station[];
  error: string | null;
  submitting: boolean;
  canSubmit: boolean;
  onSubmit: () => void;
}

export function PlatformModeBody(p: PlatformModeBodyProps) {
  return (
    <>
      <div style={{ fontSize: 13, color: TOKEN.text2, marginBottom: 14, lineHeight: 1.6 }}>
        어느 역에서 열차 기다리고 계세요? 그 역에서 기다리는 모든 분들과 같은 의견이 모입니다.
      </div>
      <StationAutocomplete
        label="역 이름"
        query={p.query}
        setQuery={p.setQuery}
        station={p.station}
        setStation={p.setStation}
        suggestions={p.suggestions}
        placeholder="예: 강남, ㄱㄴ"
      />
      <div style={{ height: 20 }} />
      {p.error && (
        <div style={{ marginBottom: 14, padding: 10, background: TOKEN.hotBg, color: TOKEN.hot, borderRadius: TOKEN.r.md, fontSize: 12 }}>{p.error}</div>
      )}
      <button onClick={p.onSubmit} disabled={!p.canSubmit} style={primaryButtonStyle(p.canSubmit)}>
        {p.submitting ? '이동 중…' : '투표하러 가기'}
      </button>
    </>
  );
}
