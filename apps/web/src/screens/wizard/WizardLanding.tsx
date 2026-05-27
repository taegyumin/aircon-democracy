'use client';

// Wizard 첫 화면 — Claude Design 'Place Select Redesign' 추천안 적용.
// 결정 이력:
//   2026-05-26: 검색창 제거 (통합 검색 의미 없음).
//   2026-05-27: GPS '근처 역 찾기' 제거 (지하철만 fast-lane이라 ROI 낮음).
//   2026-05-27: 카테고리 2그룹 분리 (이동 중 / 머무르는 곳) — 디자인 추천안.
//     지하철은 full-width row + "자주 선택" badge (사용 빈도 가장 큼).
//     기차는 muted (사용 빈도 낮음 — KTX/SRT는 가끔).

import { TOKEN, FONT } from '@aircon/core';
import { CATEGORIES, type Category, type CategoryDef } from './categories';
import { WizardHeader } from './WizardHeader';

interface Props {
  onPickCategory: (k: Category) => void;
  onBack: () => void;
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
  // 지하철용 — full-width row + "자주 선택" badge + 노선 색 accent
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

export function WizardLanding({ onPickCategory, onBack }: Props) {
  const moveCats = CATEGORIES.filter((c) => c.group === 'move');
  // 'custom'은 별도 footer row로 분리 (Place Select Redesign v2). stay grid에서 제외.
  const stayCats = CATEGORIES.filter((c) => c.group === 'stay' && c.key !== 'custom');
  const customCat = CATEGORIES.find((c) => c.key === 'custom');
  const primaryMove = moveCats.find((c) => c.rank === 'primary');
  const secondaryMove = moveCats.filter((c) => c.rank !== 'primary');

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', background: TOKEN.bg, fontFamily: FONT }}>
      <WizardHeader title="지금 어디 계세요?" onBack={onBack} />
      <div style={{ flex: 1, overflowY: 'auto', padding: '22px 16px 48px', display: 'flex', flexDirection: 'column', gap: 22 }}>
        {/* 이동 중 — 지하철 primary + 버스/기차 side-by-side */}
        <div>
          <SectionLabel>이동 중</SectionLabel>
          {primaryMove && (
            <PrimaryRow c={primaryMove} onPick={() => onPickCategory(primaryMove.key)} />
          )}
          {secondaryMove.length > 0 && (
            <div style={{ display: 'flex', gap: 8 }}>
              {secondaryMove.map((c) => (
                <SecondaryTile
                  key={c.key}
                  c={c}
                  onPick={() => onPickCategory(c.key)}
                  muted={c.rank === 'muted'}
                />
              ))}
            </div>
          )}
        </div>

        {/* 머무르는 곳 — 강의실 / 카페·음식점 (사무실 제거, custom은 아래 footer row). */}
        <div>
          <SectionLabel>머무르는 곳</SectionLabel>
          <div style={{ display: 'flex', gap: 8 }}>
            {stayCats.map((c) => (
              <SecondaryTile
                key={c.key}
                c={c}
                onPick={() => onPickCategory(c.key)}
              />
            ))}
          </div>
        </div>

        {/* 다른 장소 찾기 — full-width footer row (custom 라우팅).
            사무실·회의실 등 기존 카테고리에 안 맞는 공간은 직접 등록. */}
        {customCat && (
          <FindOtherRow c={customCat} onPick={() => onPickCategory(customCat.key)} />
        )}
      </div>
    </div>
  );
}

// ── FindOtherRow — 머무르는 곳 grid 아래 별도 full-width 검색-style row.
//
// Place Select Redesign v2: stay grid에서 사무실 chip 빼고, 대신 "다른 장소 찾기"
// 한 줄로 통합. 검색 아이콘 + 사무실·회의실 등 안내 + 화살표.
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

function SearchIcon({ size = 18, color = '#6B6B7A' }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle cx="11" cy="11" r="8" stroke={color} strokeWidth="2" />
      <path d="M21 21l-4.35-4.35" stroke={color} strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}
