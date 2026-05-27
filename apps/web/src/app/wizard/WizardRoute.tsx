'use client';

import { useRouter } from 'next/navigation';
import { LocationWizardScreen } from '../../screens/LocationWizardScreen';

export default function WizardRoute() {
  const router = useRouter();
  return (
    <LocationWizardScreen
      onBack={() => router.push('/')}
      onPicked={(id) => router.push(`/p/${encodeURIComponent(id)}`)}
    />
  );
}
