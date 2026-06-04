'use client';

// Bus 지역 picker — 광역시(서울 + TAGO 8개) + 시·군 130개를 native <select>로.
// 138개 정도라 native가 가장 가벼움. group으로 보기 좋게.
// BusWizard.tsx에서 추출 (V4 (C) #1).

import { TOKEN, FONT, CITY_CODES } from '@aircon/core';

type Region = string; // 'seoul' | '21' | '31010' ...

export function RegionPicker({
  region, detecting, onChange, onUseGps,
}: {
  region: Region;
  detecting: boolean;
  onChange: (next: Region) => void;
  onUseGps: () => void;
}) {
  // 시·군 그룹 라벨은 cityCode 첫 2자리로 추론 (31=경기, 32=강원, 33=충북, ...).
  const SIDO_PREFIX_LABEL: Record<string, string> = {
    '31': '경기도', '32': '강원도', '33': '충청북도', '34': '충청남도',
    '35': '전라북도', '36': '전라남도', '37': '경상북도', '38': '경상남도',
  };
  const metropolitan = CITY_CODES.filter((c) => c.code < 100);
  const sidoGroups = new Map<string, typeof CITY_CODES>();
  for (const c of CITY_CODES.filter((c) => c.code >= 1000)) {
    const prefix = String(c.code).slice(0, 2);
    const label = SIDO_PREFIX_LABEL[prefix] ?? prefix;
    const arr = sidoGroups.get(label) ?? [];
    arr.push(c);
    sidoGroups.set(label, arr);
  }

  return (
    <div
      style={{
        background: TOKEN.surface, borderBottom: `1px solid ${TOKEN.border}`,
        padding: '10px 16px', display: 'flex', alignItems: 'center', gap: 8,
      }}
    >
      <span style={{ fontSize: 12, color: TOKEN.text3, fontWeight: 500 }}>지역</span>
      <div style={{ position: 'relative', flex: 1 }}>
        <select
          value={region}
          onChange={(e) => onChange(e.target.value)}
          style={{
            width: '100%', padding: '8px 28px 8px 10px',
            background: TOKEN.bg, border: `1px solid ${TOKEN.border}`,
            borderRadius: 8, fontSize: 13, fontWeight: 700, color: TOKEN.text1,
            fontFamily: FONT, appearance: 'none', WebkitAppearance: 'none',
            cursor: 'pointer',
          }}
          aria-label="지역 선택"
        >
          <option value="seoul">서울특별시</option>
          <optgroup label="광역시·도">
            {metropolitan.map((c) => (
              <option key={c.code} value={String(c.code)}>{c.name}</option>
            ))}
          </optgroup>
          {Array.from(sidoGroups.entries()).map(([sido, list]) => (
            <optgroup key={sido} label={sido}>
              {list.map((c) => (
                <option key={c.code} value={String(c.code)}>{c.name}</option>
              ))}
            </optgroup>
          ))}
        </select>
        <span
          style={{
            position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)',
            fontSize: 9, color: TOKEN.text3, pointerEvents: 'none',
          }}
          aria-hidden
        >▼</span>
      </div>
      <button
        onClick={onUseGps}
        disabled={detecting}
        title="현재 위치로 지역 자동 선택 — 명시적으로 누를 때만 좌표 사용"
        style={{
          padding: '7px 10px', fontSize: 11, fontWeight: 700,
          background: detecting ? TOKEN.bg : TOKEN.coldBg,
          color: TOKEN.cold,
          border: `1px solid ${TOKEN.cold}30`,
          borderRadius: 8, cursor: detecting ? 'default' : 'pointer',
          fontFamily: FONT, flexShrink: 0,
        }}
        aria-label="현재 위치로 지역 찾기"
      >
        {detecting ? '확인 중…' : '📍 GPS'}
      </button>
    </div>
  );
}
