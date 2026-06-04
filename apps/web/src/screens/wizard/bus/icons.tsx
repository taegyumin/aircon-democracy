'use client';

// Bus wizard inline SVG icons. lucide-react 안 쓰고 inline — 디자인 의도 그대로.
// 7개 icon을 BusWizard.tsx (1356줄)에서 추출. 다른 wizard와는 별개 (스타일 디테일 다름).

import { TOKEN } from '@aircon/core';

export function ArrowRight({ color = TOKEN.text3, size = 16 }: { color?: string; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="M5 12h14M13 6l6 6-6 6" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function CheckIcon({ color = TOKEN.ok, size = 15 }: { color?: string; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="M4.5 12.5l5 5L19.5 7" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function SearchIcon({ size = 16, color = TOKEN.text3 }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle cx="11" cy="11" r="8" stroke={color} strokeWidth="2" />
      <path d="M21 21l-4.35-4.35" stroke={color} strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

export function GpsIcon({ size = 22, color = '#fff' }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle cx="12" cy="12" r="8" stroke={color} strokeWidth="1.8" />
      <circle cx="12" cy="12" r="3" fill={color} />
      <line x1="12" y1="2" x2="12" y2="5" stroke={color} strokeWidth="1.8" strokeLinecap="round" />
      <line x1="12" y1="19" x2="12" y2="22" stroke={color} strokeWidth="1.8" strokeLinecap="round" />
      <line x1="2" y1="12" x2="5" y2="12" stroke={color} strokeWidth="1.8" strokeLinecap="round" />
      <line x1="19" y1="12" x2="22" y2="12" stroke={color} strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

export function MapPinIcon({ size = 14, color = TOKEN.text3 }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="M12 21C12 21 5 14 5 9a7 7 0 1114 0c0 5-7 12-7 12z" stroke={color} strokeWidth="1.8" />
      <circle cx="12" cy="9" r="2.5" fill={color} />
    </svg>
  );
}

export function BusGlyph({ size = 22, color = '#fff' }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden>
      <rect x="2" y="5" width="20" height="13" rx="2.5" stroke={color} strokeWidth="1.8" />
      <line x1="2" y1="9" x2="22" y2="9" stroke={color} strokeWidth="1.8" />
      <circle cx="6.5" cy="20" r="2" stroke={color} strokeWidth="1.6" />
      <circle cx="17.5" cy="20" r="2" stroke={color} strokeWidth="1.6" />
      <line x1="6.5" y1="18" x2="6.5" y2="13" stroke={color} strokeWidth="1.6" strokeLinecap="round" />
      <line x1="17.5" y1="18" x2="17.5" y2="13" stroke={color} strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

// MiniBusIcon — BusProgressInline 카드의 작은 버스 indicator.
// 28×14 viewBox, 채워진 fill 스타일 (다른 icons는 outline).
export function MiniBusIcon({ color }: { color: string }) {
  return (
    <svg width={28} height={14} viewBox="0 0 28 14" style={{ display: 'block' }} aria-hidden>
      <rect x="1" y="2" width="22" height="9" rx="2" fill={color} />
      <rect x="3" y="3.5" width="4" height="4" rx="0.6" fill="rgba(255,255,255,0.55)" />
      <rect x="8.5" y="3.5" width="4" height="4" rx="0.6" fill="rgba(255,255,255,0.55)" />
      <rect x="14" y="3.5" width="4" height="4" rx="0.6" fill="rgba(255,255,255,0.55)" />
      <rect x="19.5" y="3" width="3" height="6" rx="0.8" fill="rgba(255,255,255,0.3)" />
      <circle cx="6" cy="12" r="1.5" fill={color} />
      <circle cx="18" cy="12" r="1.5" fill={color} />
    </svg>
  );
}
