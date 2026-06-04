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
    // server endpoint는 cookie deletion만 (mobile은 cookie 없음) — clearSessionToken이 실효.
    try { await api.logout(); } catch { /* server 실패해도 local clear는 진행 */ }
    await clearSessionToken();
    setUser(null);
  }, []);

  useEffect(() => { void refresh(); }, [refresh]);

  return { user, loading, refresh, logout };
}
