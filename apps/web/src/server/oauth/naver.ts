import type { OAuthProvider } from './types';

export const NaverProvider: OAuthProvider = {
  id: 'naver',

  isConfigured(env) {
    if (!env.NAVER_CLIENT_ID || env.NAVER_CLIENT_ID.startsWith('TODO')) {
      return { ok: false, error: 'naver_not_configured' };
    }
    if (!env.NAVER_CLIENT_SECRET) return { ok: false, error: 'naver_not_configured' };
    return { ok: true };
  },

  authorizeUrl({ state, redirectUri, env }) {
    const params = new URLSearchParams({
      response_type: 'code',
      client_id: env.NAVER_CLIENT_ID!,
      redirect_uri: redirectUri,
      state,
    });
    return `https://nid.naver.com/oauth2.0/authorize?${params.toString()}`;
  },

  async exchangeCode({ code, state, env }) {
    const tokenParams = new URLSearchParams({
      grant_type: 'authorization_code',
      client_id: env.NAVER_CLIENT_ID!,
      client_secret: env.NAVER_CLIENT_SECRET!,
      code,
      state,
    });
    const res = await fetch(`https://nid.naver.com/oauth2.0/token?${tokenParams.toString()}`);
    const body = (await res.json()) as { access_token?: string; error?: string };
    if (!body.access_token) return { ok: false, error: body.error ?? 'unknown' };
    return { ok: true, accessToken: body.access_token };
  },

  async fetchUser(accessToken) {
    const res = await fetch('https://openapi.naver.com/v1/nid/me', {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    const nu = (await res.json()) as {
      resultcode?: string;
      response?: { id?: string; nickname?: string; profile_image?: string; email?: string; name?: string };
    };
    if (nu.resultcode !== '00' || !nu.response?.id) return null;
    return {
      providerUserId: nu.response.id,
      displayName: nu.response.nickname ?? nu.response.name ?? '네이버 사용자',
      profileImageUrl: nu.response.profile_image ?? null,
      email: nu.response.email ?? null,
    };
  },
};
