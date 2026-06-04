// Mobile-side API client — voter token persistence via AsyncStorage.
//
// 흐름:
//   1. 첫 요청에 Authorization 없음 → server가 voterCookieMiddleware에서 새 voterId 발급
//      + X-Aircon-Voter-Token 응답 헤더에 token 박음 + Set-Cookie (RN은 cookie 못 받음)
//   2. onResponse에서 X-Aircon-Voter-Token 헤더 capture → AsyncStorage 저장
//   3. 이후 모든 요청에 Authorization: Bearer voter:<token> 첨부 → server가 HMAC verify
//   4. csrfGuard는 voterSource === 'bearer'면 Origin 검사 면제 (mobile에 Origin 없음)
//
// 보안: voter token은 anonymity 토큰 (vote bucket key)이지 user credential 아님.
// AsyncStorage 수준 보안으로 cookie와 동등. expo-secure-store 추가는 별도 sprint.

import AsyncStorage from '@react-native-async-storage/async-storage';
import { createApiClient } from '@aircon/core';

export { type ApiPlace, type PlaceWithCounts, type PlaceDetail, type MyVote, type SubwayMatchResult, type BusMatchResult, type User, type ApiClient, ApiError } from '@aircon/core';

export const API_BASE = 'https://aircondemocracy.com';

const VOTER_TOKEN_KEY = '@aircon/voter-token';

// Cache token in-memory after first read — AsyncStorage는 async라 매 요청마다 await는 비쌈.
let cachedToken: string | null | undefined = undefined;

async function getVoterToken(): Promise<string | null> {
  if (cachedToken !== undefined) return cachedToken;
  try {
    cachedToken = await AsyncStorage.getItem(VOTER_TOKEN_KEY);
  } catch {
    cachedToken = null;
  }
  return cachedToken;
}

async function saveVoterToken(token: string): Promise<void> {
  cachedToken = token;
  try {
    await AsyncStorage.setItem(VOTER_TOKEN_KEY, token);
  } catch {
    // 저장 실패해도 in-memory cache는 동작. 앱 재시작 시 새 token 발급될 뿐.
  }
}

export const api = createApiClient({
  baseUrl: API_BASE,
  credentials: 'omit', // RN cookie jar 없음 — Bearer 패턴으로 통일.
  getAuthHeaders: async (): Promise<Record<string, string>> => {
    const token = await getVoterToken();
    return token ? { Authorization: `Bearer voter:${token}` } : {};
  },
  onResponse: (res) => {
    // server가 voter 신규 발급했으면 X-Aircon-Voter-Token 헤더에 token 박힘.
    const newToken = res.headers.get('X-Aircon-Voter-Token');
    if (newToken) void saveVoterToken(newToken);
  },
});
