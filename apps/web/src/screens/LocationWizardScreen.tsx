'use client';

// Top-level wizard router — category 선택 후 해당 feature module로 위임.
// 각 wizard는 wizard/<category>/ 디렉토리에 자체 state/UI/pure builder로 분리됨.
//
// HomeScreen이 카테고리 picker를 직접 노출하므로 /wizard?cat=subway 식으로
// 진입 가능. 초기 state는 URL searchParams에서 hydrate.

import { useState } from 'react';
import { WizardLanding } from './wizard/WizardLanding';
import { CATEGORIES, type Category } from './wizard/categories';
import { BusWizard } from './wizard/bus/BusWizard';
import { TrainWizard } from './wizard/train/TrainWizard';
import { CafeWizard } from './wizard/cafe/CafeWizard';
import { ClassroomWizard } from './wizard/classroom/ClassroomWizard';
import { SubwayWizard } from './wizard/subway/SubwayWizard';
import { CustomPlaceWizard } from './wizard/custom/CustomPlaceWizard';

interface Props {
  onBack: () => void;
  onPicked: (placeId: string) => void;
  initialCategory?: Category | null;
}

const VALID_CATEGORIES = new Set<string>(CATEGORIES.map((c) => c.key));
export function isValidCategory(s: string | null | undefined): s is Category {
  return !!s && VALID_CATEGORIES.has(s);
}

export function LocationWizardScreen({ onBack, onPicked, initialCategory = null }: Props) {
  const [category, setCategory] = useState<Category | null>(initialCategory);

  if (!category) {
    return (
      <WizardLanding
        onPickCategory={(k) => setCategory(k)}
        onBack={onBack}
      />
    );
  }

  const back = () => setCategory(null);
  switch (category) {
    case 'other':     return <CafeWizard onBack={back} onPicked={onPicked} />;
    case 'subway':    return <SubwayWizard onBack={back} onPicked={onPicked} />;
    case 'classroom': return <ClassroomWizard onBack={back} onPicked={onPicked} />;
    case 'train':     return <TrainWizard onBack={back} onPicked={onPicked} />;
    case 'bus':       return <BusWizard onBack={back} onPicked={onPicked} />;
    case 'custom':    return <CustomPlaceWizard onBack={back} onPicked={onPicked} />;
    default:          return null;
  }
}
