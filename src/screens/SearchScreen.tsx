import { useEffect, useMemo, useState } from 'react';
import { TOKEN, FONT } from '../lib/tokens';
import { api, type PlaceWithCounts } from '../lib/api';
import { ALL_LINES, lineColor, searchStations, type Station, STATIONS } from '../lib/subway';
import { PlaceCard } from '../components/PlaceCard';
import { BackIcon } from '../components/Icons';

interface Props {
  onBack: () => void;
  onSelectPlace: (id: string) => void;
  onRegister: () => void;
}

const RECENT_KEY = 'aircon:recent_station_ids';
const RECENT_MAX = 8;

function readRecent(): string[] {
  try {
    const raw = localStorage.getItem(RECENT_KEY);
    return raw ? (JSON.parse(raw) as string[]).slice(0, RECENT_MAX) : [];
  } catch {
    return [];
  }
}

function pushRecent(id: string) {
  try {
    const cur = readRecent().filter((x) => x !== id);
    cur.unshift(id);
    localStorage.setItem(RECENT_KEY, JSON.stringify(cur.slice(0, RECENT_MAX)));
  } catch {
    /* ignore */
  }
}

function LineBadge({ line, size = 'sm' }: { line: string; size?: 'sm' | 'xs' }) {
  const dim = size === 'xs' ? 14 : 18;
  const fs = size === 'xs' ? 9 : 10;
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 4,
        flexShrink: 0,
      }}
    >
      <span
        style={{
          width: dim,
          height: dim,
          borderRadius: '50%',
          background: lineColor(line),
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: '#fff',
          fontSize: fs,
          fontWeight: 800,
          letterSpacing: '-0.3px',
          flexShrink: 0,
        }}
      >
        {/* show line number if simple line, else first char */}
        {line.match(/^\d+호선$/) ? line.replace('호선', '') : ''}
      </span>
      {!line.match(/^\d+호선$/) && (
        <span style={{ fontSize: 10, color: TOKEN.text2, fontWeight: 600 }}>{line}</span>
      )}
    </span>
  );
}

function StationRow({ station, onTap, loading }: { station: Station; onTap: () => void; loading: boolean }) {
  const [hover, setHover] = useState(false);
  return (
    <button
      onClick={loading ? undefined : onTap}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      disabled={loading}
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
        cursor: loading ? 'wait' : 'pointer',
        boxShadow: '0 1px 5px rgba(0,0,0,0.06)',
        transition: 'all 0.15s',
        fontFamily: FONT,
        opacity: loading ? 0.6 : 1,
      }}
    >
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 3,
          flexShrink: 0,
          minWidth: 36,
        }}
      >
        {station.lines.slice(0, 3).map((l) => (
          <LineBadge key={l} line={l} size={station.lines.length > 2 ? 'xs' : 'sm'} />
        ))}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            fontSize: 15,
            fontWeight: 700,
            color: TOKEN.text1,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {station.name}
        </div>
        <div style={{ fontSize: 11, color: TOKEN.text3, marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {station.city}
          {station.areas.length > 0 ? ' · ' + station.areas.join(' · ') : ''}
        </div>
      </div>
      {loading && <span style={{ fontSize: 11, color: TOKEN.text3 }}>이동중…</span>}
    </button>
  );
}

