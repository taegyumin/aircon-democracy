import type { Metadata } from 'next';
import LoginClient from './LoginClient';

export const metadata: Metadata = {
  title: '로그인 — 에어컨 민주주의',
  alternates: { canonical: '/login' },
  robots: { index: false, follow: true },
};

// searchParams 의존이므로 dynamic. CF Pages = edge runtime.
export const runtime = 'edge';
export const dynamic = 'force-dynamic';

interface PageProps {
  searchParams: Promise<{ error?: string }>;
}

// Server에서 error를 받아 client로 전달 — useSearchParams의 hydration timing 이슈 회피.
export default async function LoginPage({ searchParams }: PageProps) {
  const { error } = await searchParams;
  return <LoginClient error={error ?? null} />;
}
