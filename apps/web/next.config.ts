import type { NextConfig } from 'next';
import { SECURITY_HEADERS } from './src/lib/securityHeaders';

// SECURITY_HEADERS는 src/lib/securityHeaders.ts (SOT)에서 가져옴.
// public/_headers와 동일한 내용을 유지 — SOT 변경 시 둘 다 sync.
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
