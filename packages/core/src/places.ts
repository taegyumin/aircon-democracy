// PlaceType은 validation.ts(Zod schema)가 SOT. 여기는 re-export로 호환성 유지.
// 이전엔 별도 type alias로 정의 — Zod와 동기화 안 되는 drift 위험. 한 곳에서만.
export type { PlaceType } from './validation';
