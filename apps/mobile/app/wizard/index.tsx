// /wizard 단독 진입은 더 이상 의미 없음 — 홈에 CategoryPicker 직접 노출.
// cat 쿼리 있으면 해당 wizard로 replace, 없으면 홈으로.

import * as React from 'react';
import { useLocalSearchParams, router } from 'expo-router';

const ROUTE_BY_CAT: Record<string, string> = {
  subway: '/wizard/subway',
  bus: '/wizard/bus',
  'intercity-bus': '/wizard/intercity-bus',
  train: '/wizard/train',
  classroom: '/wizard/classroom',
  other: '/wizard/cafe',
  custom: '/wizard/custom',
};

export default function WizardIndex() {
  const params = useLocalSearchParams<{ cat?: string }>();

  React.useEffect(() => {
    const cat = typeof params.cat === 'string' ? params.cat : undefined;
    const target = cat ? ROUTE_BY_CAT[cat] : null;
    if (target) router.replace(target as never);
    else router.replace('/');
  }, [params.cat]);

  return null;
}
