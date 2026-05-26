// Mobile-side API client.
// RN fetch에는 brwoser cookie jar가 없어서 web의 default `api` (cookie credentials)
// 를 그대로 쓰면 voter cookie 영구화 안 됨 → vote history 깨짐.
// → createApiClient factory로 baseUrl + (예정) Authorization 헤더 주입.
//
// 현재 단계: factory만 도입. 다음 단계 (mobile 빌드 직전):
//   - Expo SecureStore에 voter token + session token 저장
//   - getAuthHeaders가 'Authorization: Bearer voter:<id>.<sig>' 생성
//   - server _abuse.ts에 Authorization 헤더도 받게 추가

import { createApiClient } from '@aircon/core';

export { type ApiPlace, type PlaceWithCounts, type PlaceDetail, type MyVote, type SubwayMatchResult, type BusMatchResult, type User, type ApiClient, ApiError } from '@aircon/core';

export const API_BASE = 'https://aircondemocracy.com';

// Mobile factory. 현재는 cookie credentials 그대로 — RN에서 단발 read는 작동.
// vote/upsert 등 mutation은 voter cookie 영구화가 필요해서 다음 PR에서 token 패턴 도입.
export const api = createApiClient({
  baseUrl: API_BASE,
  // credentials: 'omit',  // 나중에 token 패턴 도입 시 활성
  // getAuthHeaders: async () => ({ Authorization: `Bearer ${await getVoterToken()}` }),
});
