'use client';

// 지하철 wizard "열차 안" mode — Claude Design 'Subway Vote Redesign' 와이어프레임 반영.
// 와이어프레임은 따르고 디자인 토큰은 우리 것 (TOKEN/FONT). 핵심 원칙:
//   1. 상태별 visual hierarchy: 빈 상태=안내+steps, 매칭됨=열차 카드가 hero, 칸 선택=carstrip이 hero.
//   2. 매칭+열차확인 두 단계가 한 카드(LineCard)로 통합.
//   3. 칸 선택은 horizontal train silhouette + "칸 모름" 자연스러운 row option.
//   4. CTA 카피는 상태별 ("역 이름을 입력해주세요" / "5번 칸으로 투표하기" 등).

import {
  TOKEN, FONT, lineColor, carCountFor, stationDisplay, type Station,
} from '@aircon/core';
import type { SubwayMatchResult } from '../../../lib/apiClient';
import { Label } from '../Label';
import { primaryButtonStyle } from '../styles';
import { StationAutocomplete } from './StationAutocomplete';

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

// 와이어프레임 SVG 아이콘 (lucide-react 안 쓰고 inline — 디자인 의도 그대로).
function ArrowRight({ color = TOKEN.text3, size = 18 }: { color?: string; size?: number }) {
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

export function TrainModeBody(p: TrainModeBodyProps) {
  const bothFilled = !!p.prevStation && !!p.nextStation;
  const needsLinePick = bothFilled && p.segments.length > 1 && !p.pickedLine;
  const noMatch = bothFilled && p.segments.length === 0;
  const segReady = !!p.resolvedSegment;
  const trainConfirmed = p.trainMatch?.matched ?? false;

  return (
    <>
      {/* 상태별 헤드라인 */}
      <Headline state={bothFilled ? (segReady ? 'matched' : noMatch ? 'no-match' : 'matching') : 'empty'} />

      {/* 두 station chip 가로 배치 */}
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, marginBottom: 16 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <StationAutocomplete
            label="이전 역"
            query={p.prevQuery}
            setQuery={p.setPrevQuery}
            station={p.prevStation}
            setStation={p.setPrevStation}
            suggestions={p.prevSuggestions}
            placeholder="이전 역"
          />{/* placeholder는 input hint — label과 같아도 한 번만 노출 */}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', flexShrink: 0, paddingTop: 32 }}>
          <ArrowRight color={bothFilled ? TOKEN.text1 : TOKEN.text3} />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <StationAutocomplete
            label="다음 역"
            query={p.nextQuery}
            setQuery={p.setNextQuery}
            station={p.nextStation}
            setStation={p.setNextStation}
            suggestions={p.nextSuggestions}
            placeholder="다음 역"
          />
        </div>
      </div>

      {/* 인접역 chip은 제거 — 한쪽 입력 시 SubwayWizard suggestions가 인접역으로 채워지고,
          반대편 input의 list 자리에 그대로 표시됨 (검색창에 텍스트 입력 시 전체 검색으로 교체). */}

      {/* 매칭 결과 — 통합 카드 */}
      {noMatch && (
        <NoMatchCard
          onResetBoth={() => {
            p.setPrevStation(null); p.setNextStation(null);
            p.setPrevQuery(''); p.setNextQuery('');
          }}
          onSwap={() => {
            const a = p.prevStation;
            const b = p.nextStation;
            p.setPrevStation(b);
            p.setNextStation(a);
          }}
        />
      )}
      {needsLinePick && (
        <LinePickerCard
          segments={p.segments}
          pickedLine={p.pickedLine}
          onPick={p.setPickedLine}
        />
      )}
      {segReady && (
        <LineCard
          line={p.resolvedSegment!.line}
          prev={p.resolvedSegment!.prev}
          next={p.resolvedSegment!.next}
          trainMatch={p.trainMatch}
          matchLoading={p.matchLoading}
          onResetBoth={() => {
            p.setPrevStation(null); p.setNextStation(null);
            p.setPrevQuery(''); p.setNextQuery('');
          }}
          onSwap={() => {
            const a = p.prevStation;
            const b = p.nextStation;
            p.setPrevStation(b);
            p.setNextStation(a);
          }}
        />
      )}

      {/* 진행 순서 안내 (빈 상태일 때만) */}
      {!bothFilled && <ProgressSteps activeStep={p.prevStation || p.nextStation ? 1 : 0} />}

      {/* 칸 선택 — segment resolved 후에만 */}
      {segReady && (
        <div style={{ marginTop: 22 }}>
          <CarStrip
            car={p.car}
            setCar={p.setCar}
            line={p.resolvedSegment!.line}
            trainConfirmed={trainConfirmed}
            destination={p.trainMatch?.destination}
          />
        </div>
      )}

      {p.error && (
        <div style={{ marginTop: 14, padding: 10, background: TOKEN.hotBg, color: TOKEN.hot, borderRadius: TOKEN.r.md, fontSize: 12 }}>
          {p.error}
        </div>
      )}

      <div style={{ height: 24 }} />

      {/* 상태별 CTA */}
      <button onClick={p.onSubmit} disabled={!p.canSubmit} style={primaryButtonStyle(p.canSubmit)}>
        <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
          {ctaCopy({
            submitting: p.submitting,
            bothFilled,
            segReady,
            car: p.car,
            trainConfirmed,
          })}
          {p.canSubmit && !p.submitting && <ArrowRight color="#fff" size={18} />}
        </span>
      </button>
    </>
  );
}

// ── Headline ────────────────────────────────────────────────────────

function Headline({ state }: { state: 'empty' | 'matching' | 'no-match' | 'matched' }) {
  const config = {
    'empty':    { big: '지나온 역과\n다음 역을 알려주세요', sub: '안내방송에서 들은 역 이름을 입력하면\n열차를 자동으로 찾아드려요' },
    'matching': { big: '잠시만요',                       sub: '두 역 사이 노선을 찾는 중이에요' },
    'no-match': { big: '두 역이 인접해 있지 않아요',     sub: '오타가 있거나 다음 역이 아닐 수 있어요' },
    'matched':  { big: '이 열차 맞으시죠?',              sub: '아래 카드 확인 후 탄 칸을 골라주세요' },
  }[state];
  return (
    <div style={{ marginBottom: 18 }}>
      <div
        style={{
          fontSize: 22, fontWeight: 900, color: TOKEN.text1,
          letterSpacing: '-0.5px', lineHeight: 1.35, marginBottom: 8,
          whiteSpace: 'pre-line',
        }}
      >
        {config.big}
      </div>
      <div style={{ fontSize: 13, color: TOKEN.text2, lineHeight: 1.7, whiteSpace: 'pre-line' }}>
        {config.sub}
      </div>
    </div>
  );
}

// ── Progress steps (빈 상태 안내) ────────────────────────────────────

function ProgressSteps({ activeStep }: { activeStep: number }) {
  const steps = [
    { n: 1, label: '이전 역 · 다음 역 입력' },
    { n: 2, label: '열차 자동 매칭 · 확인' },
    { n: 3, label: '내가 탄 칸 번호 선택' },
    { n: 4, label: '투표' },
  ];
  return (
    <div style={{ background: TOKEN.surface, borderRadius: TOKEN.r.lg, padding: '18px', marginTop: 6 }}>
      <div style={{ fontSize: 10, fontWeight: 700, color: TOKEN.text3, letterSpacing: '1.5px', textTransform: 'uppercase', marginBottom: 14 }}>
        진행 순서
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 13 }}>
        {steps.map((s) => {
          const active = s.n === activeStep + 1;
          return (
            <div key={s.n} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div
                style={{
                  width: 24, height: 24, borderRadius: '50%', flexShrink: 0,
                  background: active ? TOKEN.cold : TOKEN.bg,
                  border: `1.5px solid ${active ? TOKEN.cold : TOKEN.border}`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}
              >
                <span style={{ fontSize: 11, fontWeight: 700, color: active ? '#fff' : TOKEN.text3 }}>
                  {s.n}
                </span>
              </div>
              <span style={{ fontSize: 13, color: active ? TOKEN.text1 : TOKEN.text3, fontWeight: active ? 600 : 400 }}>
                {s.label}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── No-match card ───────────────────────────────────────────────────
// Claude Design 시안 3b: amber 톤 + icon + reasons + 2 actions
// (다시 입력하기 / 순서 바꾸기). "역 이름 수정하기"는 우리는 선택지 기반이라 제외.

const AMBER = '#D97706';
const AMBER_BG = '#FFFBEB';
const AMBER_BORDER = '#FDE68A';
const AMBER_TEXT = '#92400E';

function SearchFailIcon() {
  return (
    <svg width={28} height={28} viewBox="0 0 28 28" fill="none" aria-hidden>
      <circle cx="12" cy="12" r="8" stroke={AMBER} strokeWidth="2.2" />
      <path d="M18 18l6 6" stroke={AMBER} strokeWidth="2.2" strokeLinecap="round" />
      <path d="M10 9.5c0-1.1.9-2 2-2s2 .9 2 2c0 1.3-2 1.5-2 3" stroke={AMBER} strokeWidth="1.8" strokeLinecap="round" />
      <circle cx="12" cy="15.5" r="0.9" fill={AMBER} />
    </svg>
  );
}

function NoMatchCard({ onResetBoth, onSwap }: { onResetBoth: () => void; onSwap: () => void }) {
  return (
    <div style={{ marginBottom: 14 }}>
      {/* Label */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
        <div style={{ width: 6, height: 6, borderRadius: '50%', background: AMBER }} />
        <span style={{ fontSize: 11, fontWeight: 700, color: AMBER, letterSpacing: '0.3px' }}>
          열차를 찾을 수 없어요
        </span>
      </div>

      <div
        style={{
          background: TOKEN.surface, borderRadius: TOKEN.r.lg, overflow: 'hidden',
          border: `1.5px solid ${AMBER_BORDER}`,
          boxShadow: '0 3px 14px rgba(217,119,6,0.10)',
        }}
      >
        {/* Amber accent bar */}
        <div style={{ height: 4, background: `linear-gradient(90deg, ${AMBER}, #FBBF24)` }} aria-hidden />

        <div style={{ padding: '22px 18px 20px' }}>
          {/* Icon + headline */}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', marginBottom: 18 }}>
            <div
              style={{
                width: 56, height: 56, borderRadius: '50%',
                background: AMBER_BG, border: `1.5px solid ${AMBER_BORDER}`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                marginBottom: 14,
              }}
            >
              <SearchFailIcon />
            </div>
            <div style={{ fontSize: 15, fontWeight: 700, color: TOKEN.text1, letterSpacing: '-0.3px', lineHeight: 1.4, marginBottom: 6 }}>
              이 두 역 사이 열차를<br />찾을 수 없어요
            </div>
            <div style={{ fontSize: 12, color: TOKEN.text2, lineHeight: 1.6 }}>
              순서가 반대일 수도 있고, 인접하지 않은 역일 수도 있어요
            </div>
          </div>

          {/* Reasons */}
          <div style={{ background: AMBER_BG, borderRadius: 10, padding: '12px 14px', marginBottom: 16 }}>
            {[
              '안내방송에서 들은 순서대로 입력했는지 확인해주세요',
              '두 역이 같은 노선이 아닐 수 있어요',
              '인접하지 않은 역일 수 있어요',
            ].map((r, i) => (
              <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'flex-start', marginTop: i > 0 ? 8 : 0 }}>
                <div style={{ width: 4, height: 4, borderRadius: '50%', background: AMBER, marginTop: 6, flexShrink: 0 }} aria-hidden />
                <span style={{ fontSize: 12, color: AMBER_TEXT, lineHeight: 1.5 }}>{r}</span>
              </div>
            ))}
          </div>

          {/* Recovery actions — 우리는 선택지 기반이라 "역 이름 수정하기" 없음.
              "다시 입력하기" (primary) + "순서 바꾸기" (secondary) 두 개. */}
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              onClick={onResetBoth}
              style={{
                flex: 3, padding: '13px 0', background: TOKEN.cold, color: '#fff',
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
                flex: 2, padding: '13px 0', background: TOKEN.bg, color: TOKEN.text2,
                border: `1px solid ${TOKEN.border}`, borderRadius: 12, fontSize: 12,
                cursor: 'pointer', fontFamily: FONT,
              }}
            >
              순서 바꾸기
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Multi-line picker (여러 노선 중 선택) ─────────────────────────

function LinePickerCard({
  segments, pickedLine, onPick,
}: {
  segments: { line: string; prev: string; next: string }[];
  pickedLine: string | null;
  onPick: (line: string | null) => void;
}) {
  return (
    <div style={{ marginBottom: 12 }}>
      <Label>이 구간은 여러 노선이 있어요. 어느 노선?</Label>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
        {segments.map((s) => {
          const active = pickedLine === s.line;
          const color = lineColor(s.line);
          return (
            <button
              key={s.line}
              onClick={() => onPick(active ? null : s.line)}
              style={{
                display: 'flex', alignItems: 'center', gap: 6,
                padding: '8px 14px',
                background: active ? color : TOKEN.surface,
                color: active ? '#fff' : TOKEN.text1,
                border: `1.5px solid ${active ? color : TOKEN.border}`,
                borderRadius: 999, fontSize: 13, fontWeight: 700,
                cursor: 'pointer', fontFamily: FONT,
              }}
            >
              <span style={{ width: 10, height: 10, borderRadius: '50%', background: active ? '#fff' : color }} />
              {s.line}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// CandidateChips 제거 — suggestions list 자리에 통합 (2026-05-27).

// ── LineCard — 매칭 결과 + 열차 카드 통합 ──────────────────────────

function LineCard({
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
  // realtime 매칭 시도했는데 실패 (1~9호선이고 응답 받았지만 그 시점에 차량 없음).
  const realtimeFailed = !!trainMatch && !confirmed && !matchLoading;
  const trainNo = trainMatch?.trainNo;
  const destination = trainMatch?.destination;
  const lineNum = line.replace(/호선|선/g, '').trim() || '?';

  const labelText = matchLoading
    ? '열차 찾는 중…'
    : confirmed
      ? '열차 확인됨'
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
        {/* accent bar — realtime 실패 시 amber gradient, 그 외엔 노선 색 */}
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

          {/* realtime 매칭 실패면 RouteViz 자체 의미 없음 (열차 위치 모름).
              prev/next 트랙이 보이면 "매칭된 척" 오인 — 단순 구간 라인으로 대체. */}
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

          {/* realtime 매칭 실패 시 — 입력 오류 가능성 안내 + recovery actions.
              swopenAPI가 일부 노선(신림선/경전철 등)을 안 줄 수 있으나, 가드는 풀려 있어
              사용자 입장에선 동일 케이스로 보임. */}
          {realtimeFailed && (
            <div style={{ marginTop: 14 }}>
              <div style={{ fontSize: 11, color: AMBER_TEXT, lineHeight: 1.5, marginBottom: 12 }}>
                혹시 역 이름·순서가 잘못됐을 수도 있어요. 다시 확인하거나 그대로 구간 단위로 투표하세요.
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

// ── SegmentLine — realtime 매칭 실패 시 단순 구간 표시 (열차 위치 hint 없음) ───

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

// ── RouteViz — Claude Design 시안 A: mini-train slides along track ──────
// swopenAPI 진행도 (statnNm + trainSttus → 0~1) 기반. progress 없으면 fallback.

function MiniTrain({ color, w = 32, h = 14 }: { color: string; w?: number; h?: number }) {
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

function RouteViz({
  prev, next, color, progress, progressLabel,
}: {
  prev: string;
  next: string;
  color: string;
  progress: number | null;
  progressLabel: SubwayMatchResult['progressLabel'] | null;
}) {
  // 실시간 progress 있을 때만 mini-train + state 텍스트 노출.
  // 없으면 (매칭 실패, 비-1~9호선 등) viz는 정적 트랙 + 양 끝 dot만 — 사용자가
  // '열차가 가운데 있다'고 오해하지 않게 (LLM 사용자 피드백 2026-05-27).
  const hasProgress = typeof progress === 'number';
  const pos = hasProgress ? Math.max(0, Math.min(1, progress)) : 0;
  const atDest = pos >= 1;
  const MAR = 7;
  const DOT = 14;
  const trainLeft = `calc(${MAR}px + ${pos} * (100% - ${MAR * 2}px) - 16px)`;
  const fillWidth = hasProgress ? `calc(${pos} * (100% - ${MAR * 2}px))` : '0';

  // progressLabel → 사람 친화 텍스트. hasProgress 없으면 텍스트 자체 미표시.
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
        {/* Full track */}
        <div style={{ position: 'absolute', top: 14, left: MAR, right: MAR, height: 3, background: TOKEN.border, borderRadius: 2 }} />
        {/* Filled track (progress 있을 때만 의미 있음) */}
        {hasProgress && (
          <div style={{ position: 'absolute', top: 14, left: MAR, width: fillWidth, height: 3, background: color, borderRadius: 2 }} />
        )}
        {/* Left station dot (prev) */}
        <div style={{
          position: 'absolute', top: 7, left: 0,
          width: DOT, height: DOT, borderRadius: '50%',
          background: color, border: '2px solid #fff',
          boxShadow: `0 2px 8px ${color}55`, zIndex: 2,
        }} />
        {/* Right station dot (next) */}
        <div style={{
          position: 'absolute', top: 7, right: 0,
          width: DOT, height: DOT, borderRadius: '50%',
          background: hasProgress && atDest ? color : TOKEN.border,
          border: '2px solid #fff',
          boxShadow: hasProgress && atDest ? `0 2px 8px ${color}55` : 'none',
          zIndex: 2,
        }} />
        {/* Mini train icon — progress 있을 때만 (위치 알 때만 표시) */}
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

// ── CarStrip — horizontal train silhouette + 칸 모름 ───────────────

function CarStrip({
  car, setCar, line, trainConfirmed, destination,
}: {
  car: number | 'unknown' | null;
  setCar: (v: number | 'unknown' | null) => void;
  line: string;
  trainConfirmed: boolean;
  destination?: string;
}) {
  const unknownSel = car === 'unknown';
  const lc = lineColor(line);
  // 노선별 차량 수 (1편성). 신림선/경전철 = 2, 9호선 = 4, 1~4호선 = 10 등.
  // 잘못된 선택 차단 + 사용자가 '10량까지 있는데 우리 노선엔 그렇게 안 됨' 혼동 방지.
  const carCount = carCountFor(line);
  const carOptions = Array.from({ length: carCount }, (_, i) => i + 1);

  return (
    <div>
      <div
        style={{
          fontSize: 15, fontWeight: 700, color: TOKEN.text1,
          marginBottom: 12, letterSpacing: '-0.3px',
        }}
      >
        {trainConfirmed ? '몇 번째 칸에 타고 계세요?' : '몇 호차예요?'}
      </div>

      {/* Train silhouette strip — 노선별 carCount 만큼 칸 표시. */}
      <div style={{ display: 'flex', gap: 3, justifyContent: 'center', overflowX: 'auto', paddingBottom: 4 }}>
        {carOptions.map((n) => {
          const sel = car === n;
          const first = n === 1;
          const last = n === carOptions.length;
          return (
            <button
              key={n}
              onClick={() => setCar(sel ? null : n)}
              style={{
                width: 30, height: 52, flexShrink: 0, cursor: 'pointer',
                borderRadius: first ? '9px 3px 3px 9px' : last ? '3px 9px 9px 3px' : 3,
                border: `2px solid ${sel ? TOKEN.cold : TOKEN.border}`,
                background: sel ? TOKEN.cold : TOKEN.surface,
                display: 'flex', flexDirection: 'column', alignItems: 'center',
                justifyContent: 'flex-end', paddingBottom: 7, position: 'relative',
                boxShadow: sel ? `0 4px 14px ${TOKEN.cold}40` : '0 1px 3px rgba(0,0,0,0.05)',
                transition: 'all 0.15s', fontFamily: FONT,
              }}
              aria-label={`${n}호차`}
            >
              <div
                style={{
                  position: 'absolute', top: 8, left: 4, right: 4, height: 14, borderRadius: 2,
                  border: `1.5px solid ${sel ? 'rgba(255,255,255,0.3)' : TOKEN.border}`,
                  background: sel ? 'rgba(255,255,255,0.12)' : TOKEN.bg,
                }}
                aria-hidden
              />
              <span style={{ fontSize: 11, fontWeight: 700, color: sel ? '#fff' : TOKEN.text2, position: 'relative', zIndex: 1 }}>
                {n}
              </span>
            </button>
          );
        })}
      </div>

      {destination && (
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 8 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
            <ArrowRight color={TOKEN.text3} size={11} />
            <span style={{ fontSize: 10, color: TOKEN.text3 }}>앞 ({destination} 방향)</span>
          </div>
          <span style={{ fontSize: 10, color: TOKEN.text3 }}>뒤</span>
        </div>
      )}

      <button
        onClick={() => setCar(unknownSel ? null : 'unknown')}
        style={{
          marginTop: 12, width: '100%', padding: '12px 0',
          background: unknownSel ? TOKEN.coldBg : 'transparent',
          border: `1.5px solid ${unknownSel ? TOKEN.cold : TOKEN.border}`,
          borderRadius: TOKEN.r.sm, fontSize: 13,
          color: unknownSel ? TOKEN.cold : TOKEN.text2,
          fontWeight: unknownSel ? 700 : 400,
          cursor: 'pointer', fontFamily: FONT,
        }}
      >
        칸 번호를 잘 모르겠어요
      </button>

      <div style={{ height: 2, background: lc, opacity: 0.15, marginTop: 12, borderRadius: 1 }} aria-hidden />
    </div>
  );
}

// ── CTA copy ────────────────────────────────────────────────────────

function ctaCopy({
  submitting, bothFilled, segReady, car, trainConfirmed,
}: {
  submitting: boolean;
  bothFilled: boolean;
  segReady: boolean;
  car: number | 'unknown' | null;
  trainConfirmed: boolean;
}): string {
  if (submitting) return '이동 중…';
  if (!bothFilled) return '역 이름을 입력해주세요';
  if (!segReady) return '구간을 확인해주세요';
  if (car === null) return '탄 칸을 선택해주세요';
  const carLabel = car === 'unknown' ? '칸 미정' : `${car}번 칸`;
  return trainConfirmed ? `${carLabel}으로 투표하기` : `${carLabel} 구간으로 투표하기`;
}
