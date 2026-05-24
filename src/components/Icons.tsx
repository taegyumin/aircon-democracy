import { TOKEN } from '../lib/tokens';
import type { PlaceType } from '../lib/places';

interface IconProps {
  size?: number;
  color?: string;
}

export function SnowflakeIcon({ size = 28, color = TOKEN.cold }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <line x1="12" y1="2" x2="12" y2="22" stroke={color} strokeWidth="2" strokeLinecap="round" />
      <line x1="2" y1="12" x2="22" y2="12" stroke={color} strokeWidth="2" strokeLinecap="round" />
      <line x1="5" y1="5" x2="19" y2="19" stroke={color} strokeWidth="2" strokeLinecap="round" />
      <line x1="19" y1="5" x2="5" y2="19" stroke={color} strokeWidth="2" strokeLinecap="round" />
      <line x1="12" y1="2" x2="9.5" y2="4.5" stroke={color} strokeWidth="1.5" strokeLinecap="round" />
      <line x1="12" y1="2" x2="14.5" y2="4.5" stroke={color} strokeWidth="1.5" strokeLinecap="round" />
      <line x1="12" y1="22" x2="9.5" y2="19.5" stroke={color} strokeWidth="1.5" strokeLinecap="round" />
      <line x1="12" y1="22" x2="14.5" y2="19.5" stroke={color} strokeWidth="1.5" strokeLinecap="round" />
      <line x1="2" y1="12" x2="4.5" y2="9.5" stroke={color} strokeWidth="1.5" strokeLinecap="round" />
      <line x1="2" y1="12" x2="4.5" y2="14.5" stroke={color} strokeWidth="1.5" strokeLinecap="round" />
      <line x1="22" y1="12" x2="19.5" y2="9.5" stroke={color} strokeWidth="1.5" strokeLinecap="round" />
      <line x1="22" y1="12" x2="19.5" y2="14.5" stroke={color} strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

export function FlameIcon({ size = 28, color = TOKEN.hot }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <path
        d="M12 2C9 6 7 9 7 13c0 2.8 1.4 5.2 3.5 6.6-.3-.8-.5-1.7-.5-2.6 0-2.5 1.5-4.5 3-6 .5 2.5 1.5 4 1.5 6 0 1.2-.3 2.4-.9 3.3C16.2 19.2 17.5 16.7 17.5 14c0-3.5-2-6.3-5.5-9.5z"
        stroke={color}
        strokeWidth="1.8"
        strokeLinejoin="round"
        fill="none"
      />
      <path
        d="M12 22c-2.2 0-4-1.8-4-4 0-1.8 1-3 2-4 .2 1 .7 1.8 1.5 2.5.3-1 .5-2 .5-3 1.3 1.3 2 2.8 2 4.5 0 2.2-1.8 4-2 4z"
        fill={color}
        stroke={color}
        strokeWidth="0.5"
      />
    </svg>
  );
}

export function OkIcon({ size = 28, color = TOKEN.ok }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="12" r="9" stroke={color} strokeWidth="2" />
      <path d="M7.5 12.5L10.5 15.5L16.5 9" stroke={color} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

interface PlaceIconProps {
  type: PlaceType;
  size?: number;
  color?: string;
}

export function PlaceIcon({ type, size = 20, color = TOKEN.text2 }: PlaceIconProps) {
  const s = { stroke: color, strokeWidth: '1.7', strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const, fill: 'none' };
  switch (type) {
    case 'classroom':
      return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
          <rect x="2" y="4" width="20" height="14" rx="2" {...s} />
          <path d="M8 22h8M12 18v4M7 9h10M7 13h6" {...s} />
        </svg>
      );
    case 'subway':
      return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
          <rect x="5" y="3" width="14" height="15" rx="3" {...s} />
          <circle cx="8.5" cy="15.5" r="1.5" {...s} />
          <circle cx="15.5" cy="15.5" r="1.5" {...s} />
          <path d="M5 9h14M7 20l-2 2M17 20l2 2" {...s} />
        </svg>
      );
    case 'cafe':
      return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
          <path d="M4 11h14l-2 8H6L4 11z" {...s} />
          <path d="M18 13h1.5a2.5 2.5 0 000-5H18M8 3c0 2-2 2-2 4M12 3c0 2-2 2-2 4" {...s} />
        </svg>
      );
    case 'bus':
      return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
          <rect x="3" y="5" width="18" height="13" rx="2" {...s} />
          <path d="M3 9h18M7.5 18v-4M16.5 18v-4M7 13h4M13 13h4" {...s} />
          <circle cx="7.5" cy="20" r="1.5" {...s} />
          <circle cx="16.5" cy="20" r="1.5" {...s} />
        </svg>
      );
    case 'library':
      return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
          <path d="M4 3h4v18H4zM10 3h4v18h-4zM16.5 3.5L20 4.5l-4 15.5-3.5-1z" {...s} />
        </svg>
      );
    default:
      return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
          <rect x="3" y="3" width="18" height="18" rx="2" {...s} />
          <path d="M8 7h8M8 12h8M8 17h5" {...s} />
        </svg>
      );
  }
}

export function BackIcon({ size = 22, color = TOKEN.text1 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <path d="M15 18l-6-6 6-6" stroke={color} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
