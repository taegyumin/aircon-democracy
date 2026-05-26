import type { Metadata } from 'next';
import { Suspense } from 'react';
import LoginClient from './LoginClient';

export const metadata: Metadata = {
  title: '로그인 — 에어컨 민주주의',
  alternates: { canonical: '/login' },
  // 로그인 화면은 검색 노출 안 함
  robots: { index: false, follow: true },
};

// useSearchParams는 Suspense 경계 필요 (Next.js 15)
export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginClient />
    </Suspense>
  );
}