export function SearchScreen({ onBack, onSelectPlace, onRegister }: Props) {
  const [query, setQuery] = useState('');
  const [lineFilter, setLineFilter] = useState<string | null>(null);
  const [focused, setFocused] = useState(true);
  const [places, setPlaces] = useState<PlaceWithCounts[] | null>(null);
  const [pickingStationId, setPickingStationId] = useState<string | null>(null);
  const [recentIds] = useState<string[]>(readRecent());

  useEffect(() => {
    api.listPlaces().then((r) => setPlaces(r.places)).catch(() => setPlaces([]));
  }, []);

  const stationResults = useMemo(() => searchStations({ query, lineFilter }), [query, lineFilter]);

  const userPlaceResults = useMemo(() => {
    if (!places) return [];
    const trimmed = query.trim();
    if (!trimmed) return places.filter((p) => p.type !== 'subway');
    return places.filter(
      (p) =>
        p.type !== 'subway' &&
        (p.name.includes(trimmed) || (p.district ?? '').includes(trimmed))
    );
  }, [places, query]);

  const recentStations = useMemo(() => {
    if (recentIds.length === 0 || query || lineFilter) return [];
    const byId = new Map(STATIONS.map((s) => [s.id, s]));
    return recentIds.map((id) => byId.get(id)).filter((s): s is Station => Boolean(s));
  }, [recentIds, query, lineFilter]);

  const handleStationPick = async (s: Station) => {
    setPickingStationId(s.id);
    try {
      await api.upsertPlace({
        id: s.id,
        name: s.name,
        type: 'subway',
        district: s.city + (s.areas[0] ? ' ' + s.areas[0] : ''),
        detail: s.lines.join(', '),
      });
      pushRecent(s.id);
      onSelectPlace(s.id);
    } catch (e) {
      setPickingStationId(null);
      console.error('upsert station failed', e);
    }
  };

  const showInitial = !query.trim() && !lineFilter;

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', background: TOKEN.bg, fontFamily: FONT }}>
      {/* Header */}
      <div style={{ background: TOKEN.surface, paddingTop: 62, borderBottom: `1px solid ${TOKEN.border}`, flexShrink: 0 }}>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', padding: '10px 16px 12px' }}>
          <button
            onClick={onBack}
            style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '4px 6px', display: 'flex', alignItems: 'center' }}
            aria-label="뒤로"
          >
            <BackIcon />
          </button>
          <div
            style={{
              flex: 1,
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              background: TOKEN.bg,
              borderRadius: TOKEN.r.lg,
              padding: '10px 14px',
              border: `2px solid ${focused ? TOKEN.cold : 'transparent'}`,
              transition: 'border-color 0.18s',
            }}
          >
            <svg width={15} height={15} viewBox="0 0 24 24" fill="none">
              <circle cx="11" cy="11" r="8" stroke={TOKEN.text3} strokeWidth="2" />
              <path d="M21 21l-4.35-4.35" stroke={TOKEN.text3} strokeWidth="2" strokeLinecap="round" />
            </svg>
            <input
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onFocus={() => setFocused(true)}
              onBlur={() => setFocused(false)}
              placeholder="역 이름 또는 초성 (예: ㄱㄴ → 강남)"
              style={{
                flex: 1,
                background: 'none',
                border: 'none',
                outline: 'none',
                fontSize: 14,
                color: TOKEN.text1,
                fontFamily: FONT,
                minWidth: 0,
              }}
            />
            {query && (
              <button
                onClick={() => setQuery('')}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: TOKEN.text3, fontSize: 18, lineHeight: 1, padding: 0 }}
                aria-label="검색어 지우기"
              >
                ×
              </button>
            )}
          </div>
        </div>

        {/* Line filter chips */}
        <div
          style={{
            display: 'flex',
            gap: 6,
            padding: '0 16px 12px',
            overflowX: 'auto',
            WebkitOverflowScrolling: 'touch',
            scrollbarWidth: 'none',
          }}
        >
          <button
            onClick={() => setLineFilter(null)}
            style={{
              padding: '6px 12px',
              background: lineFilter === null ? TOKEN.text1 : TOKEN.bg,
              color: lineFilter === null ? '#fff' : TOKEN.text2,
              border: 'none',
              borderRadius: 999,
              fontSize: 12,
              fontWeight: 700,
              cursor: 'pointer',
              fontFamily: FONT,
              flexShrink: 0,
            }}
          >
            전체
          </button>
          {ALL_LINES.map((line) => {
            const active = lineFilter === line;
            return (
              <button
                key={line}
                onClick={() => setLineFilter(active ? null : line)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  padding: '6px 12px',
                  background: active ? lineColor(line) : TOKEN.bg,
                  color: active ? '#fff' : TOKEN.text2,
                  border: 'none',
                  borderRadius: 999,
                  fontSize: 12,
                  fontWeight: 700,
                  cursor: 'pointer',
                  fontFamily: FONT,
                  flexShrink: 0,
                }}
              >
                <span
                  style={{
                    width: 10,
                    height: 10,
                    borderRadius: '50%',
                    background: active ? '#fff' : lineColor(line),
                    flexShrink: 0,
                  }}
                />
                {line}
              </button>
            );
          })}
        </div>
      </div>

      {/* Body */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '16px 16px 80px' }}>
        {showInitial && recentStations.length > 0 && (
          <>
            <SectionLabel>최근 찾은 역</SectionLabel>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 22 }}>
              {recentStations.map((s) => (
                <StationRow
                  key={s.id}
                  station={s}
                  loading={pickingStationId === s.id}
                  onTap={() => handleStationPick(s)}
                />
              ))}
            </div>
          </>
        )}

        {showInitial && (
          <div
            style={{
              padding: '24px 18px',
              background: TOKEN.surface,
              borderRadius: TOKEN.r.lg,
              marginBottom: 18,
              boxShadow: '0 1px 5px rgba(0,0,0,0.05)',
              fontSize: 13,
              color: TOKEN.text2,
              lineHeight: 1.6,
            }}
          >
            <div style={{ fontWeight: 700, color: TOKEN.text1, marginBottom: 6 }}>전국 지하철 {STATIONS.length}개 역 검색</div>
            역명, 지역, 또는 한글 초성으로 검색하세요. 예: <b>ㄱㄴ</b>, <b>홍대</b>, <b>강남</b>, <b>관악구</b>
          </div>
        )}

        {/* Subway results — always primary */}
        {(query.trim() || lineFilter) && (
          <>
            <SectionLabel>
              지하철 {stationResults.length}개
              {lineFilter && (
                <span style={{ marginLeft: 6, fontSize: 11, color: TOKEN.text3, fontWeight: 400 }}>· {lineFilter}</span>
              )}
            </SectionLabel>
            {stationResults.length === 0 ? (
              <div style={{ padding: '20px 14px', background: TOKEN.surface, borderRadius: TOKEN.r.lg, fontSize: 13, color: TOKEN.text3, textAlign: 'center', marginBottom: 22 }}>
                해당하는 역이 없어요
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 22 }}>
                {stationResults.map((s) => (
                  <StationRow
                    key={s.id}
                    station={s}
                    loading={pickingStationId === s.id}
                    onTap={() => handleStationPick(s)}
                  />
                ))}
              </div>
            )}
          </>
        )}

        {/* Other places (only when not line-filtering) */}
        {!lineFilter && userPlaceResults.length > 0 && (
          <>
            <SectionLabel>장소 {userPlaceResults.length}개</SectionLabel>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 22 }}>
              {userPlaceResults.map((p) => (
                <PlaceCard key={p.id} place={p} onTap={() => onSelectPlace(p.id)} />
              ))}
            </div>
          </>
        )}

        {/* Register CTA when totally empty */}
        {query.trim() && stationResults.length === 0 && (!lineFilter ? userPlaceResults.length === 0 : true) && (
          <div style={{ textAlign: 'center', padding: '20px 20px 0' }}>
            <button
              onClick={onRegister}
              style={{
                padding: '12px 24px',
                background: TOKEN.cold,
                color: '#fff',
                border: 'none',
                borderRadius: TOKEN.r.lg,
                fontSize: 13,
                fontWeight: 700,
                cursor: 'pointer',
                fontFamily: FONT,
              }}
            >
              + 새 장소 등록하기
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        fontSize: 12,
        fontWeight: 700,
        color: TOKEN.text2,
        marginBottom: 10,
        letterSpacing: '0.3px',
      }}
    >
      {children}
    </div>
  );
}
