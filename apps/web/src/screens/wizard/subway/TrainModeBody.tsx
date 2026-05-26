'use client';

// 지하철 wizard "열차 안" mode — prev/next 역 입력 → 노선/방향 자동 매칭
// → (1~9호선 한정) 실시간 trainNo 매칭 → 호차 입력 → 투표.

import { TOKEN, FONT, lineColor, type Station } from '@aircon/core';
import type { SubwayMatchResult } from '../../../lib/apiClient';
import { Label } from '../Label';
import { primaryButtonStyle } from '../styles';
import { StationAutocomplete } from './StationAutocomplete';

const CAR_OPTIONS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

export interface TrainModeBodyProps {
  prevQuery: string; setPrevQuery: (v: string) => void;
  prevStation: Station | null; setPrevStation: (v: Station | null) => void;
  nextQuery: string; setNextQuery: (v: string) => void;
  nextStation: Station | null; setNextStation: (v: Station | null) => void;
  prevSuggestions: Station[];
  nextSuggestions: Station[];
  segments: { line: string; prev: string; next: string }[];
  resolvedSegment: { line: string; prev: string; next: string } | null;
  pickedLine: string | null; setPickedLine: (v: string | null) => void;
  car: number | 'unknown' | null; setCar: (v: number | 'unknown' | null) => void;
  error: string | null;
  submitting: boolean;
  canSubmit: boolean;
  onSubmit: () => void;
  trainMatch: SubwayMatchResult | null;
  matchLoading: boolean;
}

