import type { OAuthProvider } from './types';

export const GoogleProvider: OAuthProvider = {
  id: 'google',

  isConfigured(env) {
    if (!env.GOOGLE_CLIENT_ID || env.GOOGLE_CLIENT_ID.startsWith('TODO')) {
      return { ok: false, error: 'google_not_configured' };
    }
    if (!env.GOOGLE_CLIENT_SECRET) return { ok: false, error: 'google_not_configured' };
    return { ok: true };
  },

  authorizeUrl({ state, redirectUri, env }) {
    const params = new URLSearchParams({
      response_type: 'code',
      client_id: env.GOOGLE_CLIENT_ID!,
      redirect_uri: redirectUri,
      state,
      scope: 'openid email profile',
      access_type: 'online',
      prompt: 'select_account',
    });
    return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
  },

  async exchangeCode({ code, redirectUri, env }) {
    const tokenForm = new URLSearchParams({
      grant_type: 'authorization_code',
      client_id: env.GOOGLE_CLIENT_ID!,
      client_secret: env.GOOGLE_CLIENT_SECRET!,
      code,
      redirect_uri: redirectUri,
    });
    const res = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: tokenForm.toString(),
    });
    const body = (await res.json()) as { access_token?: string; error?: string; error_description?: string };
    if (!body.access_token) return { ok: false, error: body.error ?? 'unknown' };
    return { ok: true, accessToken: body.access_token };
  },

  async fetchUser(accessToken) {
    const res = await fetch('https://openidconnect.googleapis.com/v1/userinfo', {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    const gu = (await res.json()) as { sub?: string; name?: string; picture?: string; email?: string };
    if (!gu.sub) return null;
    return {
      providerUserId: gu.sub,
      displayName: gu.name ?? '구글 사용자',
      profileImageUrl: gu.picture ?? null,
      email: gu.email ?? null,
    };
  },
};
