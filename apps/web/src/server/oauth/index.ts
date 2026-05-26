// Provider registry — hono.ts는 이 배열을 루프 돌면서 라우트 6개를 자동 등록.
import { KakaoProvider } from './kakao';
import { NaverProvider } from './naver';
import { GoogleProvider } from './google';
import type { OAuthProvider } from './types';

export const OAUTH_PROVIDERS: ReadonlyArray<OAuthProvider> = [
  KakaoProvider,
  NaverProvider,
  GoogleProvider,
];

export type { OAuthProvider, OAuthEnv, NormalizedUser, ConfigCheck } from './types';
