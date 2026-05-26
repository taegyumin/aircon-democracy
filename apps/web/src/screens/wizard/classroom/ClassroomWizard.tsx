'use client';

// Classroom (서울대) wizard wrap — SNUClassroomWizard에 WizardHeader 주입.
// SNUClassroomWizard 자체는 sub-component 구조가 복잡해서 별도 파일 유지.

import { TOKEN } from '@aircon/core';
import { BackIcon } from '../../../components/Icons';
import { SNUClassroomWizard } from '../../SNUClassroomWizard';

interface Props {
  onBack: () => void;
  onPicked: (placeId: string) => void;
  onFreeform: () => void;
}

export function ClassroomWizard({ onBack, onPicked, onFreeform }: Props) {
  const renderHeader = (title: string) => (
    <div style={{ background: TOKEN.surface, paddingTop: 62, borderBottom: `1px solid ${TOKEN.border}`, flexShrink: 0 }}>
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

  return (
    <SNUClassroomWizard
      onPicked={onPicked}
      onFreeform={onFreeform}
      renderHeader={renderHeader}
    />
  );
}
