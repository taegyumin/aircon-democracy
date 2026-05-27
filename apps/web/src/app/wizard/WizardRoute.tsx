'use client';

import { useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { LocationWizardScreen, isValidCategory } from '../../screens/LocationWizardScreen';

export default function WizardRoute() {
  const router = useRouter();
  const params = useSearchParams();
  const catParam = params.get('cat');
  const cat = isValidCategory(catParam) ? catParam : null;

  // /wizard 단독 진입은 더 이상 의미 없음 — 홈에 카테고리 picker 직접 노출되니
  // 같은 화면 중복. 홈으로 redirect.
  useEffect(() => {
    if (!cat) router.replace('/');
  }, [cat, router]);

  if (!cat) return null;

  return (
    <LocationWizardScreen
      onBack={() => router.push('/')}
      onPicked={(id) => router.push(`/p/${encodeURIComponent(id)}`)}
      initialCategory={cat}
    />
  );
}
