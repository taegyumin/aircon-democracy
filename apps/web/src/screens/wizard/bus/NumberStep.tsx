'use client';

// STEP 1: 번호 입력 + autocomplete + 결과 list.
// BusWizard.tsx에서 추출 (V4 (C) #1). NumberStep + BusNumberInput + TipsCard + SectionLabel + BusBadge + BusResultRow.

import { useState } from 'react';
import { TOKEN, FONT } from '@aircon/core';
import type { BusRouteCandidate } from '@aircon/core';
import { ArrowRight, SearchIcon } from './icons';

// 서울 시내버스 type 색. NumberStep 내부에서만 사용 — 다른 곳에 영향 없게 자체 보유.
const BUS_TYPE_COLOR: Record<string, string> = {
  '간선': '#0052A4', '지선': '#4E9C3F', '광역': '#C00010',
  '순환': '#E8A000', '마을': '#4E9C3F', '공항': '#0090D2',
  '인천': '#0052A4', '경기': '#4E9C3F',
};
function busColor(typeLabel: string): string {
  return BUS_TYPE_COLOR[typeLabel] ?? '#0052A4';
}

export function NumberStep({
  query, setQuery, candidates, loading, onPick,
}: {
  query: string;
  setQuery: (v: string) => void;
  candidates: BusRouteCandidate[];
  loading: boolean;
  onPick: (r: BusRouteCandidate) => void;
}) {
  const trimmed = query.trim();
  const exact = candidates.filter((r) => r.name === trimmed);
  const similar = candidates.filter((r) => r.name !== trimmed);

  return (
    <div style={{ padding: '0 16px', display: 'flex', flexDirection: 'column', gap: 18 }}>
      <div>
        <div style={{ fontSize: 24, fontWeight: 900, color: TOKEN.text1, letterSpacing: '-0.6px', lineHeight: 1.3, marginBottom: 8 }}>
          몇 번 버스<br />타고 계세요?
        </div>
        <div style={{ fontSize: 13, color: TOKEN.text2, lineHeight: 1.6 }}>
          번호를 입력하면 노선과 방향을 자동으로 찾아드려요
        </div>
      </div>

      <BusNumberInput value={query} setValue={setQuery} />

      {trimmed === '' && <TipsCard />}

      {trimmed !== '' && (
        <div style={{ background: TOKEN.surface, borderRadius: 16, overflow: 'hidden', boxShadow: '0 2px 12px rgba(0,0,0,0.07)' }}>
          {loading && candidates.length === 0 && (
            <div style={{ padding: '20px 16px', fontSize: 13, color: TOKEN.text3, textAlign: 'center' }}>
              버스 노선 찾는 중…
            </div>
          )}

          {!loading && candidates.length === 0 && (
            <div style={{ padding: '20px 16px', fontSize: 13, color: TOKEN.text3, textAlign: 'center', lineHeight: 1.6 }}>
              "{trimmed}"로 시작하는 노선을 못 찾았어요.<br />
              번호를 다시 확인해주세요.
            </div>
          )}

          {exact.length > 0 && (
            <>
              <SectionLabel left={`${trimmed}번 — 방향 선택`} right={exact[0].typeLabel === '간선' ? '서울 간선버스' : `서울 ${exact[0].typeLabel}버스`} />
              {exact.map((r, i) => (
                <BusResultRow key={`e-${r.id}-${i}`} route={r} onClick={() => onPick(r)} isFirst={i === 0} />
              ))}
            </>
          )}

          {similar.length > 0 && (
            <>
              {exact.length > 0 && <div style={{ height: 1, background: TOKEN.border, margin: '6px 0' }} />}
              <SectionLabel left="비슷한 번호" />
              {similar.map((r, i) => (
                <BusResultRow key={`s-${r.id}-${i}`} route={r} onClick={() => onPick(r)} isFirst={i === 0} />
              ))}
            </>
          )}
        </div>
      )}

      {trimmed !== '' && candidates.length > 0 && (
        <div style={{ fontSize: 12, color: TOKEN.text3, paddingLeft: 2 }}>
          방향을 포함해 탭하면 바로 선택돼요
        </div>
      )}
    </div>
  );
}

