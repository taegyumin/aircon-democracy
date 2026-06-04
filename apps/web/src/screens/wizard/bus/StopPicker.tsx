'use client';

// 정류장 picker — GPS 허용 시 근처 3개 + 이름 검색 list. BusWizard.tsx에서 추출 (162줄).
// StopSel union (BusRouteStation | { unknown: true } | null)을 그대로 사용 — BusWizard에서 정의.

import { TOKEN, FONT, distanceM, formatDistance } from '@aircon/core';
import type { BusRouteStation, Coords } from '@aircon/core';
import { ArrowRight, CheckIcon, SearchIcon, MapPinIcon } from './icons';

type GpsState = 'idle' | 'pending' | 'granted' | 'denied' | 'unsupported';
type StopSel = BusRouteStation | { unknown: true } | null;

export function StopPicker({
  stations, loading, err, gps, coords, typeColor, search, setSearch, selectedStop, onPick,
}: {
  stations: BusRouteStation[];
  loading: boolean;
  err: string | null;
  gps: GpsState;
  coords: Coords | null;
  typeColor: string;
  search: string;
  setSearch: (v: string) => void;
  selectedStop: StopSel;
  onPick: (s: StopSel) => void;
}) {
  const stopsWithCoords = stations.filter((s) => s.x !== null && s.y !== null);

  // GPS 허용 + coords 있고 정류장 좌표 있으면 가까운 3개 추천.
  const nearby = (gps === 'granted' && coords && stopsWithCoords.length > 0)
    ? stopsWithCoords
        .map((s) => ({ s, d: distanceM(coords, { lat: s.y as number, lng: s.x as number }) }))
        .sort((a, b) => a.d - b.d)
        .slice(0, 3)
    : [];

  const q = search.trim();
  const filtered = q
    ? stations.filter((s) => s.name.includes(q))
    : stations;

  return (
    <div style={{ padding: '0 16px' }}>
      {loading && (
        <div style={{ padding: '20px 0', fontSize: 13, color: TOKEN.text3, textAlign: 'center' }}>
          정류장 list 불러오는 중…
        </div>
      )}

      {!loading && err && (
        <div style={{ padding: 10, background: TOKEN.hotBg, color: TOKEN.hot, borderRadius: TOKEN.r.md, fontSize: 12, marginBottom: 14 }}>
          정류장 정보를 못 받았어요 ({err}). 검색으로 직접 입력해보세요.
        </div>
      )}

      {!loading && stations.length > 0 && gps === 'granted' && nearby.length > 0 && (
        <>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
            <div style={{ width: 6, height: 6, borderRadius: '50%', background: TOKEN.cold }} />
            <span style={{ fontSize: 11, fontWeight: 700, color: TOKEN.cold, letterSpacing: '0.3px' }}>
              GPS로 근처 정류장 {nearby.length}개를 찾았어요
            </span>
          </div>
          <div style={{ background: TOKEN.surface, borderRadius: 16, overflow: 'hidden', border: `1px solid ${TOKEN.border}`, marginBottom: 14 }}>
            {nearby.map(({ s, d }) => (
              <NearbyStopRow
                key={`n-${s.seq}-${s.name}`}
                name={s.name}
                dist={formatDistance(d)}
                selected={!!selectedStop && 'name' in selectedStop && selectedStop.name === s.name}
                typeColor={typeColor}
                onPick={() => onPick(s)}
              />
            ))}
            <UnknownStopRow
              selected={!!selectedStop && 'unknown' in selectedStop}
              onPick={() => onPick({ unknown: true })}
            />
          </div>
        </>
      )}

      {!loading && stations.length > 0 && (
        <>
          <div style={{ fontSize: 15, fontWeight: 700, color: TOKEN.text1, marginBottom: 12, letterSpacing: '-0.3px' }}>
            {gps === 'granted' ? '또는 직접 정류장 선택' : '지나는 정류장을 골라주세요'}
          </div>
          <div
            style={{
              background: TOKEN.surface, borderRadius: 12, padding: '11px 14px',
              display: 'flex', alignItems: 'center', gap: 9,
              border: `1.5px solid ${TOKEN.border}`, marginBottom: 10,
            }}
          >
            <SearchIcon size={15} />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="정류장 이름 검색"
              style={{
                flex: 1, border: 'none', outline: 'none', background: 'transparent',
                fontSize: 14, color: TOKEN.text1, fontFamily: FONT, padding: 0,
              }}
            />
          </div>
          <div style={{ background: TOKEN.surface, borderRadius: 16, overflow: 'hidden', border: `1px solid ${TOKEN.border}`, marginBottom: 14 }}>
            {filtered.slice(0, 60).map((s, i) => (
              <StopRow
                key={`s-${s.seq}-${s.name}-${i}`}
                name={s.name}
                selected={!!selectedStop && 'name' in selectedStop && selectedStop.name === s.name}
                typeColor={typeColor}
                onPick={() => onPick(s)}
              />
            ))}
            {filtered.length === 0 && (
              <div style={{ padding: '14px 16px', fontSize: 13, color: TOKEN.text3, textAlign: 'center' }}>
                "{q}"와 일치하는 정류장이 없어요
              </div>
            )}
            <UnknownStopRow
              selected={!!selectedStop && 'unknown' in selectedStop}
              onPick={() => onPick({ unknown: true })}
            />
          </div>
        </>
      )}
    </div>
  );
}

