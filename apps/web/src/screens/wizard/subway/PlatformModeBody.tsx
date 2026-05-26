'use client';

// 지하철 wizard "열차 기다리는 중" mode — Claude Design 시안 적용.
// 단일 역 선택 → 노선 색 카드 (인접역 미니 라우트) → "역명에서 투표하기" CTA.

import {
  TOKEN, FONT, lineColor, neighborNames, stationDisplay, type Station,
} from '@aircon/core';
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

function ArrowRight({ color = '#fff', size = 18 }: { color?: string; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="M5 12h14M13 6l6 6-6 6" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
function CheckIcon({ color = TOKEN.ok, size = 14 }: { color?: string; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="M4.5 12.5l5 5L19.5 7" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function PlatformModeBody(p: PlatformModeBodyProps) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
      {/* 헤드라인 */}
      <div
        style={{
          fontSize: 22, fontWeight: 900, color: TOKEN.text1,
          letterSpacing: '-0.5px', lineHeight: 1.3,
        }}
      >
        어느 역에서<br />기다리고 계세요?
      </div>

      {/* StationAutocomplete — selected 모드는 chip + check + 변경 버튼,
          empty/typing 모드는 search input + 결과 list */}
      <StationAutocomplete
        label="역 이름"
        query={p.query}
        setQuery={p.setQuery}
        station={p.station}
        setStation={p.setStation}
        suggestions={p.suggestions}
        placeholder="예: 강남, 서울대입구"
      />

      {/* 선택 후 — 노선 색 카드 + 인접역 미니 라우트 + 확인 메시지 */}
      {p.station && <PlatformCard station={p.station} />}

      {p.error && (
        <div style={{ padding: 10, background: TOKEN.hotBg, color: TOKEN.hot, borderRadius: TOKEN.r.md, fontSize: 12 }}>
          {p.error}
        </div>
      )}

      <div style={{ height: 4 }} />

      <button onClick={p.onSubmit} disabled={!p.canSubmit} style={primaryButtonStyle(p.canSubmit)}>
        <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
          {p.submitting
            ? '이동 중…'
            : p.station
              ? `${stationDisplay(p.station.name)}에서 투표하기`
              : '역을 선택해주세요'}
          {p.canSubmit && !p.submitting && <ArrowRight color="#fff" />}
        </span>
      </button>
    </div>
  );
}

// ── PlatformCard — 선택된 역의 노선 색 카드 (시안 시각 핵심) ──────────

function PlatformCard({ station }: { station: Station }) {
  // 첫 노선 기준 색 + 번호. 환승역은 첫 노선만 표시 (시각 단순화).
  const primaryLine = station.lines[0];
  const color = lineColor(primaryLine);
  const lineNum = primaryLine.replace(/호선|선/g, '').trim() || '?';
  // 노선 표기 — 시안: "수도권 전철 2호선" 같은 풀텍스트. 모든 노선 join.
  const lineText = station.lines.length > 1
    ? station.lines.join(' · ')
    : `수도권 전철 ${primaryLine}`;

  // 인접역 — neighborNames는 무방향 인접 list. 처음 2개를 prev/next로 시각화.
  // 정확한 prev/next 방향은 모르지만 사용자에게 "이 역 양쪽에 이런 역이 있다" 힌트.
  const neighbors = neighborNames(station.name, station.city);
  const prevName = neighbors[0];
  const nextName = neighbors[1];

  return (
    <div>
      {/* "역 확인됨" 라벨 */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
        <div style={{ width: 6, height: 6, borderRadius: '50%', background: TOKEN.ok }} />
        <span style={{ fontSize: 11, fontWeight: 700, color: TOKEN.ok, letterSpacing: '0.3px' }}>
          역 확인됨
        </span>
        <CheckIcon size={13} />
      </div>

      <div
        style={{
          background: TOKEN.surface, borderRadius: TOKEN.r.lg, overflow: 'hidden',
          border: `1.5px solid ${color}22`,
          boxShadow: `0 4px 22px ${color}12`,
        }}
      >
        {/* 노선 색 accent bar */}
        <div style={{ height: 4, background: color }} aria-hidden />

        <div style={{ padding: '20px 18px 18px' }}>
          {/* Badge + 역명 */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 16 }}>
            <div
              style={{
                width: 52, height: 52, borderRadius: '50%', flexShrink: 0,
                background: color,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                boxShadow: `0 4px 18px ${color}50`,
              }}
            >
              <span style={{ fontSize: 22, fontWeight: 900, color: '#fff', letterSpacing: '-0.5px' }}>{lineNum}</span>
            </div>
            <div style={{ minWidth: 0, flex: 1 }}>
              <div
                style={{
                  fontSize: 22, fontWeight: 900, color: TOKEN.text1,
                  letterSpacing: '-0.5px', lineHeight: 1.2,
                  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                }}
              >
                {stationDisplay(station.name)}
              </div>
              <div style={{ fontSize: 12, color: TOKEN.text2, marginTop: 3 }}>{lineText}</div>
            </div>
          </div>

          {/* 인접역 미니 라우트 (있는 경우만) */}
          {(prevName || nextName) && (
            <div style={{ background: TOKEN.bg, borderRadius: 10, padding: '10px 14px', marginBottom: 14 }}>
              <div style={{ display: 'flex', alignItems: 'center', marginBottom: 6 }}>
                <div style={{ width: 7, height: 7, borderRadius: '50%', background: color, opacity: prevName ? 0.32 : 0, flexShrink: 0 }} aria-hidden />
                <div style={{ flex: 1, height: 2, background: color, opacity: 0.18 }} aria-hidden />
                <div style={{ width: 11, height: 11, borderRadius: '50%', background: color, flexShrink: 0, boxShadow: `0 2px 8px ${color}55` }} aria-hidden />
                <div style={{ flex: 1, height: 2, background: color, opacity: 0.18 }} aria-hidden />
                <div style={{ width: 7, height: 7, borderRadius: '50%', background: color, opacity: nextName ? 0.32 : 0, flexShrink: 0 }} aria-hidden />
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: 11, color: TOKEN.text3, minWidth: 40 }}>{prevName ?? ''}</span>
                <span style={{ fontSize: 12, fontWeight: 700, color }}>{station.name}</span>
                <span style={{ fontSize: 11, color: TOKEN.text3, minWidth: 40, textAlign: 'right' }}>{nextName ?? ''}</span>
              </div>
            </div>
          )}

          {/* 확인 메시지 */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <CheckIcon size={14} />
            <span style={{ fontSize: 12, color: TOKEN.ok, fontWeight: 600 }}>
              이 역 승강장에서 기다리고 있어요
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
