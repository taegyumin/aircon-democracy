// Mobile wizard 카테고리 — web categories.ts와 같은 shape. Icon만 platform 분기.
// 아이콘은 packages/core 공유 못 함 (web=lucide-react, mobile=lucide-react-native or SVG).
// 자체 SVG 컴포넌트로 정의 — 0 dep + web/mobile 비주얼 일관성.

import * as React from 'react';
import Svg, { Path, Rect, Circle, Line } from 'react-native-svg';

export type Category = 'subway' | 'train' | 'bus' | 'classroom' | 'other' | 'custom';
export type CategoryGroup = 'move' | 'stay';

export interface IconProps {
  size?: number;
  color?: string;
  strokeWidth?: number;
}

type IconCmp = (props: IconProps) => React.ReactElement;

const SubwayIcon: IconCmp = ({ size = 22, color = '#1B53E5', strokeWidth = 2 }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <Rect x="5" y="3" width="14" height="15" rx="3" stroke={color} strokeWidth={strokeWidth} />
    <Circle cx="8.5" cy="15.5" r="1.5" fill={color} />
    <Circle cx="15.5" cy="15.5" r="1.5" fill={color} />
    <Line x1="5" y1="9" x2="19" y2="9" stroke={color} strokeWidth={strokeWidth} />
    <Path d="M7 20l-2 2M17 20l2 2" stroke={color} strokeWidth={strokeWidth * 0.8} strokeLinecap="round" />
  </Svg>
);

const BusIcon: IconCmp = ({ size = 22, color = '#16A34A', strokeWidth = 2 }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <Rect x="2" y="5" width="20" height="13" rx="2.5" stroke={color} strokeWidth={strokeWidth} />
    <Line x1="2" y1="9" x2="22" y2="9" stroke={color} strokeWidth={strokeWidth} />
    <Circle cx="6.5" cy="20" r="2" stroke={color} strokeWidth={strokeWidth * 0.8} />
    <Circle cx="17.5" cy="20" r="2" stroke={color} strokeWidth={strokeWidth * 0.8} />
  </Svg>
);

const TrainIcon: IconCmp = ({ size = 22, color = '#DC2626', strokeWidth = 2 }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <Path d="M3 15L5.5 6h13L21 15H3z" stroke={color} strokeWidth={strokeWidth} strokeLinejoin="round" />
    <Circle cx="7.5" cy="18.5" r="2" stroke={color} strokeWidth={strokeWidth * 0.8} />
    <Circle cx="16.5" cy="18.5" r="2" stroke={color} strokeWidth={strokeWidth * 0.8} />
    <Line x1="10" y1="15" x2="10" y2="9" stroke={color} strokeWidth={strokeWidth * 0.8} strokeLinecap="round" />
    <Line x1="14" y1="15" x2="14" y2="9" stroke={color} strokeWidth={strokeWidth * 0.8} strokeLinecap="round" />
  </Svg>
);

const ClassroomIcon: IconCmp = ({ size = 22, color = '#7C3AED', strokeWidth = 2 }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <Path d="M22 10L12 5 2 10l10 5 10-5z" stroke={color} strokeWidth={strokeWidth} strokeLinejoin="round" />
    <Path d="M6 12v5c0 1 3 3 6 3s6-2 6-3v-5" stroke={color} strokeWidth={strokeWidth} strokeLinejoin="round" />
    <Path d="M22 10v6" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" />
  </Svg>
);

const CafeIcon: IconCmp = ({ size = 22, color = '#F97316', strokeWidth = 2 }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <Path d="M21 10c0 5-4 11-9 11s-9-6-9-11" stroke={color} strokeWidth={strokeWidth} />
    <Circle cx="12" cy="9" r="3" stroke={color} strokeWidth={strokeWidth} />
  </Svg>
);

const CustomIcon: IconCmp = ({ size = 22, color = '#475569', strokeWidth = 2 }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <Path d="M12 20h9" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" />
    <Path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" />
  </Svg>
);

export const SearchIcon: IconCmp = ({ size = 18, color = '#6B6B7A', strokeWidth = 2 }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <Circle cx="11" cy="11" r="8" stroke={color} strokeWidth={strokeWidth} />
    <Path d="M21 21l-4.35-4.35" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" />
  </Svg>
);

export const ArrowRightIcon: IconCmp = ({ size = 17, color = '#1B53E5', strokeWidth = 2 }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <Path d="M5 12h14M13 6l6 6-6 6" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" />
  </Svg>
);

export interface CategoryDef {
  key: Category;
  Icon: IconCmp;
  tint: string;
  label: string;
  sub: string;
  group: CategoryGroup;
  rank?: 'primary' | 'secondary' | 'muted';
}

export const CATEGORIES: CategoryDef[] = [
  { key: 'subway',    Icon: SubwayIcon,    tint: '#1B53E5', label: '지하철',     sub: '수도권·부산·대구·광주 도시철도', group: 'move', rank: 'primary' },
  { key: 'bus',       Icon: BusIcon,       tint: '#16A34A', label: '버스',       sub: '시내·시외버스',           group: 'move', rank: 'secondary' },
  { key: 'train',     Icon: TrainIcon,     tint: '#DC2626', label: '기차',       sub: 'KTX·SRT 등',             group: 'move', rank: 'muted' },
  { key: 'classroom', Icon: ClassroomIcon, tint: '#7C3AED', label: '대학교 강의실', sub: '캠퍼스·건물·강의실 단위',  group: 'stay', rank: 'secondary' },
  { key: 'other',     Icon: CafeIcon,      tint: '#F97316', label: '카페·음식점', sub: '카페·식당',              group: 'stay', rank: 'secondary' },
  { key: 'custom',    Icon: CustomIcon,    tint: '#475569', label: '다른 장소 찾기', sub: '사무실·회의실 등 — 검색하거나 직접 등록',  group: 'stay', rank: 'secondary' },
];
