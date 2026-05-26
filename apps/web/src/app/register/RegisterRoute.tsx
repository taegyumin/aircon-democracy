'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { RegisterScreen } from '../../screens/RegisterScreen';
import type { PlaceType } from '@aircon/core';

export default function RegisterRoute() {
  const router = useRouter();
  const params = useSearchParams();
  const initialType = (params.get('type') ?? undefined) as PlaceType | undefined;
  return (
    <RegisterScreen
      onBack={() => router.push('/')}
      onComplete={(id) => router.push(`/p/${encodeURIComponent(id)}`)}
      onPrint={(id) => router.push(`/print/${encodeURIComponent(id)}`)}
      initialType={initialType}
    />
  );
}
