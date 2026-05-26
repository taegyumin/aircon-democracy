import type { Metadata } from 'next';
import { Suspense } from 'react';
import RegisterRoute from './RegisterRoute';

export const metadata: Metadata = {
  title: '장소 등록 — 에어컨 민주주의',
  alternates: { canonical: '/register' },
};

export default function Page() {
  return (
    <Suspense fallback={null}>
      <RegisterRoute />
    </Suspense>
  );
}
