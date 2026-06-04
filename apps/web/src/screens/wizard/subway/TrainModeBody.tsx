'use client';

// 지하철 wizard "열차 안" mode — Claude Design 'Subway Vote Redesign' 와이어프레임 반영.
// 와이어프레임은 따르고 디자인 토큰은 우리 것 (TOKEN/FONT). 핵심 원칙:
//   1. 상태별 visual hierarchy: 빈 상태=안내+steps, 매칭됨=열차 카드가 hero, 칸 선택=carstrip이 hero.
//   2. 매칭+열차확인 두 단계가 한 카드(LineCard)로 통합.
//   3. 칸 선택은 horizontal train silhouette + "칸 모름" 자연스러운 row option.
//   4. CTA 카피는 상태별 ("역 이름을 입력해주세요" / "5번 칸으로 투표하기" 등).

import { useState } from 'react';
import {
  TOKEN, FONT, lineColor, type Station,
} from '@aircon/core';
import type { SubwayMatchResult } from '../../../lib/apiClient';
import type { SubwayMatchCandidate } from '@aircon/core';
import { Label } from '../Label';
import { primaryButtonStyle } from '../styles';
import { StationAutocomplete } from './StationAutocomplete';
import { TrainCandidatePicker as CandidatePicker } from './TrainCandidatePicker';
import { LineCard } from './LineCard';
import { CarStrip, ctaCopy } from './CarStrip';

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
  pickedCandidate: SubwayMatchCandidate | null;
  onPickCandidate: (c: SubwayMatchCandidate | null) => void;
}

