// Wizard 카테고리 single source of truth.
// 카테고리 추가/변경 시 여기만 수정 — landing grid + LocationWizardScreen 라우터가
// 모두 이 정의 사용.

import { TramFront, TrainFront, Bus, GraduationCap, Building2, MapPin } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

export type Category = 'subway' | 'train' | 'bus' | 'classroom' | 'office' | 'other';

export interface CategoryDef {
  key: Category;
  Icon: LucideIcon;
  tint: string;
  label: string;
  sub: string;
}

export const CATEGORIES: CategoryDef[] = [
  { key: 'subway',    Icon: TramFront,     tint: '#1B53E5', label: '지하철',     sub: '도시철도' },
  { key: 'train',     Icon: TrainFront,    tint: '#DC2626', label: '기차',       sub: 'KTX·SRT·무궁화호 등' },
  { key: 'bus',       Icon: Bus,           tint: '#16A34A', label: '버스',       sub: '시내·시외' },
  { key: 'classroom', Icon: GraduationCap, tint: '#7C3AED', label: '강의실',     sub: '학교' },
  { key: 'other',     Icon: MapPin,        tint: '#F97316', label: '카페·음식점', sub: '지도에서 위치 찍기' },
  { key: 'office',    Icon: Building2,     tint: '#475569', label: '사무실',     sub: '회사' },
];
