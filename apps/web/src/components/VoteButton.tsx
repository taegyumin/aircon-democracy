'use client';

import { useState } from 'react';
import { TOKEN, VOTE_CONFIG, FONT, type VoteType } from '@aircon/core';
import { SnowflakeIcon, OkIcon, FlameIcon } from './Icons';

const ICONS = { cold: SnowflakeIcon, ok: OkIcon, hot: FlameIcon };

interface Props {
  type: VoteType;
  selected: boolean;
  disabled?: boolean;
  onClick: () => void;
}

export function VoteButton({ type, selected, disabled, onClick }: Props) {
  const c = VOTE_CONFIG[type];
  const Icon = ICONS[type];
  const [pressed, setPressed] = useState(false);

  return (
    <button
      onPointerDown={() => setPressed(true)}
      onPointerUp={() => setPressed(false)}
      onPointerLeave={() => setPressed(false)}
      onClick={disabled ? undefined : onClick}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 14,
        width: '100%',
        padding: '18px 20px',
        borderRadius: TOKEN.r.lg,
        border: `2px solid ${selected ? c.color : TOKEN.border}`,
        background: selected ? c.color : TOKEN.surface,
        color: selected ? '#fff' : c.color,
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.4 : 1,
        transition: 'all 0.2s cubic-bezier(0.34,1.56,0.64,1)',
        transform: pressed && !disabled ? 'scale(0.97)' : selected ? 'scale(1.015)' : 'scale(1)',
        fontFamily: FONT,
        fontWeight: 700,
        fontSize: 20,
        letterSpacing: '-0.3px',
        boxShadow: selected ? `0 6px 28px ${c.color}38` : '0 1px 4px rgba(0,0,0,0.06)',
        textAlign: 'left',
      }}
    >
      <div
        style={{
          width: 44,
          height: 44,
          borderRadius: TOKEN.r.md,
          background: selected ? 'rgba(255,255,255,0.2)' : c.bg,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
          transition: 'background 0.2s',
        }}
      >
        <Icon size={26} color={selected ? '#fff' : c.color} />
      </div>
      <span>{c.label}</span>
    </button>
  );
}
