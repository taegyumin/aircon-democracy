'use client';

// GPS 권한 요청 카드 — privacy contract에 따라 사용자가 명시적으로 누를 때만 좌표 요청.
// BusWizard.tsx에서 추출 (V4 (C) #1).

import { TOKEN, FONT } from '@aircon/core';
import { GpsIcon } from './icons';

export function GpsRequestCard({
  pending, onAllow, onSkip,
}: {
  pending: boolean;
  onAllow: () => void;
  onSkip: () => void;
}) {
  return (
    <div style={{ margin: '0 16px' }}>
      <div
        style={{
          background: TOKEN.surface, borderRadius: 18, padding: 18,
          border: `1.5px solid ${TOKEN.cold}1A`,
          boxShadow: '0 4px 24px rgba(27,83,229,0.09)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 13, marginBottom: 14 }}>
          <div
            style={{
              width: 44, height: 44, borderRadius: '50%', background: TOKEN.cold, flexShrink: 0,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: `0 4px 16px ${TOKEN.cold}35`,
            }}
          >
            <GpsIcon size={20} color="#fff" />
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 15, fontWeight: 700, color: TOKEN.text1, marginBottom: 3, letterSpacing: '-0.3px' }}>
              지나는 정류장을 찾아드릴까요?
            </div>
            <div style={{ fontSize: 12, color: TOKEN.text2, lineHeight: 1.55 }}>
              현재 위치로 이 노선의 정류장을<br />자동으로 추천해드려요
            </div>
            <div style={{ fontSize: 11, color: TOKEN.text3, marginTop: 5 }}>위치는 서버에 저장되지 않아요</div>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            onClick={onAllow}
            disabled={pending}
            style={{
              flex: 3, padding: '13px 0',
              background: pending ? TOKEN.coldBg : TOKEN.cold,
              color: pending ? TOKEN.cold : '#fff',
              border: 'none', borderRadius: 12, fontSize: 13, fontWeight: 700,
              cursor: pending ? 'default' : 'pointer', fontFamily: FONT,
              boxShadow: pending ? 'none' : `0 4px 14px ${TOKEN.cold}40`,
            }}
          >
            {pending ? '위치 확인 중…' : '위치 허용하기'}
          </button>
          <button
            onClick={onSkip}
            style={{
              flex: 2, padding: '13px 0', background: TOKEN.bg, color: TOKEN.text2,
              border: `1px solid ${TOKEN.border}`, borderRadius: 12, fontSize: 12,
              cursor: 'pointer', fontFamily: FONT,
            }}
          >
            직접 찾을게요
          </button>
        </div>
      </div>
    </div>
  );
}
