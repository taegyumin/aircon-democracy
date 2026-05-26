import type { NextConfig } from 'next';

// 정적 자산용 CSP는 public/_headers에 정의돼 있지만, dynamic edge function이
// 응답하는 라우트(/, /p/[id], /api/*)는 _headers가 적용되지 않음.
// next.config의 headers()는 모든 라우트(static + dynamic)에 적용된다.
// public/_headers와 정확히 같은 내용을 유지 — 한 곳만 수정해도 다른 쪽
// 신경 안 써도 되게 하려면 별도 작업 (현재는 SOT 두 곳).
const CSP = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://oapi.map.naver.com https://nrbe.map.naver.net",
  "style-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net",
  "font-src 'self' data: https://cdn.jsdelivr.net",
  "img-src 'self' data: blob: https://*.map.naver.net https://*.pstatic.net",
  "connect-src 'self' https://aircondemocracy.com https://oapi.map.naver.com https://*.map.naver.net https://cdn.jsdelivr.net",
  "manifest-src 'self'",
  "worker-src 'self' blob:",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
].join('; ');

const SECURITY_HEADERS = [
  { key: 'Strict-Transport-Security', value: 'max-age=31536000; includeSubDomains; preload' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Permissions-Policy', value: 'camera=(self), geolocation=(self), microphone=(), payment=(), usb=(), interest-cohort=()' },
  { key: 'Content-Security-Policy', value: CSP },
];

const config: NextConfig = {
  reactStrictMode: true,
  // packages/core를 transpile (모노레포 source 직접 사용)
  transpilePackages: ['@aircon/core'],
  // 한국 fonts/maps domains
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: '**.naver.net' },
      { protocol: 'https', hostname: '**.pstatic.net' },
      { protocol: 'https', hostname: '**.kakaocdn.net' },
    ],
  },
  async headers() {
    return [{ source: '/:path*', headers: SECURITY_HEADERS }];
  },
};

export default config;
