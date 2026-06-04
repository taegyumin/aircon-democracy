// Session state hook for mobile.
// X-Aircon-Session 헤더는 apiClient.getAuthHeaders가 자동 첨부.
// /api/me 호출만 하면 session token 기반 인증된 user 반환.

import { useCallback, useEffect, useState } from 'react';
import { api, clearSessionToken, type User } from './apiClient';

interface UseUserResult {
  user: User | null;
  loading: boolean;
  refresh: () => Promise<void>;
  logout: () => Promise<void>;
}

export function useUser(): UseUserResult {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.me();
      setUser(res.user);
    } catch {
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  const logout = useCallback(async () => {
    // mobile에서는 server logout이 noop (cookie 없음). local clear가 실효.
    // fire-and-forget: 네트워크 없어도 UX는 즉시 진행.
    void api.logout().catch(() => { /* 무시 */ });
    await clearSessionToken();
    setUser(null);
  }, []);

  useEffect(() => { void refresh(); }, [refresh]);

  return { user, loading, refresh, logout };
}
