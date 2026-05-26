'use client';

// Top-level wizard router — category 선택 후 해당 feature module로 위임.
// 각 wizard는 wizard/<category>/ 디렉토리에 자체 state/UI/pure builder로 분리됨.

import { useState } from 'react';
import type { PlaceType } from '@aircon/core';
import { WizardLanding } from './wizard/WizardLanding';
import { type Category } from './wizard/categories';
import { BusWizard } from './wizard/bus/BusWizard';
import { TrainWizard } from './wizard/train/TrainWizard';
import { CafeWizard } from './wizard/cafe/CafeWizard';
import { ClassroomWizard } from './wizard/classroom/ClassroomWizard';
import { SubwayWizard } from './wizard/subway/SubwayWizard';

interface Props {
  onBack: () => void;
  onPicked: (placeId: string) => void;
  onRegisterFreeform: (initialType: PlaceType) => void;
}

export function LocationWizardScreen({ onBack, onPicked, onRegisterFreeform }: Props) {
  const [category, setCategory] = useState<Category | null>(null);

  if (!category) {
    return (
      <WizardLanding
        onPickCategory={(k) => {
          if (k === 'subway' || k === 'bus' || k === 'train' || k === 'classroom' || k === 'other') setCategory(k);
          else onRegisterFreeform(k as PlaceType);
        }}
        onBack={onBack}
      />
    );
  }

  const back = () => setCategory(null);
  switch (category) {
    case 'other':     return <CafeWizard onBack={back} onPicked={onPicked} />;
    case 'subway':    return <SubwayWizard onBack={back} onPicked={onPicked} />;
    case 'classroom': return <ClassroomWizard onBack={back} onPicked={onPicked} onFreeform={() => onRegisterFreeform('classroom')} />;
    case 'train':     return <TrainWizard onBack={back} onPicked={onPicked} />;
    case 'bus':       return <BusWizard onBack={back} onPicked={onPicked} />;
    default:          return null;
  }
}
