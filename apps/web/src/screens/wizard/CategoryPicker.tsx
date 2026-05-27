'use client';

// 카테고리 그리드 — WizardLanding과 HomeScreen이 공유.
// Place Select Redesign + Home Redesign v2: 지하철 primary row, 버스/기차 split,
// 머무르는 곳 split (강의실 / 카페·음식점), 다른 장소 찾기 footer row.

import { TOKEN, FONT } from '@aircon/core';
import { CATEGORIES, type Category, type CategoryDef } from './categories';

interface Props {
  onPick: (k: Category) => void;
}

function ArrowRight({ color = TOKEN.cold, size = 17 }: { color?: string; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="M5 12h14M13 6l6 6-6 6" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        fontSize: 11, fontWeight: 700, color: TOKEN.text3,
        letterSpacing: '1px', textTransform: 'uppercase', marginBottom: 10,
      }}
    >
      {children}
    </div>
  );
}

function PrimaryRow({ c, onPick }: { c: CategoryDef; onPick: () => void }) {
  const Icon = c.Icon;
  return (
    <button
      onClick={onPick}
      style={{
        width: '100%', display: 'flex', alignItems: 'center', gap: 13,
        background: TOKEN.surface, borderRadius: 16, padding: '16px',
        border: `1.5px solid ${c.tint}22`,
        boxShadow: `0 2px 12px ${c.tint}14`,
        cursor: 'pointer', fontFamily: FONT, textAlign: 'left',
        marginBottom: 8,
      }}
    >
      <div
        style={{
          width: 44, height: 44, borderRadius: 12, flexShrink: 0,
          background: c.tint + '15',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}
      >
        <Icon size={22} color={c.tint} strokeWidth={2.1} />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 3 }}>
          <span style={{ fontSize: 16, fontWeight: 700, color: TOKEN.text1, letterSpacing: '-0.3px' }}>
            {c.label}
          </span>
          <span
            style={{
              fontSize: 10, fontWeight: 700, color: c.tint,
              background: c.tint + '15', padding: '2px 8px', borderRadius: 999,
            }}
          >
            자주 선택
          </span>
        </div>
        <div style={{ fontSize: 12, color: TOKEN.text2 }}>{c.sub}</div>
      </div>
      <ArrowRight color={c.tint} />
    </button>
  );
}

function SecondaryTile({ c, onPick, muted }: { c: CategoryDef; onPick: () => void; muted?: boolean }) {
  const Icon = c.Icon;
  return (
    <button
      onClick={onPick}
      style={{
        flex: 1, display: 'flex', flexDirection: 'column', gap: 12,
        background: TOKEN.surface, borderRadius: 16, padding: '16px 14px',
        border: `1px solid ${TOKEN.border}`,
        boxShadow: '0 1px 5px rgba(0,0,0,0.05)',
        cursor: 'pointer', fontFamily: FONT, textAlign: 'left',
        opacity: muted ? 0.85 : 1,
        minWidth: 0,
      }}
    >
      <div
        style={{
          width: 40, height: 40, borderRadius: 10,
          background: muted ? TOKEN.bg : c.tint + '12',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}
      >
        <Icon size={20} color={muted ? TOKEN.text2 : c.tint} strokeWidth={2.1} />
      </div>
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: muted ? TOKEN.text2 : TOKEN.text1, marginBottom: 3, letterSpacing: '-0.2px' }}>
          {c.label}
        </div>
        <div style={{ fontSize: 11, color: TOKEN.text3, lineHeight: 1.4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {c.sub}
        </div>
      </div>
    </button>
  );
}

function SearchIcon({ size = 18, color = '#6B6B7A' }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle cx="11" cy="11" r="8" stroke={color} strokeWidth="2" />
      <path d="M21 21l-4.35-4.35" stroke={color} strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

function FindOtherRow({ c, onPick }: { c: CategoryDef; onPick: () => void }) {
  return (
    <button
      onClick={onPick}
      style={{
        width: '100%', display: 'flex', alignItems: 'center', gap: 12,
        background: TOKEN.surface, borderRadius: 16, padding: '14px 16px',
        border: `1px solid ${TOKEN.border}`,
        boxShadow: '0 1px 5px rgba(0,0,0,0.05)',
        cursor: 'pointer', fontFamily: FONT, textAlign: 'left',
      }}
    >
      <div
        style={{
          width: 36, height: 36, borderRadius: '50%', flexShrink: 0,
          background: TOKEN.bg,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}
      >
        <SearchIcon size={18} color={TOKEN.text2} />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: TOKEN.text1, letterSpacing: '-0.2px', marginBottom: 2 }}>
          다른 장소 찾기
        </div>
        <div style={{ fontSize: 11, color: TOKEN.text3, lineHeight: 1.4 }}>
          {c.sub}
        </div>
      </div>
      <ArrowRight color={TOKEN.text3} />
    </button>
  );
}

export function CategoryPicker({ onPick }: Props) {
  const moveCats = CATEGORIES.filter((c) => c.group === 'move');
  const stayCats = CATEGORIES.filter((c) => c.group === 'stay' && c.key !== 'custom');
  const customCat = CATEGORIES.find((c) => c.key === 'custom');
  const primaryMove = moveCats.find((c) => c.rank === 'primary');
  const secondaryMove = moveCats.filter((c) => c.rank !== 'primary');

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 22 }}>
      <div>
        <SectionLabel>이동 중</SectionLabel>
        {primaryMove && <PrimaryRow c={primaryMove} onPick={() => onPick(primaryMove.key)} />}
        {secondaryMove.length > 0 && (
          <div style={{ display: 'flex', gap: 8 }}>
            {secondaryMove.map((c) => (
              <SecondaryTile key={c.key} c={c} onPick={() => onPick(c.key)} muted={c.rank === 'muted'} />
            ))}
          </div>
        )}
      </div>
      <div>
        <SectionLabel>머무르는 곳</SectionLabel>
        <div style={{ display: 'flex', gap: 8 }}>
          {stayCats.map((c) => (
            <SecondaryTile key={c.key} c={c} onPick={() => onPick(c.key)} />
          ))}
        </div>
      </div>
      {customCat && <FindOtherRow c={customCat} onPick={() => onPick(customCat.key)} />}
    </div>
  );
}
