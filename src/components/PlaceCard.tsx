import { useState } from 'react';
import { TOKEN, VOTE_CONFIG, FONT, type VoteType } from '../lib/tokens';
import type { Place } from '../lib/places';
import { PlaceIcon } from './Icons';

interface Props {
  place: Place;
  onTap: () => void;
}

export function PlaceCard({ place, onTap }: Props) {
  const total = (place.votes.cold || 0) + (place.votes.ok || 0) + (place.votes.hot || 0);
  const dominant: VoteType =
    total === 0
      ? 'ok'
      : place.votes.cold >= place.votes.ok && place.votes.cold >= place.votes.hot
        ? 'cold'
        : place.votes.hot > place.votes.ok
          ? 'hot'
          : 'ok';
  const dc = VOTE_CONFIG[dominant];
  const [hover, setHover] = useState(false);

  return (
    <button
      onClick={onTap}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        width: '100%',
        padding: '12px 14px',
        background: hover ? TOKEN.surface2 : TOKEN.surface,
        border: `1.5px solid ${hover ? TOKEN.border : 'transparent'}`,
        borderRadius: TOKEN.r.lg,
        textAlign: 'left',
        cursor: 'pointer',
        boxShadow: '0 1px 5px rgba(0,0,0,0.06)',
        transition: 'all 0.15s',
        fontFamily: FONT,
      }}
    >
      <div
        style={{
          width: 42,
          height: 42,
          borderRadius: TOKEN.r.md,
          background: TOKEN.bg,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
        }}
      >
        <PlaceIcon type={place.type} size={20} color={TOKEN.text2} />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            fontSize: 14,
            fontWeight: 700,
            color: TOKEN.text1,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {place.name}
        </div>
        <div style={{ fontSize: 12, color: TOKEN.text3, marginTop: 2 }}>
          {place.district} · {place.distance}
        </div>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4, flexShrink: 0 }}>
        <span
          style={{
            fontSize: 11,
            fontWeight: 700,
            color: dc.color,
            background: dc.bg,
            padding: '3px 9px',
            borderRadius: 999,
          }}
        >
          {dc.label}
        </span>
        <span style={{ fontSize: 11, color: TOKEN.text3 }}>{total}명</span>
      </div>
    </button>
  );
}
