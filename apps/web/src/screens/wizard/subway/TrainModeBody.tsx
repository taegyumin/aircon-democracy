'use client';

// 지하철 wizard "열차 안" mode — Claude Design 'Subway Vote Redesign' 와이어프레임 반영.
// 와이어프레임은 따르고 디자인 토큰은 우리 것 (TOKEN/FONT). 핵심 원칙:
//   1. 상태별 visual hierarchy: 빈 상태=안내+steps, 매칭됨=열차 카드가 hero, 칸 선택=carstrip이 hero.
//   2. 매칭+열차확인 두 단계가 한 카드(LineCard)로 통합.
//   3. 칸 선택은 horizontal train silhouette + "칸 모름" 자연스러운 row option.
//   4. CTA 카피는 상태별 ("역 이름을 입력해주세요" / "5번 칸으로 투표하기" 등).

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
            label="🔵 방금 지나간 역"
            query={p.prevQuery}
            setQuery={p.setPrevQuery}
            station={p.prevStation}
            setStation={p.setPrevStation}
            suggestions={p.prevSuggestions}
            placeholder="이전 역"
          />
        </div>
        <div style={{ display: 'flex', alignItems: 'center', flexShrink: 0, paddingTop: 32 }}>
          <ArrowRight color={bothFilled ? TOKEN.text1 : TOKEN.text3} />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <StationAutocomplete
            label="🔴 다음 도착 역"
            query={p.nextQuery}
            setQuery={p.setNextQuery}
            station={p.nextStation}
            setStation={p.setNextStation}
            suggestions={p.nextSuggestions}
            placeholder="다음 역"
          />
        </div>
      </div>

      {/* 매칭 결과 — 통합 카드 */}
      {noMatch && <NoMatchCard />}
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

function NoMatchCard() {
  return (
    <div
      style={{
        padding: '14px 16px',
        background: TOKEN.hotBg, color: TOKEN.hot,
        borderRadius: TOKEN.r.md, fontSize: 13, lineHeight: 1.6, marginBottom: 12,
        borderLeft: `3px solid ${TOKEN.hot}`,
      }}
    >
      <div style={{ fontWeight: 700, marginBottom: 4 }}>두 역이 같은 노선에 인접해 있지 않아요</div>
      <div style={{ fontSize: 11, color: TOKEN.text2 }}>오타가 있거나 다음 역이 아닐 수 있어요. 다시 확인해주세요.</div>
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

// ── LineCard — 매칭 결과 + 열차 카드 통합 ──────────────────────────

function LineCard({
  line, prev, next, trainMatch, matchLoading,
}: {
  line: string;
  prev: string;
  next: string;
  trainMatch: SubwayMatchResult | null;
  matchLoading: boolean;
}) {
  const color = lineColor(line);
  const confirmed = trainMatch?.matched ?? false;
  const trainNo = trainMatch?.trainNo;
  const destination = trainMatch?.destination;
  const lineNum = line.replace(/호선|선/g, '').trim() || '?';

  const labelText = matchLoading
    ? '열차 찾는 중…'
    : confirmed
      ? '열차 확인됨'
      : trainMatch
        ? '열차 자동 매칭 실패 — 구간 단위로 투표'
        : '노선 매칭됨';
  const labelColor = confirmed ? TOKEN.ok : color;

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
            : `0 6px 28px rgba(0,0,0,0.12)`,
          border: confirmed ? `1.5px solid ${TOKEN.ok}40` : 'none',
        }}
      >
        {/* 노선 색 accent bar */}
        <div style={{ height: 4, background: color }} />

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

          <div style={{ background: TOKEN.bg, borderRadius: TOKEN.r.sm, padding: '10px 14px' }}>
            <div style={{ display: 'flex', alignItems: 'center', marginBottom: 5 }}>
              <div style={{ width: 8, height: 8, borderRadius: '50%', background: color, flexShrink: 0 }} />
              <div style={{ flex: 1, height: 2, background: color, opacity: 0.22 }} />
              <div style={{ width: 8, height: 8, borderRadius: '50%', background: color, flexShrink: 0 }} />
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: 12, fontWeight: 700, color: TOKEN.text1 }}>{prev}</span>
              <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <div style={{ width: 5, height: 5, borderRadius: '50%', background: TOKEN.cold }} />
                <span style={{ fontSize: 10, color: TOKEN.cold, fontWeight: 600 }}>지금 여기</span>
              </div>
              <span style={{ fontSize: 12, fontWeight: 700, color: TOKEN.text1 }}>{next}</span>
            </div>
          </div>
        </div>
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

      {/* Train silhouette strip */}
      <div style={{ display: 'flex', gap: 3, justifyContent: 'center', overflowX: 'auto', paddingBottom: 4 }}>
        {CAR_OPTIONS.map((n) => {
          const sel = car === n;
          const first = n === 1;
          const last = n === CAR_OPTIONS.length;
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
