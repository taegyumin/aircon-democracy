import type { Metadata, Viewport } from 'next';
import type { ReactNode } from 'react';
import './globals.css';

// viewport-fit=cover로 PWA standalone 모드의 notch/status bar 영역에 env(safe-area-inset-*)
// 적용 가능. 일반 Safari에서는 env() = 0이라 영향 없음.
export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  themeColor: '#1B53E5',
};

export const metadata: Metadata = {
  title: '에어컨 민주주의 — 지하철·카페·강의실 에어컨 익명 투표',
  description: '지금 이 공간 에어컨이 추워요? 더워요? 적당해요? 지하철, 버스, 카페, 강의실 어디든 익명으로 한 표.',
  keywords: ['에어컨', '민주주의', '익명 투표', '지하철 에어컨', '카페 에어컨', '시민 참여'],
  authors: [{ name: 'Aircon Democracy' }],
  metadataBase: new URL('https://aircondemocracy.com'),
  alternates: {
    canonical: '/',
    languages: { ko: '/' },
  },
  openGraph: {
    type: 'website',
    locale: 'ko_KR',
    siteName: '에어컨 민주주의',
    title: '에어컨 민주주의 — 지금 이 공간 에어컨 어때요?',
    description: '지하철·버스·카페·강의실 어디서든 30초면 익명 투표.',
    url: 'https://aircondemocracy.com',
    images: [{ url: '/og-image.png', width: 1200, height: 630, alt: '에어컨 민주주의' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: '에어컨 민주주의',
    description: '지하철·버스·카페·강의실 어디서든 30초면 익명 투표.',
    images: ['/og-image.png'],
  },
  robots: { index: true, follow: true },
  icons: {
    icon: [
      { url: '/favicon-32.png', sizes: '32x32', type: 'image/png' },
      { url: '/favicon-16.png', sizes: '16x16', type: 'image/png' },
    ],
    apple: '/apple-touch-icon.png',
  },
  manifest: '/manifest.webmanifest',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="ko">
      <head>
        <link rel="preconnect" href="https://cdn.jsdelivr.net" crossOrigin="" />
        <link rel="stylesheet" href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/variable/pretendardvariable.min.css" />
      </head>
      <body>{children}</body>
    </html>
  );
}
