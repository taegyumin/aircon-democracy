'use client';

// LLM P3: place navigation을 button + onClick → <a href>로. Yeti(네이버 봇) JS 의존 없이
// 인기 place link 발견 가능. SPA 라우팅도 e.preventDefault() + onTap()으로 유지.

import { useState } from 'react';
import { TOKEN, VOTE_CONFIG, FONT, type VoteType } from '@aircon/core';
import type { PlaceWithCounts } from '../lib/apiClient';
import { PlaceTypeIcon } from './PlaceTypeIcon';
import { brandFor } from '@aircon/core';

interface Props {
  place: PlaceWithCounts;
  onTap: () => void;
}

export function PlaceCard({ place, onTap }: Props) {
  const total = (place.cold || 0) + (place.ok || 0) + (place.hot || 0);
  const dominant: VoteType =
    total === 0
      ? 'ok'
      : place.cold >= place.ok && place.cold >= place.hot
        ? 'cold'
        : place.hot > place.ok
          ? 'hot'
          : 'ok';
  const dc = VOTE_CONFIG[dominant];
  const [hover, setHover] = useState(false);

  return (
    <a
      href={`/p/${encodeURIComponent(place.id)}`}
      onClick={(e) => {
        // 일반 클릭은 SPA 라우팅 (onTap이 router.push). cmd/ctrl/middle click는
        // 브라우저 기본(새 탭)을 그대로 두기 — 사용자 friction 줄임.
        if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
        e.preventDefault();
        onTap();
      }}
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
        textDecoration: 'none',
        color: 'inherit',
      }}
    >
      <div
        style={{
          width: 42,
          height: 42,
          borderRadius: TOKEN.r.md,
          background: brandFor(place.name) ? '#fff' : TOKEN.bg,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
          overflow: 'hidden',
        }}
      >
        <PlaceTypeIcon
          name={place.name}
          type={place.type}
          size={brandFor(place.name) ? 38 : 20}
          color={TOKEN.text2}
        />
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
        {place.district && (
          <div style={{ fontSize: 12, color: TOKEN.text3, marginTop: 2 }}>{place.district}</div>
        )}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4, flexShrink: 0 }}>
        {total > 0 ? (
          <>
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
          </>
        ) : (
          <span style={{ fontSize: 11, color: TOKEN.text3 }}>의견 없음</span>
        )}
      </div>
    </a>
  );
}
