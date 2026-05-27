'use client';

// Classroom wizard — SNUClassroomWizard에 onBack을 전달하는 얇은 wrap.
// onFreeform은 RegisterScreen으로 가던 옛 흐름 (삭제됨, 2026-05-27). 임시 no-op.
// 강의실 못 찾으면 사용자가 wizard back → '다른 장소 찾기'로 가야 함.

import { SNUClassroomWizard } from './snu/SNUClassroomWizard';

interface Props {
  onBack: () => void;
  onPicked: (placeId: string) => void;
}

export function ClassroomWizard({ onBack, onPicked }: Props) {
  return (
    <SNUClassroomWizard
      onPicked={onPicked}
      onFreeform={onBack}
      onBack={onBack}
    />
  );
}
