'use client';

// CarStrip — horizontal train silhouette + 칸 모름 row.
// TrainModeBody.tsx에서 추출 (V4 (C) #2). ctaCopy helper도 같이.

import { TOKEN, FONT, lineColor, carCountFor } from '@aircon/core';

// ArrowRight inline (CarStrip 안에서만 destination indicator로 사용).
function ArrowRight({ color = TOKEN.text3, size = 18 }: { color?: string; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="M5 12h14M13 6l6 6-6 6" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function CarStrip({
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

export function ctaCopy({
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
