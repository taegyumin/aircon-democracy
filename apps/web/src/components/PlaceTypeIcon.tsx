'use client';

import {
  GraduationCap,
  Library,
  Coffee,
  TrainFront,
  TramFront,
  Bus,
  Building2,
  MapPin,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { TOKEN } from '@aircon/core';
import { brandFor } from '@aircon/core';
import type { PlaceType } from '@aircon/core';

interface Props {
  name: string;
  type: PlaceType;
  size?: number;
  color?: string;
}

const TYPE_ICON: Record<PlaceType, LucideIcon> = {
  classroom: GraduationCap,
  library: Library,
  cafe: Coffee,
  subway: TramFront,
  train: TrainFront,
  bus: Bus,
  office: Building2,
  other: MapPin,
};

export function PlaceTypeIcon({ name, type, size = 20, color = TOKEN.text2 }: Props) {
  const brand = brandFor(name);
  if (brand) {
    return (
      <img
        src={brand.iconUrl}
        alt=""
        width={size}
        height={size}
        style={{
          display: 'block',
          width: size,
          height: size,
          objectFit: 'contain',
          objectPosition: 'center',
        }}
      />
    );
  }
  const Icon = TYPE_ICON[type] ?? MapPin;
  return <Icon size={size} color={color} strokeWidth={2} />;
}
