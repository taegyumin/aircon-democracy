'use client';

// 카테고리별 wizard로 dispatch. 카테고리 picker는 홈에 통합됐기 때문에 여기는
// thin router 역할만. /wizard?cat=<category> 진입 시 해당 wizard 즉시 마운트.
// cat 없이 진입한 경우는 WizardRoute가 홈으로 redirect.

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
  initialCategory: Category;
}

const VALID_CATEGORIES = new Set<string>(CATEGORIES.map((c) => c.key));
export function isValidCategory(s: string | null | undefined): s is Category {
  return !!s && VALID_CATEGORIES.has(s);
}

export function LocationWizardScreen({ onBack, onPicked, initialCategory }: Props) {
  switch (initialCategory) {
    case 'other':     return <CafeWizard onBack={onBack} onPicked={onPicked} />;
    case 'subway':    return <SubwayWizard onBack={onBack} onPicked={onPicked} />;
    case 'classroom': return <ClassroomWizard onBack={onBack} onPicked={onPicked} />;
    case 'train':     return <TrainWizard onBack={onBack} onPicked={onPicked} />;
    case 'bus':       return <BusWizard onBack={onBack} onPicked={onPicked} />;
    case 'custom':    return <CustomPlaceWizard onBack={onBack} onPicked={onPicked} />;
    default:          return null;
  }
}
