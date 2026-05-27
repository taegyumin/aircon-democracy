'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { LocationWizardScreen, isValidCategory } from '../../screens/LocationWizardScreen';

export default function WizardRoute() {
  const router = useRouter();
  const params = useSearchParams();
  const catParam = params.get('cat');
  const initialCategory = isValidCategory(catParam) ? catParam : null;
  return (
    <LocationWizardScreen
      onBack={() => router.push('/')}
      onPicked={(id) => router.push(`/p/${encodeURIComponent(id)}`)}
      initialCategory={initialCategory}
    />
  );
}
