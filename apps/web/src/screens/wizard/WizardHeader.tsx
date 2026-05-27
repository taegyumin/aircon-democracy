'use client';

// 각 wizard 화면 상단 헤더 — 뒤로가기 + 제목.
// onBack은 LocationWizardScreen의 setCategory(null) (또는 라우터 back) 으로 주입.

import { TOKEN } from '@aircon/core';
import { BackIcon } from '../../components/Icons';

export function WizardHeader({ title, onBack }: { title: string; onBack: () => void }) {
  return (
    <div style={{ background: TOKEN.surface, paddingTop: 'var(--header-top-pad)', borderBottom: `1px solid ${TOKEN.border}`, flexShrink: 0 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '10px 14px 14px' }}>
        <button
          onClick={onBack}
          style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '4px 6px', display: 'flex', alignItems: 'center' }}
          aria-label="뒤로"
        >
          <BackIcon />
        </button>
        <span style={{ fontSize: 16, fontWeight: 700, color: TOKEN.text1 }}>{title}</span>
      </div>
    </div>
  );
}
