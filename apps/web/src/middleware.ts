// HTML response에 Cache-Control 명시 — 사용자 디바이스 stale build 방지.
//
// 문제: Next.js SSR + CF Pages는 dynamic route 응답에 Cache-Control 헤더를 안 보냄.
// 그러면 모바일 Safari가 heuristic으로 HTML을 disk cache. 새 build deploy해도
// 사용자가 새로고침 안 하면 옛 HTML이 보임 (e.g. 1주일 전 build).
//
// _next/static/* (hash-immutable chunks)는 public/_headers에서 별도로
// max-age=31536000 immutable 유지. 여기서는 dynamic HTML만 must-revalidate.

import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(req: NextRequest) {
  const res = NextResponse.next();
  const accept = req.headers.get('accept') ?? '';
  // HTML navigation request만 대상. /api/*, _next/*, asset (.png/.svg 등)은 matcher에서 제외.
  if (accept.includes('text/html')) {
    res.headers.set('Cache-Control', 'public, max-age=0, must-revalidate');
  }
  return res;
}

export const config = {
  // _next/, api/만 제외. asset 분기는 함수 안 Accept 헤더로 처리 —
  // placeId가 dot 허용(venue:gps:37.5:127.0)이라 dot path 제외 패턴은
  // 실제 페이지 path까지 skip시켜 Cache-Control 누락 회귀. Codex 리뷰 (C) 지적.
  matcher: [
    '/((?!_next/|api/).*)',
  ],
};
