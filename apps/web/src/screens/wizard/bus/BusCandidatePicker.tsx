'use client';

// 다중 차량 후보 picker — 같은 정류장 근처 차량 2+대일 때 사용자 선택.
// 지하철 CandidatePicker와 같은 패턴. BusWizard.tsx에서 추출 (V4 (C) #1).

import { TOKEN, FONT } from '@aircon/core';
import type { BusMatchCandidate } from '@aircon/core';
import { BusProgressInline } from './BusConfirmCard';

export function BusCandidatePicker({
  typeColor, currentStop, candidates, onPick,
}: {
  typeColor: string;
  currentStop: string;
  candidates: BusMatchCandidate[];
  onPick: (c: BusMatchCandidate) => void;
}) {
  return (
    <div style={{ margin: '0 16px 12px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
        <div style={{ width: 6, height: 6, borderRadius: '50%', background: typeColor }} />
        <span style={{ fontSize: 11, fontWeight: 700, color: typeColor, letterSpacing: '0.3px' }}>
          어느 차량에 타고 계세요?
        </span>
      </div>
      <div style={{ background: TOKEN.coldBg, borderRadius: TOKEN.r.md, padding: '12px 14px', marginBottom: 10, display: 'flex', alignItems: 'flex-start', gap: 8 }}>
        <div style={{ width: 6, height: 6, borderRadius: '50%', background: TOKEN.cold, marginTop: 6, flexShrink: 0 }} aria-hidden />
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: TOKEN.text1, letterSpacing: '-0.2px', marginBottom: 2 }}>
            {currentStop} 근처에 차량 {candidates.length}대 운행 중이에요
          </div>
          <div style={{ fontSize: 11, color: TOKEN.text2, lineHeight: 1.5 }}>
            내가 탄 차량의 위치와 가장 비슷한 걸 탭해주세요
          </div>
        </div>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {candidates.map((c) => {
          const label =
            c.progressLabel === 'at-stop' ? '도착'
            : c.progressLabel === 'approaching' ? '진입 중'
            : c.progressLabel === 'just-left' ? '막 출발'
            : '접근 중';
          return (
            <button
              key={c.vehId}
              onClick={() => onPick(c)}
              style={{
                width: '100%', textAlign: 'left', background: TOKEN.surface,
                border: `1px solid ${TOKEN.border}`, borderRadius: TOKEN.r.md,
                padding: '12px 14px', cursor: 'pointer', fontFamily: FONT,
                boxShadow: '0 1px 5px rgba(0,0,0,0.04)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                <span style={{ fontSize: 10, fontWeight: 700, color: '#fff', background: typeColor, padding: '2px 8px', borderRadius: 6 }}>BUS</span>
                <span style={{ fontSize: 14, fontWeight: 700, color: TOKEN.text1, letterSpacing: '-0.2px' }}>{c.plainNo}</span>
                <span style={{ fontSize: 11, color: TOKEN.text3 }}>·</span>
                <span style={{ fontSize: 12, color: TOKEN.text2 }}>{label}</span>
              </div>
              <BusProgressInline color={typeColor} progress={c.progress ?? 0.5} stopName={currentStop} />
            </button>
          );
        })}
      </div>
    </div>
  );
}

// 단일 매칭 실패 reason 분기 메시지.
export function BusReasonNote({ reason, typeColor }: { reason: string; typeColor: string }) {
  const text =
    reason === 'no_vehicle_at_stop' ? '지금 이 정류장 근처에 운행 중인 차량이 없어요. 잠시 후 다시 확인하거나 정류장 단위로 투표하세요.'
    : reason === 'route_or_stop_not_found' ? '노선 또는 정류장 매칭에 실패했어요. 정류장 이름이 정확한지 확인해주세요.'
    : reason === 'no_api_key' ? '실시간 차량 정보를 가져올 수 없어요 (서버 설정).'
    : `매칭 실패: ${reason}`;
  return (
    <div style={{ margin: '0 16px 12px' }}>
      <div
        style={{
          background: TOKEN.surface, borderRadius: TOKEN.r.md, padding: '12px 14px',
          border: `1px solid ${TOKEN.border}`,
          display: 'flex', alignItems: 'flex-start', gap: 8,
        }}
      >
        <div style={{ width: 6, height: 6, borderRadius: '50%', background: typeColor, marginTop: 6, flexShrink: 0 }} aria-hidden />
        <div style={{ flex: 1, fontSize: 12, color: TOKEN.text2, lineHeight: 1.5 }}>{text}</div>
      </div>
    </div>
  );
}