export function TrainModeBody(p: TrainModeBodyProps) {
  return (
    <>
      <div style={{ fontSize: 13, color: TOKEN.text2, marginBottom: 14, lineHeight: 1.6 }}>
        안내방송 들리는 대로 두 역만 입력하세요. 노선과 방향은 자동으로 알아낼게요.
      </div>

      <StationAutocomplete
        label="🔵 방금 지나간 역"
        query={p.prevQuery}
        setQuery={p.setPrevQuery}
        station={p.prevStation}
        setStation={p.setPrevStation}
        suggestions={p.prevSuggestions}
        placeholder="예: 강남"
      />
      <div style={{ height: 12 }} />
      <StationAutocomplete
        label="🔴 다음 도착 역"
        query={p.nextQuery}
        setQuery={p.setNextQuery}
        station={p.nextStation}
        setStation={p.setNextStation}
        suggestions={p.nextSuggestions}
        placeholder="예: 역삼"
      />

      <div style={{ height: 18 }} />

      {/* Match feedback */}
      {p.prevStation && p.nextStation && (
        <>
          {p.segments.length === 0 && (
            <div style={{ padding: '14px', background: TOKEN.hotBg, color: TOKEN.hot, borderRadius: TOKEN.r.md, fontSize: 13, lineHeight: 1.6, marginBottom: 14 }}>
              두 역이 인접해 있지 않아요.<br />
              <span style={{ fontSize: 11, color: TOKEN.text2 }}>오타가 있거나 다음역이 아닐 수 있어요. 다시 확인해주세요.</span>
            </div>
          )}
          {p.segments.length === 1 && (
            <div style={{ padding: '14px', background: TOKEN.coldBg, border: `1.5px solid ${TOKEN.cold}`, borderRadius: TOKEN.r.md, marginBottom: 14 }}>
              <div style={{ fontSize: 11, color: TOKEN.text2, marginBottom: 4 }}>자동 매칭</div>
              <div style={{ fontSize: 15, fontWeight: 800, color: TOKEN.cold, display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ width: 10, height: 10, borderRadius: '50%', background: lineColor(p.segments[0].line) }} />
                {p.segments[0].line} · {p.segments[0].prev} → {p.segments[0].next}
              </div>
            </div>
          )}
          {p.segments.length > 1 && (
            <div style={{ marginBottom: 14 }}>
              <Label>이 구간은 여러 노선이 있어요. 어느 노선?</Label>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {p.segments.map((s) => {
                  const active = p.pickedLine === s.line;
                  return (
                    <button
                      key={s.line}
                      onClick={() => p.setPickedLine(active ? null : s.line)}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 6,
                        padding: '8px 14px',
                        background: active ? lineColor(s.line) : TOKEN.surface,
                        color: active ? '#fff' : TOKEN.text1,
                        border: `1.5px solid ${active ? lineColor(s.line) : TOKEN.border}`,
                        borderRadius: 999, fontSize: 13, fontWeight: 700,
                        cursor: 'pointer', fontFamily: FONT,
                      }}
                    >
                      <span style={{ width: 10, height: 10, borderRadius: '50%', background: active ? '#fff' : lineColor(s.line) }} />
                      {s.line}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </>
      )}

      {/* Train identity card (realtime match) */}
      {p.resolvedSegment && (p.matchLoading || p.trainMatch) && (
        <div style={{
          marginBottom: 16,
          padding: '14px 16px',
          background: p.trainMatch?.matched ? '#F0FDF4' : TOKEN.surface,
          border: `1.5px solid ${p.trainMatch?.matched ? TOKEN.ok : TOKEN.border}`,
          borderRadius: TOKEN.r.md,
        }}>
          {p.matchLoading ? (
            <div style={{ fontSize: 13, color: TOKEN.text2 }}>지금 그 구간 지나는 열차 찾는 중…</div>
          ) : p.trainMatch?.matched ? (
            <div>
              <div style={{ fontSize: 11, color: TOKEN.text2, marginBottom: 4 }}>이 열차 맞으시죠?</div>
              <div style={{ fontSize: 16, fontWeight: 900, color: TOKEN.text1, letterSpacing: '-0.3px' }}>
                {p.resolvedSegment.line} · {p.trainMatch.trainNo}번 열차
              </div>
              {p.trainMatch.destination && (
                <div style={{ fontSize: 12, color: TOKEN.text2, marginTop: 2 }}>
                  {p.trainMatch.destination}행 · 현재 {p.trainMatch.currentStation}
                </div>
              )}
            </div>
          ) : (
            <div style={{ fontSize: 12, color: TOKEN.text3, lineHeight: 1.5 }}>
              지금 그 구간 지나는 열차를 못 찾았어요. 구간 단위로 투표할게요.
            </div>
          )}
        </div>
      )}

      {/* Car picker only after segment resolved */}
      {p.resolvedSegment && (
        <>
          <Label>{p.trainMatch?.matched ? '몇 번째 칸에 있어요?' : '몇 호차예요?'}</Label>
          <button
            onClick={() => p.setCar(p.car === 'unknown' ? null : 'unknown')}
            style={{
              width: '100%', padding: '14px',
              background: p.car === 'unknown' ? TOKEN.cold : TOKEN.surface,
              color: p.car === 'unknown' ? '#fff' : TOKEN.text1,
              border: `1.5px dashed ${p.car === 'unknown' ? TOKEN.cold : TOKEN.border}`,
              borderRadius: TOKEN.r.md, fontSize: 14, fontWeight: 700,
              cursor: 'pointer', fontFamily: FONT, marginBottom: 8,
            }}
          >
            {p.car === 'unknown' ? '✓ 칸 모름' : '칸 모름 — 그래도 투표할게요'}
          </button>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 8, marginBottom: 20 }}>
            {CAR_OPTIONS.map((n) => {
              const active = p.car === n;
              return (
                <button
                  key={n}
                  onClick={() => p.setCar(active ? null : n)}
                  style={{
                    padding: '12px 0',
                    background: active ? TOKEN.cold : TOKEN.surface,
                    color: active ? '#fff' : TOKEN.text1,
                    border: `1.5px solid ${active ? TOKEN.cold : TOKEN.border}`,
                    borderRadius: TOKEN.r.md,
                    fontSize: 16, fontWeight: 800, cursor: 'pointer',
                    fontFamily: FONT, fontVariantNumeric: 'tabular-nums',
                  }}
                >
                  {n}
                </button>
              );
            })}
          </div>
        </>
      )}

      {p.error && (
        <div style={{ marginBottom: 14, padding: 10, background: TOKEN.hotBg, color: TOKEN.hot, borderRadius: TOKEN.r.md, fontSize: 12 }}>{p.error}</div>
      )}

      <button onClick={p.onSubmit} disabled={!p.canSubmit} style={primaryButtonStyle(p.canSubmit)}>
        {p.submitting ? '이동 중…' : '투표하러 가기'}
      </button>
    </>
  );
}
