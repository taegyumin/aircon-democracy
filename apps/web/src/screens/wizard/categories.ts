// Wizard 카테고리 single source of truth.
// 카테고리 추가/변경 시 여기만 수정 — landing grid + LocationWizardScreen 라우터가
// 모두 이 정의 사용.

import { TramFront, TrainFront, Bus, GraduationCap, Building2, MapPin } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

export type Category = 'subway' | 'train' | 'bus' | 'classroom' | 'office' | 'other';

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
  { key: 'office',    Icon: Building2,     tint: '#475569', label: '사무실',     sub: '직장·회사',              group: 'stay', rank: 'secondary' },
];
