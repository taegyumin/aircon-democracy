'use client';

// Wizard 첫 화면 — 카테고리 grid only.
// 결정 이력:
//   2026-05-26: 검색창 제거. 카테고리별 흐름이 달라 통합 검색 의미 없음.
//   2026-05-27: GPS '근처 역 찾기' 제거. 사용자 대부분 지하철 외 카테고리(카페·
//     강의실·버스) 선택하는데, GPS는 지하철역만 빠르게 — ROI 낮음.

import { TOKEN, FONT } from '@aircon/core';
import { CATEGORIES, type Category } from './categories';
import { WizardHeader } from './WizardHeader';

interface Props {
  onPickCategory: (k: Category) => void;
  onBack: () => void;
}

export function WizardLanding({ onPickCategory, onBack }: Props) {
  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', background: TOKEN.bg, fontFamily: FONT }}>
      <WizardHeader title="지금 어디 계세요?" onBack={onBack} />
      <div style={{ flex: 1, overflowY: 'auto', padding: '20px 20px 60px' }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: TOKEN.text2, marginBottom: 10, letterSpacing: '0.3px' }}>
          유형으로 찾기
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
          {CATEGORIES.map((c) => {
            const Icon = c.Icon;
            return (
              <button
                key={c.key}
                onClick={() => onPickCategory(c.key)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 10,
                  padding: '14px 12px',
                  borderRadius: TOKEN.r.lg,
                  border: `1.5px solid ${TOKEN.border}`,
                  background: TOKEN.surface,
                  cursor: 'pointer', fontFamily: FONT, textAlign: 'left',
                }}
              >
                <div style={{ width: 32, height: 32, borderRadius: 9, background: c.tint + '15', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <Icon size={18} color={c.tint} strokeWidth={2.1} />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 800, color: TOKEN.text1, letterSpacing: '-0.2px' }}>{c.label}</div>
                  <div style={{ fontSize: 10, color: TOKEN.text3, marginTop: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.sub}</div>
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
