'use client';

// Wizard 첫 화면 — Place Select Redesign + Home Redesign v2 적용.
// 카테고리 picker는 CategoryPicker로 추출 (HomeScreen과 공유).

import { TOKEN, FONT } from '@aircon/core';
import { type Category } from './categories';
import { WizardHeader } from './WizardHeader';
import { CategoryPicker } from './CategoryPicker';

interface Props {
  onPickCategory: (k: Category) => void;
  onBack: () => void;
}

export function WizardLanding({ onPickCategory, onBack }: Props) {
  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', background: TOKEN.bg, fontFamily: FONT }}>
      <WizardHeader title="지금 어디 계세요?" onBack={onBack} />
      <div style={{ flex: 1, overflowY: 'auto', padding: '22px 16px 48px' }}>
        <CategoryPicker onPick={onPickCategory} />
      </div>
    </div>
  );
}
