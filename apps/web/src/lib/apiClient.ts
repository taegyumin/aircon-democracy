// Browser-side wrapper over @aircon/core/api.
// Core is universal but uses relative paths ('/api/...') which only work in
// browser context. For Server Components we'd use absolute URL via env.
// For now, only client islands call /api so relative paths are fine.

export { api, type ApiPlace, type PlaceWithCounts, type PlaceDetail, type MyVote, type SubwayMatchResult, type BusMatchResult, type User, ApiError, KAKAO_LOGIN_URL, NAVER_LOGIN_URL, GOOGLE_LOGIN_URL } from '@aircon/core';