// 와이어프레임 SVG 아이콘 (lucide-react 안 쓰고 inline — 디자인 의도 그대로).
function ArrowRight({ color = TOKEN.text3, size = 18 }: { color?: string; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="M5 12h14M13 6l6 6-6 6" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function TrainModeBody(p: TrainModeBodyProps) {
  const bothFilled = !!p.prevStation && !!p.nextStation;
  const needsLinePick = bothFilled && p.segments.length > 1 && !p.pickedLine;
  const noMatch = bothFilled && p.segments.length === 0;
  const segReady = !!p.resolvedSegment;
  const trainConfirmed = p.trainMatch?.matched ?? false;
  // segment 인식됐는데 차량 매칭 실패 — 막차 후, 차량 간격 길거나 운영사 차단.
  // 'matched'(이 열차 맞으시죠?) 잘못 표시되어 사용자 혼란 회귀 (2026-05-29 보고).
  const noVehicle = segReady && !p.matchLoading && p.trainMatch !== null && !trainConfirmed
    && (p.trainMatch.reason === 'no_train_at_segment' || p.trainMatch.reason === 'service_closed'
        || p.trainMatch.reason === 'realtime_unsupported');

  return (
    <>
      {/* 상태별 헤드라인 */}
      <Headline state={
        bothFilled
          ? (segReady
              ? (noVehicle ? 'no-vehicle' : 'matched')
              : noMatch ? 'no-match' : 'matching')
          : 'empty'
      } />

      {/* 두 station chip 가로 배치 + 가운데 원형 swap 버튼 (Claude Design v3 시안 A 채택).
          ArrowRight(정적 →)는 swap이 안 보였음 — 원형 ⇄ 버튼으로 swap 발견성 강화. */}
      <StationRowWithSwap
        prevQuery={p.prevQuery} setPrevQuery={p.setPrevQuery}
        prevStation={p.prevStation} setPrevStation={p.setPrevStation}
        prevSuggestions={p.prevSuggestions}
        nextQuery={p.nextQuery} setNextQuery={p.setNextQuery}
        nextStation={p.nextStation} setNextStation={p.setNextStation}
        nextSuggestions={p.nextSuggestions}
      />

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
      {segReady && p.trainMatch?.reason === 'multi_candidate' && (p.trainMatch.candidates?.length ?? 0) >= 2 && (
        <CandidatePicker
          line={p.resolvedSegment!.line}
          prev={p.resolvedSegment!.prev}
          next={p.resolvedSegment!.next}
          candidates={p.trainMatch.candidates!}
          onPick={p.onPickCandidate}
        />
      )}
      {segReady && p.trainMatch?.reason !== 'multi_candidate' && (
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

function Headline({ state }: { state: 'empty' | 'matching' | 'no-match' | 'matched' | 'no-vehicle' }) {
  const config = {
    'empty':      { big: '지나온 역과\n다음 역을 알려주세요', sub: '안내방송에서 들은 역 이름을 입력하면\n열차를 자동으로 찾아드려요' },
    'matching':   { big: '잠시만요',                       sub: '두 역 사이 노선을 찾는 중이에요' },
    'no-match':   { big: '두 역이 인접해 있지 않아요',     sub: '오타가 있거나 다음 역이 아닐 수 있어요' },
    'matched':    { big: '이 열차 맞으시죠?',              sub: '아래 카드 확인 후 탄 칸을 골라주세요' },
    'no-vehicle': { big: '지금 이 구간에\n차량이 없어요',  sub: '막차 시간이 지났거나 차량 간격이 긴 시간대예요' },
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

// ── CandidatePicker — 같은 tier에 차량 2+대일 때 사용자 선택 ─────────
//
// 출퇴근 시간 헤드웨이 2~3분이면 prev/next 사이 차량 여러 대 동시에 잡힘. 우리 매칭
// 로직이 1대로 좁히기 애매한 경우 후보 list 노출 → 사용자가 본인 탑승 차량 직접 tap.
//
// 디자인: 사용자 시안 + 우리 LineCard 패턴 결합. 각 카드에 mini progress bar로 차량
// 위치 시각화 (backend가 estimateProgress 미리 계산해서 보냄).


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

// ── StationRowWithSwap — 두 station chip + 가운데 원형 swap (Claude Design v3 시안 A) ─
//
// 디자인 의도:
//   - 정적 ArrowRight(→)는 swap 발견성 0. 사용자가 prev/next 순서 잘못 입력해도
//     교환 방법을 못 찾아 "다시 입력" 흐름으로 빠짐.
//   - 원형 ⇄ 버튼 (44px tap target) — 두 칩 다 채워졌을 때 활성. 클릭 시 180° 회전
//     애니메이션 + state swap. 처음에는 hint chip, 그 후엔 "N번 바꿨어요" helper.
//   - swap 카운트가 1+ 되면 사용자 친화 helper로 hint 대체.

function StationRowWithSwap({
  prevQuery, setPrevQuery, prevStation, setPrevStation, prevSuggestions,
  nextQuery, setNextQuery, nextStation, setNextStation, nextSuggestions,
}: {
  prevQuery: string; setPrevQuery: (v: string) => void;
  prevStation: Station | null; setPrevStation: (v: Station | null) => void;
  prevSuggestions: Station[];
  nextQuery: string; setNextQuery: (v: string) => void;
  nextStation: Station | null; setNextStation: (v: Station | null) => void;
  nextSuggestions: Station[];
}) {
  const [angle, setAngle] = useState(0);
  const [swapping, setSwapping] = useState(false);
  const bothFilled = !!prevStation && !!nextStation;
  const canSwap = bothFilled && !swapping;

  const handleSwap = () => {
    if (!canSwap) return;
    setSwapping(true);
    setAngle((a) => a + 180);
    // 짧은 회전 동안 두 station 교환 (UI 깜빡임 자연스럽게).
    setTimeout(() => {
      const a = prevStation; const b = nextStation;
      setPrevStation(b); setNextStation(a);
    }, 200);
    setTimeout(() => setSwapping(false), 500);
  };

  return (
    <div style={{ marginBottom: 16 }}>
      {/* flex-start + 화살표 자체 64px height — 두 input top align 유지 (suggestion list
          펼침이 다른 input 위치에 영향 X). 화살표는 input 자체 height 가운데. */}
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 6 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <StationAutocomplete
            label="이전 역"
            query={prevQuery} setQuery={setPrevQuery}
            station={prevStation} setStation={setPrevStation}
            suggestions={prevSuggestions}
            placeholder="이전 역"
          />
        </div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, height: 64 }}>
          {bothFilled ? (
            // 두 역 다 입력 시 — 원형 swap 버튼 노출. 클릭 시 ⇄ 180° 회전 + state 교환.
            <button
              onClick={handleSwap}
              disabled={!canSwap}
              aria-label="이전 역과 다음 역 순서 바꾸기"
              style={{
                width: 44, height: 44, borderRadius: '50%', flexShrink: 0,
                background: canSwap ? TOKEN.surface : TOKEN.bg,
                border: `1.5px solid ${canSwap ? '#BFC8D6' : TOKEN.border}`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                cursor: canSwap ? 'pointer' : 'default',
                boxShadow: canSwap ? '0 2px 8px rgba(0,0,0,0.10)' : 'none',
                transition: 'background 0.2s, border-color 0.2s, box-shadow 0.2s',
                padding: 0, fontFamily: FONT,
              }}
            >
              <SwapIcon
                size={18}
                color={canSwap ? TOKEN.text1 : TOKEN.text3}
                angle={angle}
              />
            </button>
          ) : (
            // 평소엔 정적 → 화살표 (디자인 에셋 IcArrowR — size 17 color T.t3).
            <ArrowRight color={TOKEN.text3} size={17} />
          )}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <StationAutocomplete
            label="다음 역"
            query={nextQuery} setQuery={setNextQuery}
            station={nextStation} setStation={setNextStation}
            suggestions={nextSuggestions}
            placeholder="다음 역"
          />
        </div>
      </div>

      {/* swap counter / hint 모두 제거 — 사용자 가치 모호 + noise (2026-05-27 사용자 보고).
          원형 ⇄ 아이콘 자체가 affordance 충분. */}
    </div>
  );
}

function SwapIcon({ size = 18, color = '#1A1A1F', angle = 0 }: { size?: number; color?: string; angle?: number }) {
  return (
    <svg
      width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden
      style={{ transform: `rotate(${angle}deg)`, transition: 'transform 0.4s cubic-bezier(0.4, 0, 0.2, 1)' }}
    >
      {/* 위 화살표: 오른쪽 → */}
      <path d="M4 8h14M14 4l4 4-4 4" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      {/* 아래 화살표: 왼쪽 ← */}
      <path d="M20 16H6M10 12l-4 4 4 4" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

// ── LineCard — 매칭 결과 + 열차 카드 통합 ──────────────────────────


