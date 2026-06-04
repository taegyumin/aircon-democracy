'use client';

// Subway CandidatePicker — 같은 segment에 차량 2+ 발견 시 사용자 선택.
// TrainModeBody.tsx에서 추출 (V4 (C) #2). + CandidateCard + MiniProgressBar + sttusToLabel.

import { TOKEN, FONT, lineColor } from '@aircon/core';
import type { SubwayMatchCandidate } from '@aircon/core';
import { MiniTrain } from './LineCard';

export function TrainCandidatePicker({
  line, prev, next, candidates, onPick,
}: {
  line: string;
  prev: string;
  next: string;
  candidates: SubwayMatchCandidate[];
  onPick: (c: SubwayMatchCandidate | null) => void;
}) {
  const color = lineColor(line);
  return (
    <div style={{ marginBottom: 12 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
        <div style={{ width: 6, height: 6, borderRadius: '50%', background: color }} />
        <span style={{ fontSize: 11, fontWeight: 700, color, letterSpacing: '0.3px' }}>
          어느 열차에 타고 계세요?
        </span>
      </div>

      <div
        style={{
          background: TOKEN.coldBg, borderRadius: TOKEN.r.md,
          padding: '12px 14px', marginBottom: 10,
          display: 'flex', alignItems: 'flex-start', gap: 8,
        }}
      >
        <div style={{ width: 6, height: 6, borderRadius: '50%', background: TOKEN.cold, marginTop: 6, flexShrink: 0 }} aria-hidden />
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: TOKEN.text1, letterSpacing: '-0.2px', marginBottom: 2 }}>
            구간에 열차가 {candidates.length}대 운행 중이에요
          </div>
          <div style={{ fontSize: 11, color: TOKEN.text2, lineHeight: 1.5 }}>
            내가 탄 열차의 위치와 가장 비슷한 걸 탭해주세요
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {candidates.map((c) => (
          <CandidateCard key={c.trainNo} line={line} prev={prev} next={next} cand={c} onPick={() => onPick(c)} />
        ))}
      </div>
    </div>
  );
}

function CandidateCard({
  line, prev, next, cand, onPick,
}: {
  line: string;
  prev: string;
  next: string;
  cand: SubwayMatchCandidate;
  onPick: () => void;
}) {
  const color = lineColor(line);
  const sttusLabel = sttusToLabel(cand.trainSttus);
  return (
    <button
      onClick={onPick}
      style={{
        width: '100%', textAlign: 'left', background: TOKEN.surface,
        border: `1px solid ${TOKEN.border}`, borderRadius: TOKEN.r.md,
        padding: '12px 14px', cursor: 'pointer', fontFamily: FONT,
        boxShadow: '0 1px 5px rgba(0,0,0,0.04)',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
        <span
          style={{
            fontSize: 10, fontWeight: 700, color: '#fff',
            background: color, padding: '2px 8px', borderRadius: 6,
            fontVariantNumeric: 'tabular-nums',
          }}
        >
          {cand.trainNo.slice(0, 2)}
        </span>
        <span style={{ fontSize: 14, fontWeight: 700, color: TOKEN.text1, letterSpacing: '-0.2px' }}>
          {cand.trainNo}호
        </span>
        <span style={{ fontSize: 11, color: TOKEN.text3 }}>·</span>
        <span style={{ fontSize: 12, color: TOKEN.text2 }}>{sttusLabel}</span>
        <div style={{ flex: 1 }} />
        {cand.destination && (
          <span style={{ fontSize: 10, color: TOKEN.text3 }}>{cand.destination}행</span>
        )}
      </div>

      <MiniProgressBar prev={prev} next={next} progress={cand.progress ?? null} color={color} />
    </button>
  );
}

// 카드용 미니 진행도 바 — RouteViz보다 compact. progress 0~1 (estimateProgress 결과).
function MiniProgressBar({ prev, next, progress, color }: { prev: string; next: string; progress: number | null; color: string }) {
  const pct = progress != null ? Math.max(0, Math.min(1, progress)) * 100 : 0;
  return (
    <div>
      <div style={{ position: 'relative', height: 6, background: TOKEN.bg, borderRadius: 3 }}>
        <div
          style={{
            position: 'absolute', left: 0, top: 0, bottom: 0,
            width: `${pct}%`, background: color, borderRadius: 3,
            transition: 'width 240ms',
          }}
        />
        <div
          style={{
            position: 'absolute', left: `${pct}%`, top: -7,
            transform: 'translateX(-50%)',
            pointerEvents: 'none',
            filter: 'drop-shadow(0 1px 2px rgba(0,0,0,0.18))',
          }}
        >
          <MiniTrain color={color} w={28} h={12} />
        </div>
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 8 }}>
        <span style={{ fontSize: 10, color: TOKEN.text3, maxWidth: '45%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{prev}</span>
        <span style={{ fontSize: 10, color: TOKEN.text3, maxWidth: '45%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{next}</span>
      </div>
    </div>
  );
}

function sttusToLabel(sttus: string): string {
  switch (sttus) {
    case '0': return '진입 중';
    case '1': return '도착';
    case '2': return '출발';
    case '3': return '이동 중';
    default: return '운행 중';
  }
}
