// Mobile-side wrapper over @aircon/core/api.
// fetch는 RN에서도 동작 (universal). cookie는 RN의 fetch가 자동 처리 안 함 →
// 향후 react-native-cookies + 직접 관리 또는 Authorization 헤더 방식 채택.
// 첫 sprint는 read-only API 위주로 동작 확인.

export { api, type ApiPlace, type PlaceWithCounts, type PlaceDetail, type MyVote, type SubwayMatchResult, type BusMatchResult, type User, ApiError } from '@aircon/core';

// Mobile은 prod API 절대 URL이 필요. core/api는 relative path 가정 →
// 별도 wrapper로 base URL prefix 추가. (이 sprint: 단순 fetch 직접)
export const API_BASE = 'https://aircondemocracy.com';
