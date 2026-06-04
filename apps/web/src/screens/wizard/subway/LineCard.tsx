'use client';

// LineCard — 매칭된 노선 + 차량 결과 통합 카드 + RouteViz + MiniTrain + SegmentLine.
// TrainModeBody.tsx에서 추출 (V4 (C) #2).

import { TOKEN, FONT, lineColor } from '@aircon/core';
import type { SubwayMatchResult } from '../../../lib/apiClient';

// realtime 실패 시 amber accent (LineCard 안에서만 사용).
const AMBER = '#D97706';
const AMBER_BORDER = '#FDE68A';
const AMBER_TEXT = '#92400E';

function ArrowRight({ color = TOKEN.text3, size = 14 }: { color?: string; size?: number }) {
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

// Subway mini train silhouette — RouteViz와 CandidatePicker MiniProgressBar 둘 다 사용.
export function MiniTrain({ color, w = 32, h = 14 }: { color: string; w?: number; h?: number }) {
  return (
    <svg width={w} height={h} viewBox="0 0 32 14" fill="none" aria-hidden>
      <rect x="0.5" y="0.5" width="31" height="11" rx="3" fill={color} />
      <rect x="2"  y="2" width="6" height="5" rx="1" fill="rgba(255,255,255,0.45)" />
      <rect x="10" y="2" width="6" height="5" rx="1" fill="rgba(255,255,255,0.45)" />
      <rect x="18" y="2" width="6" height="5" rx="1" fill="rgba(255,255,255,0.45)" />
      <rect x="26" y="1" width="5" height="10" rx="2" fill="rgba(255,255,255,0.18)" />
      <circle cx="7"  cy="13" r="1.5" fill={color} />
      <circle cx="23" cy="13" r="1.5" fill={color} />
    </svg>
  );
}

export function LineCard({
  line, prev, next, trainMatch, matchLoading, onResetBoth, onSwap,
}: {
  line: string;
  prev: string;
  next: string;
  trainMatch: SubwayMatchResult | null;
  matchLoading: boolean;
  onResetBoth: () => void;
  onSwap: () => void;
}) {
  const color = lineColor(line);
  const confirmed = trainMatch?.matched ?? false;
  const realtimeFailed = !!trainMatch && !confirmed && !matchLoading;
  const serviceClosed = trainMatch?.reason === 'service_closed';
  const realtimeUnsupported = trainMatch?.reason === 'realtime_unsupported';
  const trainNo = trainMatch?.trainNo;
  const destination = trainMatch?.destination;
  const lineNum = line.replace(/호선|선/g, '').trim() || '?';

  const labelText = matchLoading
    ? '열차 찾는 중…'
    : confirmed
      ? '열차 확인됨'
      : serviceClosed
        ? '운행 시간이 아니에요'
        : realtimeUnsupported
          ? '이 노선은 실시간 정보 없음'
          : realtimeFailed
            ? '지금 운행 중인 열차를 찾지 못했어요'
            : '노선 매칭됨';
  const labelColor = confirmed ? TOKEN.ok : realtimeFailed ? AMBER : color;

  return (
    <div style={{ marginBottom: 12 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
        <div style={{ width: 6, height: 6, borderRadius: '50%', background: labelColor }} />
        <span style={{ fontSize: 11, fontWeight: 700, color: labelColor, letterSpacing: '0.3px' }}>
          {labelText}
        </span>
        {confirmed && <CheckIcon size={13} />}
      </div>

      <div
        style={{
          background: TOKEN.surface, borderRadius: TOKEN.r.lg, overflow: 'hidden',
          boxShadow: confirmed
            ? `0 2px 12px rgba(0,0,0,0.07)`
            : realtimeFailed
              ? '0 3px 14px rgba(217,119,6,0.10)'
              : `0 6px 28px rgba(0,0,0,0.12)`,
          border: confirmed
            ? `1.5px solid ${TOKEN.ok}40`
            : realtimeFailed
              ? `1.5px solid ${AMBER_BORDER}`
              : 'none',
        }}
      >
        <div
          style={{
            height: 4,
            background: realtimeFailed ? `linear-gradient(90deg, ${AMBER}, #FBBF24)` : color,
          }}
        />

        <div style={{ padding: '18px 18px 16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 12 }}>
            <div
              style={{
                width: 44, height: 44, borderRadius: '50%', background: color, flexShrink: 0,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                boxShadow: `0 4px 14px ${color}50`,
              }}
            >
              <span style={{ fontSize: 18, fontWeight: 900, color: '#fff' }}>{lineNum}</span>
            </div>
            <div style={{ minWidth: 0, flex: 1 }}>
              <div
                style={{
                  fontSize: 20, fontWeight: 900, color: TOKEN.text1,
                  letterSpacing: '-0.4px', lineHeight: 1.2,
                  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                }}
              >
                {destination ? `${destination}행` : line}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginTop: 3, flexWrap: 'wrap' }}>
                <span style={{ fontSize: 12, color: TOKEN.text2 }}>{line}</span>
                {trainNo && (
                  <>
                    <span style={{ color: TOKEN.border }}>·</span>
                    <span style={{ fontSize: 12, color: TOKEN.text2, fontVariantNumeric: 'tabular-nums' }}>
                      {trainNo}호
                    </span>
                  </>
                )}
              </div>
            </div>
          </div>

          {realtimeFailed ? (
            <SegmentLine prev={prev} next={next} />
          ) : (
            <RouteViz
              prev={prev}
              next={next}
              color={color}
              progress={trainMatch?.progress ?? null}
              progressLabel={trainMatch?.progressLabel ?? null}
            />
          )}

          {realtimeFailed && (
            <div style={{ marginTop: 14 }}>
              <div style={{ fontSize: 11, color: AMBER_TEXT, lineHeight: 1.5, marginBottom: 12 }}>
                {serviceClosed
                  ? '지금 이 노선에 운행 중인 차량이 없어요. 운행 시간이 아닐 가능성이 커요. 그래도 구간 단위로 투표할 수 있어요.'
                  : realtimeUnsupported
                    ? '이 노선은 실시간 차량 정보를 제공하지 않아요 (김포골드라인 등). 그래도 구간 단위로 투표할 수 있어요.'
                    : '혹시 역 이름·순서가 잘못됐을 수도 있어요. 다시 확인하거나 그대로 구간 단위로 투표하세요.'}
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button
                  onClick={onResetBoth}
                  style={{
                    flex: 3, padding: '12px 0', background: TOKEN.cold, color: '#fff',
                    border: 'none', borderRadius: 12, fontSize: 13, fontWeight: 700,
                    cursor: 'pointer', fontFamily: FONT,
                    boxShadow: `0 4px 14px ${TOKEN.cold}40`,
                  }}
                >
                  다시 입력하기
                </button>
                <button
                  onClick={onSwap}
                  style={{
                    flex: 2, padding: '12px 0', background: TOKEN.bg, color: TOKEN.text2,
                    border: `1px solid ${TOKEN.border}`, borderRadius: 12, fontSize: 12,
                    cursor: 'pointer', fontFamily: FONT,
                  }}
                >
                  순서 바꾸기
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// SegmentLine — realtime 매칭 실패 시 단순 구간 표시 (열차 위치 hint 없음).
function SegmentLine({ prev, next }: { prev: string; next: string }) {
  return (
    <div
      style={{
        background: TOKEN.bg, borderRadius: TOKEN.r.sm, padding: '14px 16px',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10,
      }}
    >
      <span style={{ fontSize: 13, fontWeight: 700, color: TOKEN.text1 }}>{prev}</span>
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, opacity: 0.6 }}>
        <div style={{ flex: 1, height: 2, background: TOKEN.border, borderRadius: 1 }} aria-hidden />
        <ArrowRight color={TOKEN.text3} size={14} />
        <div style={{ flex: 1, height: 2, background: TOKEN.border, borderRadius: 1 }} aria-hidden />
      </div>
      <span style={{ fontSize: 13, fontWeight: 700, color: TOKEN.text1 }}>{next}</span>
    </div>
  );
}

// RouteViz — Claude Design 시안 A: mini-train slides along track.
// swopenAPI 진행도(statnNm + trainSttus → 0~1) 기반. progress 없으면 fallback.
function RouteViz({
  prev, next, color, progress, progressLabel,
}: {
  prev: string;
  next: string;
  color: string;
  progress: number | null;
  progressLabel: SubwayMatchResult['progressLabel'] | null;
}) {
  const hasProgress = typeof progress === 'number';
  const pos = hasProgress ? Math.max(0, Math.min(1, progress)) : 0;
  const atDest = pos >= 1;
  const MAR = 7;
  const DOT = 14;
  const trainLeft = `calc(${MAR}px + ${pos} * (100% - ${MAR * 2}px) - 16px)`;
  const fillWidth = hasProgress ? `calc(${pos} * (100% - ${MAR * 2}px))` : '0';

  const stateText = !hasProgress ? null
    : progressLabel === 'at-prev' ? `${prev} 정차 중`
    : progressLabel === 'just-left-prev' ? `${prev} 막 출발`
    : progressLabel === 'between' ? '이동 중'
    : progressLabel === 'approaching-next' ? `${next} 거의 도착`
    : progressLabel === 'at-next' ? `${next} 정차 중`
    : null;

  return (
    <div style={{ background: TOKEN.bg, borderRadius: TOKEN.r.sm, padding: '12px 14px 10px' }}>
      <div style={{ position: 'relative', height: 32, marginBottom: 8 }}>
        <div style={{ position: 'absolute', top: 14, left: MAR, right: MAR, height: 3, background: TOKEN.border, borderRadius: 2 }} />
        {hasProgress && (
          <div style={{ position: 'absolute', top: 14, left: MAR, width: fillWidth, height: 3, background: color, borderRadius: 2 }} />
        )}
        <div style={{
          position: 'absolute', top: 7, left: 0,
          width: DOT, height: DOT, borderRadius: '50%',
          background: color, border: '2px solid #fff',
          boxShadow: `0 2px 8px ${color}55`, zIndex: 2,
        }} />
        <div style={{
          position: 'absolute', top: 7, right: 0,
          width: DOT, height: DOT, borderRadius: '50%',
          background: hasProgress && atDest ? color : TOKEN.border,
          border: '2px solid #fff',
          boxShadow: hasProgress && atDest ? `0 2px 8px ${color}55` : 'none',
          zIndex: 2,
        }} />
        {hasProgress && (
          <div style={{ position: 'absolute', top: -4, left: trainLeft, zIndex: 3 }}>
            <MiniTrain color={color} />
          </div>
        )}
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontSize: 12, fontWeight: 700, color: TOKEN.text1 }}>{prev}</span>
        {stateText && (
          <span style={{ fontSize: 10, color, fontWeight: 700 }}>
            {stateText}
          </span>
        )}
        <span style={{ fontSize: 12, fontWeight: atDest ? 900 : 700, color: TOKEN.text1 }}>{next}</span>
      </div>
    </div>
  );
}
