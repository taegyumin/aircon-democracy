'use client';

import { useRouter } from 'next/navigation';
import { LocationWizardScreen } from '../../screens/LocationWizardScreen';
import type { PlaceType } from '@aircon/core';

export default function WizardRoute() {
  const router = useRouter();
  return (
    <LocationWizardScreen
      onBack={() => router.push('/')}
      onPicked={(id) => router.push(`/p/${encodeURIComponent(id)}`)}
      onRegisterFreeform={(t: PlaceType) => router.push(`/register?type=${encodeURIComponent(t)}`)}
    />
  );
}
