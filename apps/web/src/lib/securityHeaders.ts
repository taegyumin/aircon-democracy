// Security headers SOT — next.config.ts (dynamic route) ↔ public/_headers (static asset).
//
// 이전엔 두 곳에 따로 정의되어 있어서 Naver/analytics 도메인 drift 발생.
// 이제 SOT는 여기. next.config.ts는 import해서 사용.
//
// public/_headers는 CF Pages가 직접 읽는 static 파일이라 빌드 시 수동 sync 필요.
// 만약 SOT가 변경되면 npm run sync:headers 후 _headers diff 확인.
// (자동 generator는 prebuild script 추가 작업 — 별도 sprint.)

// CSP 통합본 (이전 next.config + _headers union):
// - script-src: Naver maps + Naver SDK 정적자원(pstatic, navermaps github) + CF Insights
// - img-src: Naver maps + Naver pstatic + Naver 정적 호스트
// - connect-src: Naver maps API + pstatic + navercorp(analytics)
const CSP_DIRECTIVES: Record<string, string[]> = {
  'default-src': ["'self'"],
  'script-src': [
    "'self'",
    "'unsafe-inline'",
    "'unsafe-eval'",
    'https://oapi.map.naver.com',
    'https://nrbe.map.naver.net',
    'https://*.pstatic.net',
    'https://navermaps.github.io',
    'https://static.cloudflareinsights.com',
  ],
  'style-src': ["'self'", "'unsafe-inline'", 'https://cdn.jsdelivr.net'],
  'font-src': ["'self'", 'data:', 'https://cdn.jsdelivr.net'],
  'img-src': [
    "'self'",
    'data:',
    'blob:',
    'https://*.map.naver.net',
    'https://*.pstatic.net',
    'https://static.naver.net',
  ],
  'connect-src': [
    "'self'",
    'https://aircondemocracy.com',
    'https://oapi.map.naver.com',
    'https://*.map.naver.net',
    'https://*.pstatic.net',
    'https://*.navercorp.com',
    'https://cdn.jsdelivr.net',
  ],
  'manifest-src': ["'self'"],
  'worker-src': ["'self'", 'blob:'],
  'frame-ancestors': ["'none'"],
  'base-uri': ["'self'"],
  'form-action': ["'self'"],
};

export const CSP_HEADER_VALUE = Object.entries(CSP_DIRECTIVES)
  .map(([k, v]) => `${k} ${v.join(' ')}`)
  .join('; ');

export interface SecurityHeader {
  key: string;
  value: string;
}

export const SECURITY_HEADERS: SecurityHeader[] = [
  { key: 'Strict-Transport-Security', value: 'max-age=31536000; includeSubDomains; preload' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Permissions-Policy', value: 'camera=(self), geolocation=(self), microphone=(), payment=(), usb=(), interest-cohort=()' },
  { key: 'Content-Security-Policy', value: CSP_HEADER_VALUE },
];