function BusNumberInput({ value, setValue }: { value: string; setValue: (v: string) => void }) {
  const [focused, setFocused] = useState(false);
  const empty = value === '';
  return (
    <div
      style={{
        background: TOKEN.surface, borderRadius: 14, padding: '15px 16px',
        display: 'flex', alignItems: 'center', gap: 10,
        border: `2px solid ${focused ? TOKEN.cold : TOKEN.border}`,
        boxShadow: focused ? `0 0 0 5px ${TOKEN.cold}0D` : 'none',
        transition: 'all 0.18s',
      }}
    >
      <SearchIcon size={17} color={focused ? TOKEN.cold : TOKEN.text3} />
      <input
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        autoFocus
        inputMode="text"
        placeholder="버스 번호 입력 (예: 271)"
        style={{
          flex: 1, border: 'none', outline: 'none', background: 'transparent',
          fontSize: empty ? 16 : 17, fontWeight: empty ? 400 : 700,
          color: empty ? TOKEN.text3 : TOKEN.text1,
          letterSpacing: '-0.3px', fontFamily: FONT,
          padding: 0,
        }}
      />
    </div>
  );
}

function TipsCard() {
  const tips = ['버스 앞 유리 또는 측면의 큰 번호', '숫자·알파벳 조합도 됩니다 (예: 9401A)'];
  return (
    <div style={{ background: TOKEN.surface, borderRadius: 16, padding: '16px 18px', boxShadow: '0 1px 5px rgba(0,0,0,0.05)' }}>
      <div style={{ fontSize: 11, fontWeight: 700, color: TOKEN.text3, letterSpacing: '1px', textTransform: 'uppercase', marginBottom: 12 }}>
        어디서 확인하나요?
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {tips.map((tip, i) => (
          <div key={i} style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
            <div style={{ width: 18, height: 18, borderRadius: '50%', background: TOKEN.coldBg, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <span style={{ fontSize: 11, fontWeight: 700, color: TOKEN.cold }}>{i + 1}</span>
            </div>
            <span style={{ fontSize: 13, color: TOKEN.text2, lineHeight: 1.5 }}>{tip}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function SectionLabel({ left, right }: { left: string; right?: string }) {
  return (
    <div style={{ padding: '10px 16px 2px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
      <span style={{ fontSize: 11, fontWeight: 700, color: TOKEN.text3, letterSpacing: '0.4px' }}>{left}</span>
      {right && <span style={{ fontSize: 11, color: TOKEN.text3 }}>{right}</span>}
    </div>
  );
}

function BusBadge({ label, color, size = 'normal' }: { label: string; color: string; size?: 'normal' | 'sm' }) {
  return (
    <span
      style={{
        fontSize: size === 'sm' ? 10 : 11, fontWeight: 700, color: '#fff',
        background: color, padding: size === 'sm' ? '2px 6px' : '3px 8px',
        borderRadius: 5, flexShrink: 0,
        boxShadow: `0 2px 6px ${color}30`,
      }}
    >
      {label}
    </span>
  );
}

function BusResultRow({
  route, onClick, isFirst,
}: {
  route: BusRouteCandidate;
  onClick: () => void;
  isFirst: boolean;
}) {
  const color = busColor(route.typeLabel);
  return (
    <button
      onClick={onClick}
      style={{
        width: '100%', display: 'flex', alignItems: 'center', gap: 13,
        padding: '13px 16px',
        borderTop: isFirst ? 'none' : `1px solid ${TOKEN.border}`,
        background: 'transparent', border: 'none', cursor: 'pointer', textAlign: 'left',
        fontFamily: FONT,
      }}
    >
      <BusBadge label={route.typeLabel} color={color} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 2, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 17, fontWeight: 900, color: TOKEN.text1, letterSpacing: '-0.4px' }}>
            {route.name}번
          </span>
          {(route.startStop || route.endStop) && (
            <span style={{ fontSize: 12, color: TOKEN.text2 }}>
              {route.startStop} → {route.endStop}
            </span>
          )}
        </div>
      </div>
      <ArrowRight color={TOKEN.text3} size={15} />
    </button>
  );
}
