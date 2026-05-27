// Wizard 카테고리 single source of truth.
// 카테고리 추가/변경 시 여기만 수정 — landing grid + LocationWizardScreen 라우터가
// 모두 이 정의 사용.

import { TramFront, TrainFront, Bus, GraduationCap, MapPin, PencilLine } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

// 2026-05-27: '사무실' 카테고리 제거 — 빌딩 구조를 우리가 모르니 wizard 만들기 어려움.
// 대신 '직접 등록(custom)' — 로그인 사용자가 자기 공간(사무실, 회의실, 매장 등) 직접 등록.
// 사적 공간이라 is_public=0 default + link/QR로만 접근 (검색 노출 X).
export type Category = 'subway' | 'train' | 'bus' | 'classroom' | 'other' | 'custom';

// Claude Design 'Place Select Redesign' 추천안: 카테고리를 2그룹으로 분리해 IA 명확.
//   move = '이동 중' (지하철 / 버스 / 기차)
//   stay = '머무르는 곳' (강의실 / 카페·음식점 / 사무실)
export type CategoryGroup = 'move' | 'stay';

export interface CategoryDef {
  key: Category;
  Icon: LucideIcon;
  tint: string;
  label: string;
  sub: string;
  group: CategoryGroup;
  // 'primary'는 그룹 안에서 시각적으로 가장 큼 (지하철 — full-width row).
  // 'secondary'는 그 아래 grid. 'muted'는 빈도 낮아 opacity 살짝 낮춤 (기차).
  rank?: 'primary' | 'secondary' | 'muted';
}

export const CATEGORIES: CategoryDef[] = [
  { key: 'subway',    Icon: TramFront,     tint: '#1B53E5', label: '지하철',     sub: '수도권·부산·대구·광주 도시철도', group: 'move', rank: 'primary' },
  { key: 'bus',       Icon: Bus,           tint: '#16A34A', label: '버스',       sub: '시내·시외버스',           group: 'move', rank: 'secondary' },
  { key: 'train',     Icon: TrainFront,    tint: '#DC2626', label: '기차',       sub: 'KTX·SRT 등',             group: 'move', rank: 'muted' },
  { key: 'classroom', Icon: GraduationCap, tint: '#7C3AED', label: '강의실',     sub: '학교·대학교',             group: 'stay', rank: 'secondary' },
  { key: 'other',     Icon: MapPin,        tint: '#F97316', label: '카페·음식점', sub: '카페·식당',              group: 'stay', rank: 'secondary' },
  // 다른 장소 찾기 — 사무실·회의실 등 검색하거나 직접 등록. WizardLanding에서 stay grid
  // 와 분리된 footer row로 노출 (Place Select Redesign v2).
  { key: 'custom',    Icon: PencilLine,    tint: '#475569', label: '다른 장소 찾기', sub: '사무실·회의실 등 — 검색하거나 직접 등록',  group: 'stay', rank: 'secondary' },
];
