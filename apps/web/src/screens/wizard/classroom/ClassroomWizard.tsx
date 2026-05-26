'use client';

// Classroom wizard — SNUClassroomWizard에 onBack을 전달하는 얇은 wrap.
// SNUClassroomWizard 자체가 내부 sub-component 구조라 별도 파일 유지.
// (얇긴 하지만 LocationWizardScreen에 inline 두면 wizard 모듈 패턴이 깨짐 — 유지.)

import { SNUClassroomWizard } from '../../SNUClassroomWizard';

interface Props {
  onBack: () => void;
  onPicked: (placeId: string) => void;
  onFreeform: () => void;
}

export function ClassroomWizard({ onBack, onPicked, onFreeform }: Props) {
  return (
    <SNUClassroomWizard
      onPicked={onPicked}
      onFreeform={onFreeform}
      onBack={onBack}
    />
  );
}
