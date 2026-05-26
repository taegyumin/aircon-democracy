import type { OAuthProvider } from './types';

export const KakaoProvider: OAuthProvider = {
  id: 'kakao',

  isConfigured(env) {
    const k = env.KAKAO_REST_API_KEY;
    if (!k || k.startsWith('TODO')) return { ok: false, error: 'kakao_not_configured' };
    return { ok: true };
  },

  authorizeUrl({ state, redirectUri, env }) {
    const params = new URLSearchParams({
      client_id: env.KAKAO_REST_API_KEY!,
      redirect_uri: redirectUri,
      response_type: 'code',
      state,
      // account_email은 카카오 콘솔에서 비즈니스 권한 또는 별도 활성화 필요.
      // 활성화 안 된 상태에서 요청하면 scope_not_allowed 에러로 콜백 실패.
      // 닉네임·프사 두 개는 default 활성 → 무료 앱이라도 안전.
      scope: 'profile_nickname profile_image',
    });
    return `https://kauth.kakao.com/oauth/authorize?${params.toString()}`;
  },

  async exchangeCode({ code, redirectUri, env }) {
    const tokenForm = new URLSearchParams({
      grant_type: 'authorization_code',
      client_id: env.KAKAO_REST_API_KEY!,
      redirect_uri: redirectUri,
      code,
    });
    if (env.KAKAO_CLIENT_SECRET && !env.KAKAO_CLIENT_SECRET.startsWith('TODO')) {
      tokenForm.set('client_secret', env.KAKAO_CLIENT_SECRET);
    }
    const res = await fetch('https://kauth.kakao.com/oauth/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: tokenForm.toString(),
    });
    const body = (await res.json()) as { access_token?: string; error?: string };
    if (!body.access_token) return { ok: false, error: body.error ?? 'unknown' };
    return { ok: true, accessToken: body.access_token };
  },

  async fetchUser(accessToken) {
    const res = await fetch('https://kapi.kakao.com/v2/user/me', {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    const ku = (await res.json()) as {
      id?: number;
      kakao_account?: {
        email?: string;
        profile?: { nickname?: string; profile_image_url?: string };
      };
    };
    if (!ku.id) return null;
    const profile = ku.kakao_account?.profile ?? {};
    return {
      providerUserId: String(ku.id),
      displayName: profile.nickname ?? '카카오 사용자',
      profileImageUrl: profile.profile_image_url ?? null,
      email: ku.kakao_account?.email ?? null,
    };
  },
};
