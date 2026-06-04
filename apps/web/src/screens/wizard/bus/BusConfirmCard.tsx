'use client';

// 노선 확정 후 표시되는 카드 묶음. BusWizard.tsx에서 추출 (V4 (C) #1).
// ConfirmedBusChip (compact row) + BusConfirmCard (큰 카드) + BusProgressInline (진행도 bar).

import { TOKEN, FONT } from '@aircon/core';
import type { BusRouteCandidate } from '@aircon/core';
import { CheckIcon, BusGlyph, MiniBusIcon } from './icons';

// BusBadge는 NumberStep.tsx에 있는 거랑 동일 로직 — 여기서도 self-contained로.
function BusBadge({ label, color, size = 'normal' }: { label: string; color: string; size?: 'normal' | 'sm' }) {
  return (
    <span
      style={{
        fontSize: size === 'sm' ? 10 : 11, fontWeight: 700, color: '#fff',
        background: color, padding: size === 'sm' ? '2px 6px' : '3px 8px',
        borderRadius: 5, flexShrink: 0,
        boxShadow: `0 2px 6px ${color}30`,
      }}
    >
      {label}
    </span>
  );
}

export function ConfirmedBusChip({
  route, typeColor, onEdit,
}: {
  route: BusRouteCandidate;
  typeColor: string;
  onEdit: () => void;
}) {
  return (
    <div
      style={{
        background: TOKEN.surface, borderRadius: 14, padding: '12px 16px',
        display: 'flex', alignItems: 'center', gap: 10,
        border: `1.5px solid ${TOKEN.border}`,
        boxShadow: '0 1px 5px rgba(0,0,0,0.05)',
      }}
    >
      <BusBadge label={route.typeLabel} color={typeColor} size="sm" />
      <span style={{ fontSize: 17, fontWeight: 900, color: TOKEN.text1, letterSpacing: '-0.4px', flexShrink: 0 }}>
        {route.name}번
      </span>
      <span style={{ fontSize: 12, color: TOKEN.text2, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {route.startStop}→{route.endStop}
      </span>
      <CheckIcon color={TOKEN.ok} size={15} />
      <div style={{ width: 1, height: 14, background: TOKEN.border, margin: '0 4px' }} aria-hidden />
      <button
        onClick={onEdit}
        style={{ fontSize: 12, color: TOKEN.text3, background: 'none', border: 'none', cursor: 'pointer', fontFamily: FONT, padding: 0 }}
      >
        수정
      </button>
    </div>
  );
}

export function BusConfirmCard({
  route, typeColor, stopName, confirmed, progress, vehPlainNo,
}: {
  route: BusRouteCandidate;
  typeColor: string;
  stopName: string | null;
  confirmed: boolean;
  progress?: number | null;
  vehPlainNo?: string | null;
}) {
  return (
    <div style={{ margin: '0 16px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
        <div style={{ width: 6, height: 6, borderRadius: '50%', background: confirmed ? TOKEN.ok : typeColor }} />
        <span style={{ fontSize: 11, fontWeight: 700, color: confirmed ? TOKEN.ok : typeColor, letterSpacing: '0.3px' }}>
          {confirmed ? '버스 확인됨' : '버스 노선 확정됨'}
        </span>
        {confirmed && <CheckIcon color={TOKEN.ok} size={13} />}
      </div>
      <div
        style={{
          background: TOKEN.surface, borderRadius: 18, overflow: 'hidden',
          border: `1.5px solid ${confirmed ? TOKEN.ok + '30' : 'transparent'}`,
          boxShadow: confirmed ? '0 2px 12px rgba(0,0,0,0.07)' : '0 6px 28px rgba(0,0,0,0.10)',
        }}
      >
        <div style={{ height: 4, background: typeColor }} />
        <div style={{ padding: '18px 18px 18px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 14 }}>
            <div
              style={{
                width: 44, height: 44, borderRadius: 12, background: typeColor, flexShrink: 0,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                boxShadow: `0 4px 14px ${typeColor}50`,
              }}
            >
              <BusGlyph size={22} color="#fff" />
            </div>
            <div style={{ minWidth: 0, flex: 1 }}>
              <div style={{ fontSize: 22, fontWeight: 900, color: TOKEN.text1, letterSpacing: '-0.5px', lineHeight: 1.2 }}>
                {route.name}번
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginTop: 3, flexWrap: 'wrap' }}>
                <span style={{ fontSize: 12, color: TOKEN.text2 }}>{route.startStop} → {route.endStop} 방향</span>
                <span style={{ color: TOKEN.border }}>·</span>
                <BusBadge label={route.typeLabel} color={typeColor} size="sm" />
              </div>
            </div>
          </div>

          {/* Route mini-viz: 시점 · (현재정류장) · 종점 */}
          <div style={{ background: TOKEN.bg, borderRadius: 10, padding: '11px 14px' }}>
            <div style={{ display: 'flex', alignItems: 'center', marginBottom: 5 }}>
              <div style={{ width: 9, height: 9, borderRadius: '50%', background: typeColor, flexShrink: 0 }} aria-hidden />
              <div style={{ flex: 1, height: 2, background: typeColor, opacity: 0.2 }} aria-hidden />
              {stopName && (
                <>
                  <div style={{ width: 9, height: 9, borderRadius: '50%', background: TOKEN.cold, flexShrink: 0, boxShadow: `0 2px 6px ${TOKEN.cold}55` }} aria-hidden />
                  <div style={{ flex: 1, height: 2, background: typeColor, opacity: 0.1 }} aria-hidden />
                </>
              )}
              <div style={{ width: 9, height: 9, borderRadius: '50%', background: typeColor, opacity: 0.38, flexShrink: 0 }} aria-hidden />
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: 12, fontWeight: 700, color: TOKEN.text1 }}>{route.startStop}</span>
              {stopName && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  <div style={{ width: 5, height: 5, borderRadius: '50%', background: TOKEN.cold }} aria-hidden />
                  <span style={{ fontSize: 10, color: TOKEN.cold, fontWeight: 600 }}>{stopName}</span>
                </div>
              )}
              <span style={{ fontSize: 12, fontWeight: 700, color: TOKEN.text2, opacity: 0.5 }}>{route.endStop}</span>
            </div>
          </div>

          {confirmed && (
            <>
              <div style={{ marginTop: 14, display: 'flex', alignItems: 'center', gap: 6 }}>
                <CheckIcon color={TOKEN.ok} size={14} />
                <span style={{ fontSize: 12, color: TOKEN.ok, fontWeight: 600 }}>버스가 확인됐어요</span>
                {vehPlainNo && (
                  <>
                    <span style={{ color: TOKEN.border }}>·</span>
                    <span style={{ fontSize: 12, color: TOKEN.text2 }}>{vehPlainNo}</span>
                  </>
                )}
              </div>
              {/* 차량 진행도 mini bar — progress 있을 때만 */}
              {typeof progress === 'number' && (
                <BusProgressInline color={typeColor} progress={progress} stopName={stopName} />
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// BusConfirmCard 내부 진행도 bar — 막 출발 → 진입 → 도착 표시.
// BusCandidatePicker도 후보 카드별 mini-bar로 사용 — export.
export function BusProgressInline({ color, progress, stopName }: { color: string; progress: number; stopName: string | null }) {
  const pct = Math.max(0, Math.min(1, progress)) * 100;
  const label = progress >= 0.95 ? '도착' : progress >= 0.6 ? '진입 중' : progress >= 0.3 ? '접근 중' : '막 출발';
  return (
    <div style={{ marginTop: 10 }}>
      <div style={{ position: 'relative', height: 6, background: TOKEN.bg, borderRadius: 3 }}>
        <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: `${pct}%`, background: color, borderRadius: 3, transition: 'width 240ms' }} />
        <div
          style={{
            position: 'absolute', left: `${pct}%`, top: -5,
            transform: 'translateX(-50%)',
            pointerEvents: 'none', filter: 'drop-shadow(0 1px 2px rgba(0,0,0,0.18))',
          }}
        >
          <MiniBusIcon color={color} />
        </div>
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 6 }}>
        <span style={{ fontSize: 10, color: TOKEN.text3 }}>이전 정류장</span>
        <span style={{ fontSize: 10, color, fontWeight: 700 }}>{label}</span>
        <span style={{ fontSize: 10, color: TOKEN.text3, maxWidth: '40%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{stopName ?? '정류장'}</span>
      </div>
    </div>
  );
}
