import { Suspense } from 'react';
import type { Metadata } from 'next';
import WizardRoute from './WizardRoute';

export const metadata: Metadata = {
  title: '지금 어디 계세요? — 에어컨 민주주의',
  alternates: { canonical: '/wizard' },
};

export default function Page() {
  // useSearchParams는 client-only — Suspense로 감싸야 Next 15 빌드 통과.
  return (
    <Suspense fallback={null}>
      <WizardRoute />
    </Suspense>
  );
}