function NearbyStopRow({
  name, dist, selected, typeColor, onPick,
}: {
  name: string;
  dist: string;
  selected: boolean;
  typeColor: string;
  onPick: () => void;
}) {
  return (
    <button
      onClick={onPick}
      style={{
        width: '100%', display: 'flex', alignItems: 'center', gap: 13, padding: '13px 16px',
        background: selected ? typeColor + '0A' : 'transparent',
        borderTop: `1px solid ${TOKEN.border}`, cursor: 'pointer',
        border: 'none', textAlign: 'left', fontFamily: FONT,
      }}
    >
      <div
        style={{
          width: 38, height: 38, borderRadius: 10, flexShrink: 0,
          background: selected ? typeColor : TOKEN.bg,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          border: selected ? 'none' : `1px solid ${TOKEN.border}`,
        }}
      >
        {selected ? <CheckIcon color="#fff" size={16} /> : <MapPinIcon size={14} color={TOKEN.text3} />}
      </div>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 15, fontWeight: selected ? 700 : 600, color: TOKEN.text1, letterSpacing: '-0.2px' }}>
          {name}
        </div>
        <div style={{ fontSize: 11, color: TOKEN.cold, fontWeight: 600, marginTop: 2 }}>GPS {dist} 거리</div>
      </div>
      {selected
        ? <span style={{ fontSize: 11, fontWeight: 700, color: typeColor, background: typeColor + '14', padding: '3px 9px', borderRadius: 999 }}>선택됨</span>
        : <ArrowRight color={TOKEN.text3} size={15} />}
    </button>
  );
}

function StopRow({
  name, selected, typeColor, onPick,
}: {
  name: string;
  selected: boolean;
  typeColor: string;
  onPick: () => void;
}) {
  return (
    <button
      onClick={onPick}
      style={{
        width: '100%', display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px',
        background: selected ? typeColor + '12' : 'transparent',
        borderTop: `1px solid ${TOKEN.border}`, cursor: 'pointer',
        border: 'none', textAlign: 'left', fontFamily: FONT,
      }}
    >
      <div
        style={{
          width: 8, height: 8, borderRadius: '50%', flexShrink: 0,
          background: selected ? typeColor : TOKEN.border,
          boxShadow: selected ? `0 2px 6px ${typeColor}40` : 'none',
        }}
        aria-hidden
      />
      <span style={{ flex: 1, fontSize: 15, fontWeight: selected ? 700 : 400, color: selected ? TOKEN.text1 : TOKEN.text2, letterSpacing: '-0.2px' }}>
        {name}
      </span>
      {selected ? <CheckIcon color={typeColor} size={15} /> : <ArrowRight color={TOKEN.text3} size={14} />}
    </button>
  );
}

function UnknownStopRow({ selected, onPick }: { selected: boolean; onPick: () => void }) {
  return (
    <button
      onClick={onPick}
      style={{
        width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: '13px 16px', borderTop: `1px solid ${TOKEN.border}`,
        cursor: 'pointer', background: selected ? TOKEN.coldBg : 'transparent',
        border: 'none', fontFamily: FONT,
      }}
    >
      <span style={{ fontSize: 13, color: selected ? TOKEN.cold : TOKEN.text3, fontWeight: selected ? 700 : 400 }}>
        정류장 모름 — 그래도 투표할게요
      </span>
    </button>
  );
}
