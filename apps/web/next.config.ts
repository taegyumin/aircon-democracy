import type { NextConfig } from 'next';

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
};

export default config;
