// Session state hook for mobile.
// Native fetch는 web과 cookie 동작이 달라서 currently /api/me 호출 시 voter
// cookie 자동 동봉이 안 됨. 향후 expo-secure-store + Authorization Bearer
// 흐름으로 전환 예정. 이 sprint는 placeholder.

import { useState } from 'react';
import type { User } from './apiClient';

interface UseUserResult {
  user: User | null;
  loading: boolean;
  refresh: () => Promise<void>;
  logout: () => Promise<void>;
}

export function useUser(): UseUserResult {
  const [user] = useState<User | null>(null);
  const [loading] = useState(false);

  const refresh = async () => {
    // TODO: implement via expo-secure-store + bearer token
  };
  const logout = async () => {
    // TODO
  };
  return { user, loading, refresh, logout };
}
