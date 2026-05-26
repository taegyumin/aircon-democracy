// OAuth provider 추상화.
// 카카오/네이버/구글의 authorize/token-exchange/userinfo 3-step flow는 거의 동일.
// 각 provider는 endpoint URL + body shape + userinfo mapping만 다름.
// `OAuthProvider`로 추상화하고 hono.ts는 [kakao, naver, google] 루프 한 번만 돈다.

export interface OAuthEnv {
  KAKAO_REST_API_KEY?: string;
  KAKAO_CLIENT_SECRET?: string;
  NAVER_CLIENT_ID?: string;
  NAVER_CLIENT_SECRET?: string;
  GOOGLE_CLIENT_ID?: string;
  GOOGLE_CLIENT_SECRET?: string;
}

export interface NormalizedUser {
  // provider별 native id (kakao number, naver string, google sub).
  providerUserId: string;
  displayName: string;
  profileImageUrl: string | null;
  email: string | null;
}

export type ConfigCheck = { ok: true } | { ok: false; error: string };

export interface OAuthProvider {
  id: 'kakao' | 'naver' | 'google';
  // env에 client_id/secret이 채워져 있는지 확인. 안 됐으면 503으로 친절히 표시.
  isConfigured(env: OAuthEnv): ConfigCheck;
  // Step 1: state CSRF 토큰 받아서 browser를 보낼 authorize URL 생성.
  authorizeUrl(params: { state: string; redirectUri: string; env: OAuthEnv }): string;
  // Step 2: code → access_token 교환.
  exchangeCode(params: {
    code: string;
    state: string;
    redirectUri: string;
    env: OAuthEnv;
  }): Promise<{ ok: true; accessToken: string } | { ok: false; error: string }>;
  // Step 3: access_token으로 userinfo 받아서 정규화.
  fetchUser(accessToken: string): Promise<NormalizedUser | null>;
}
