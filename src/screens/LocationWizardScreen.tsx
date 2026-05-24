import { useMemo, useState, useEffect } from 'react';
import { TramFront, TrainFront, Bus, GraduationCap, Building2, MapPin, LocateFixed, Search } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { TOKEN, FONT } from '../lib/tokens';
import { api } from '../lib/api';
import type { PlaceType } from '../lib/places';
import { ALL_LINES, lineColor, searchStations, STATIONS, type Station } from '../lib/subway';
import { BackIcon } from '../components/Icons';
import { recordLine, getRecentLines } from '../lib/recentPlaces';
import { distanceM, formatDistance, requestCoords, type Coords } from '../lib/geo';

const POPULAR_LINES = ['1호선', '2호선', '3호선', '4호선', '5호선', '7호선', '9호선', '신분당선', '공항철도'];

function priorityLines(): string[] {
  const recent = getRecentLines();
  const seen = new Set<string>();
  const out: string[] = [];
  for (const l of [...recent, ...POPULAR_LINES]) {
    if (ALL_LINES.includes(l) && !seen.has(l)) {
      seen.add(l);
      out.push(l);
    }
    if (out.length >= 10) break;
  }
  return out;
}

interface Props {
  onBack: () => void;
  onPicked: (placeId: string) => void;
  onRegisterFreeform: (initialType: PlaceType) => void;
}

type Category = 'subway' | 'train' | 'bus' | 'classroom' | 'office' | 'other';

const CATEGORIES: { key: Category; Icon: LucideIcon; tint: string; label: string; sub: string }[] = [
  { key: 'subway',    Icon: TramFront,     tint: '#1B53E5', label: '지하철',  sub: '도시철도' },
  { key: 'train',     Icon: TrainFront,    tint: '#DC2626', label: '기차',    sub: 'KTX·SRT·무궁화호 등' },
  { key: 'bus',       Icon: Bus,           tint: '#16A34A', label: '버스',    sub: '시내·시외' },
  { key: 'classroom', Icon: GraduationCap, tint: '#7C3AED', label: '강의실',  sub: '학교' },
  { key: 'office',    Icon: Building2,     tint: '#475569', label: '사무실',  sub: '회사' },
  { key: 'other',     Icon: MapPin,        tint: '#F97316', label: '기타',    sub: '카페·도서관 등' },
];

const CAR_OPTIONS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

const TRAIN_TYPES = ['KTX', 'SRT', 'ITX-새마을', 'ITX-마음', '무궁화호', '누리로'] as const;
type TrainType = (typeof TRAIN_TYPES)[number];
const TRAIN_CAR_OPTIONS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20];

export function LocationWizardScreen({ onBack, onPicked, onRegisterFreeform }: Props) {
  const [category, setCategory] = useState<Category | null>(null);

  // Subway state
  const [subLine, setSubLine] = useState<string | null>(null);
  const [subCar, setSubCar] = useState<number | 'unknown' | null>(null);
  const [subStationQuery, setSubStationQuery] = useState('');
  const [subStation, setSubStation] = useState<Station | null>(null);

  // Bus state
  const [busRoute, setBusRoute] = useState('');
  const [busStop, setBusStop] = useState('');

  // Train state
  const [trainType, setTrainType] = useState<TrainType | null>(null);
  const [trainCar, setTrainCar] = useState<number | 'unknown' | null>(null);
  const [trainDest, setTrainDest] = useState('');

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submitSubway = async () => {
    if (!subLine || !subCar) return;
    setSubmitting(true);
    setError(null);
    try {
      const carLabel = subCar === 'unknown' ? '칸 미정' : `${subCar}번칸`;
      const carIdPart = subCar === 'unknown' ? 'x' : String(subCar);
      const stationPart = subStation ? `:${subStation.name}` : '';
      const id = `subway:${subLine}${stationPart}:${carIdPart}`;
      const name = subStation ? `${subLine} ${subStation.name} ${carLabel}` : `${subLine} ${carLabel}`;
      const district = subStation ? `${subStation.city}${subStation.areas[0] ? ' ' + subStation.areas[0] : ''}` : null;
      await api.upsertPlace({
        id,
        name,
        type: 'subway',
        district: district ?? undefined,
        detail: subStation ? `${subLine} · ${subStation.areas.join(', ')}` : subLine,
      });
      onPicked(id);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSubmitting(false);
    }
  };

  const submitTrain = async () => {
    if (!trainType || !trainCar) return;
    setSubmitting(true);
    setError(null);
    try {
      const carLabel = trainCar === 'unknown' ? '호차 미정' : `${trainCar}호차`;
      const carIdPart = trainCar === 'unknown' ? 'x' : String(trainCar);
      const dest = trainDest.trim();
      const destPart = dest ? `:${dest}` : '';
      const id = `train:${trainType}${destPart}:${carIdPart}`;
      const name = dest ? `${trainType} ${carLabel} (${dest}행)` : `${trainType} ${carLabel}`;
      await api.upsertPlace({
        id,
        name,
        type: 'train',
        district: undefined,
        detail: dest ? `${trainType} · ${dest}행` : trainType,
      });
      onPicked(id);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSubmitting(false);
    }
  };

  const submitBus = async () => {
    const route = busRoute.trim();
    if (!route) return;
    setSubmitting(true);
    setError(null);
    try {
      const stop = busStop.trim();
      const id = stop ? `bus:${route}:${stop}` : `bus:${route}`;
      const name = stop ? `${route}번 버스 (${stop})` : `${route}번 버스`;
      await api.upsertPlace({
        id,
        name,
        type: 'bus',
        district: undefined,
        detail: stop || undefined,
      });
      onPicked(id);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSubmitting(false);
    }
  };

  // Header
  const renderHeader = (title: string, onBackOverride?: () => void) => (
    <div style={{ background: TOKEN.surface, paddingTop: 62, borderBottom: `1px solid ${TOKEN.border}`, flexShrink: 0 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '10px 14px 14px' }}>
        <button
          onClick={onBackOverride ?? onBack}
          style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '4px 6px', display: 'flex', alignItems: 'center' }}
          aria-label="뒤로"
        >
          <BackIcon />
        </button>
        <span style={{ fontSize: 16, fontWeight: 700, color: TOKEN.text1 }}>{title}</span>
      </div>
    </div>
  );

  // ── STEP 1: Search-first landing ─────────────────────────────────
  if (!category) {
    return (
      <WizardLanding
        onPickCategory={(k) => {
          if (k === 'subway' || k === 'bus' || k === 'train') setCategory(k);
          else onRegisterFreeform(k as PlaceType);
        }}
        onPickPlaceId={onPicked}
        renderHeader={renderHeader}
      />
    );
  }

  // ── STEP 2: SUBWAY ────────────────────────────────────────────────
  if (category === 'subway') {
    return <SubwayWizard
      line={subLine} setLine={setSubLine}
      car={subCar} setCar={setSubCar}
      stationQuery={subStationQuery} setStationQuery={setSubStationQuery}
      station={subStation} setStation={setSubStation}
      submitting={submitting}
      error={error}
      onBack={() => { setCategory(null); setSubLine(null); setSubCar(null); setSubStation(null); setSubStationQuery(''); }}
      onSubmit={submitSubway}
      renderHeader={(t) => renderHeader(t, () => { setCategory(null); setSubLine(null); setSubCar(null); setSubStation(null); })}
    />;
  }

  // ── STEP 2: TRAIN ─────────────────────────────────────────────────
  if (category === 'train') {
    const canSubmit = !!trainType && !!trainCar && !submitting;
    return (
      <div style={{ height: '100%', display: 'flex', flexDirection: 'column', background: TOKEN.bg, fontFamily: FONT }}>
        {renderHeader('기차', () => { setCategory(null); setTrainType(null); setTrainCar(null); setTrainDest(''); })}
        <div style={{ flex: 1, overflowY: 'auto', padding: '20px 20px 80px' }}>
          <Label>어떤 열차 타고 계세요? *</Label>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 8, marginBottom: 24 }}>
            {TRAIN_TYPES.map((t) => {
              const active = trainType === t;
              return (
                <button
                  key={t}
                  onClick={() => setTrainType(active ? null : t)}
                  style={{
                    padding: '14px 10px',
                    background: active ? '#DC2626' : TOKEN.surface,
                    color: active ? '#fff' : TOKEN.text1,
                    border: `1.5px solid ${active ? '#DC2626' : TOKEN.border}`,
                    borderRadius: TOKEN.r.md,
                    fontSize: 14,
                    fontWeight: 800,
                    cursor: 'pointer',
                    fontFamily: FONT,
                    letterSpacing: '-0.3px',
                  }}
                >
                  {t}
                </button>
              );
            })}
          </div>

          <Label>몇 호차예요?</Label>
          <button
            onClick={() => setTrainCar(trainCar === 'unknown' ? null : 'unknown')}
            style={{
              width: '100%',
              padding: '14px',
              background: trainCar === 'unknown' ? TOKEN.cold : TOKEN.surface,
              color: trainCar === 'unknown' ? '#fff' : TOKEN.text1,
              border: `1.5px dashed ${trainCar === 'unknown' ? TOKEN.cold : TOKEN.border}`,
              borderRadius: TOKEN.r.md,
              fontSize: 14,
              fontWeight: 700,
              cursor: 'pointer',
              fontFamily: FONT,
              marginBottom: 8,
            }}
          >
            {trainCar === 'unknown' ? '✓ 호차 모름' : '호차 모름 — 그래도 투표할게요'}
          </button>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 6, marginBottom: 24 }}>
            {TRAIN_CAR_OPTIONS.map((n) => {
              const active = trainCar === n;
              return (
                <button
                  key={n}
                  onClick={() => setTrainCar(active ? null : n)}
                  style={{
                    padding: '12px 0',
                    background: active ? TOKEN.cold : TOKEN.surface,
                    color: active ? '#fff' : TOKEN.text1,
                    border: `1.5px solid ${active ? TOKEN.cold : TOKEN.border}`,
                    borderRadius: TOKEN.r.md,
                    fontSize: 14,
                    fontWeight: 800,
                    cursor: 'pointer',
                    fontFamily: FONT,
                    fontVariantNumeric: 'tabular-nums',
                  }}
                >
                  {n}
                </button>
              );
            })}
          </div>

          <Label>어디까지 가세요? <span style={{ fontWeight: 400, color: TOKEN.text3 }}>(선택)</span></Label>
          <input
            value={trainDest}
            onChange={(e) => setTrainDest(e.target.value)}
            placeholder="예: 부산, 광주송정, 서울"
            style={fieldStyle(!!trainDest)}
          />

          {error && (
            <div style={{ marginTop: 14, padding: 10, background: TOKEN.hotBg, color: TOKEN.hot, borderRadius: TOKEN.r.md, fontSize: 12 }}>{error}</div>
          )}

          <div style={{ height: 28 }} />
          <button onClick={submitTrain} disabled={!canSubmit} style={primaryButtonStyle(canSubmit)}>
            {submitting ? '이동 중…' : '투표하러 가기'}
          </button>
        </div>
      </div>
    );
  }

  // ── STEP 2: BUS ───────────────────────────────────────────────────
  if (category === 'bus') {
    return (
      <div style={{ height: '100%', display: 'flex', flexDirection: 'column', background: TOKEN.bg, fontFamily: FONT }}>
        {renderHeader('버스', () => setCategory(null))}
        <div style={{ flex: 1, overflowY: 'auto', padding: '24px 20px 60px' }}>
          <div style={{ fontSize: 20, fontWeight: 900, color: TOKEN.text1, marginBottom: 6, letterSpacing: '-0.4px' }}>
            어떤 버스 타고 계세요?
          </div>
          <div style={{ fontSize: 13, color: TOKEN.text2, marginBottom: 22, lineHeight: 1.6 }}>
            노선 번호를 입력해주세요
          </div>

          <Label>노선 번호 *</Label>
          <input
            value={busRoute}
            onChange={(e) => setBusRoute(e.target.value)}
            placeholder="예: 272, 5511, M7106"
            style={fieldStyle(!!busRoute)}
            inputMode="text"
            autoFocus
          />

          <div style={{ height: 14 }} />

          <Label>정류장 (선택)</Label>
          <input
            value={busStop}
            onChange={(e) => setBusStop(e.target.value)}
            placeholder="예: 신촌오거리, 강남역.강남대로"
            style={fieldStyle(false)}
          />

          {error && (
            <div style={{ marginTop: 14, padding: 10, background: TOKEN.hotBg, color: TOKEN.hot, borderRadius: TOKEN.r.md, fontSize: 12 }}>{error}</div>
          )}

          <div style={{ height: 28 }} />

          <button
            onClick={submitBus}
            disabled={!busRoute.trim() || submitting}
            style={primaryButtonStyle(!!busRoute.trim() && !submitting)}
          >
            {submitting ? '이동 중…' : '투표하러 가기'}
          </button>
        </div>
      </div>
    );
  }

  return null;
}

// ── Subway wizard sub-component ─────────────────────────────────────

interface SubwayWizardProps {
  line: string | null;
  setLine: (v: string | null) => void;
  car: number | 'unknown' | null;
  setCar: (v: number | 'unknown' | null) => void;
  stationQuery: string;
  setStationQuery: (v: string) => void;
  station: Station | null;
  setStation: (v: Station | null) => void;
  submitting: boolean;
  error: string | null;
  onBack: () => void;
  onSubmit: () => void;
  renderHeader: (title: string) => React.ReactNode;
}

function SubwayWizard({
  line, setLine,
  car, setCar,
  stationQuery, setStationQuery,
  station, setStation,
  submitting, error,
  onBack: _onBack,
  onSubmit,
  renderHeader,
}: SubwayWizardProps) {
  const stationResults = useMemo(() => {
    if (!stationQuery.trim()) return [];
    return searchStations({ query: stationQuery, lineFilter: line, limit: 8 });
  }, [stationQuery, line]);

  const canSubmit = !!line && !!car && !submitting;

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', background: TOKEN.bg, fontFamily: FONT }}>
      {renderHeader('지하철')}
      <div style={{ flex: 1, overflowY: 'auto', padding: '20px 20px 80px' }}>
        {/* Line picker — recent + popular first, others behind toggle */}
        <Label>어느 노선 타고 계세요?</Label>
        <LinePicker selected={line} onSelect={(l) => {
          setLine(l);
          if (l) recordLine(l);
          if (line && line !== l) setStation(null);
        }} />
        <div style={{ height: 24 }} />

        {/* Car picker — "모름" FIRST (정상 경로) */}
        <Label>몇 번 칸이에요?</Label>
        <button
          onClick={() => setCar(car === 'unknown' ? null : 'unknown')}
          style={{
            width: '100%',
            padding: '14px',
            background: car === 'unknown' ? TOKEN.cold : TOKEN.surface,
            color: car === 'unknown' ? '#fff' : TOKEN.text1,
            border: `1.5px dashed ${car === 'unknown' ? TOKEN.cold : TOKEN.border}`,
            borderRadius: TOKEN.r.md,
            fontSize: 14,
            fontWeight: 700,
            cursor: 'pointer',
            fontFamily: FONT,
            marginBottom: 8,
          }}
        >
          {car === 'unknown' ? '✓ 칸 모름' : '칸 모름 — 그래도 투표할게요'}
        </button>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 8, marginBottom: 24 }}>
          {CAR_OPTIONS.map((n) => {
            const active = car === n;
            return (
              <button
                key={n}
                onClick={() => setCar(active ? null : n)}
                style={{
                  padding: '14px 0',
                  background: active ? TOKEN.cold : TOKEN.surface,
                  color: active ? '#fff' : TOKEN.text1,
                  border: `1.5px solid ${active ? TOKEN.cold : TOKEN.border}`,
                  borderRadius: TOKEN.r.md,
                  fontSize: 16,
                  fontWeight: 800,
                  cursor: 'pointer',
                  fontFamily: FONT,
                  transition: 'all 0.12s',
                  fontVariantNumeric: 'tabular-nums',
                }}
              >
                {n}
              </button>
            );
          })}
        </div>

        {/* Station (optional) */}
        <Label>지나고 있는 역 <span style={{ fontWeight: 400, color: TOKEN.text3 }}>(선택)</span></Label>
        {station ? (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              padding: '12px 14px',
              background: TOKEN.coldBg,
              border: `2px solid ${TOKEN.cold}`,
              borderRadius: TOKEN.r.lg,
              marginBottom: 24,
            }}
          >
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: TOKEN.text1 }}>{station.name}</div>
              <div style={{ fontSize: 11, color: TOKEN.text3, marginTop: 2 }}>
                {station.lines.join(' · ')} {station.city ? '· ' + station.city : ''}
              </div>
            </div>
            <button
              onClick={() => { setStation(null); setStationQuery(''); }}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: TOKEN.text2, fontSize: 13, fontFamily: FONT }}
            >
              변경
            </button>
          </div>
        ) : (
          <>
            <input
              value={stationQuery}
              onChange={(e) => setStationQuery(e.target.value)}
              placeholder={line ? `${line} 역 검색 (초성도 OK)` : '역 검색 (초성도 OK)'}
              style={fieldStyle(!!stationQuery)}
            />
            {stationResults.length > 0 && (
              <div style={{ marginTop: 6, display: 'flex', flexDirection: 'column', gap: 4, marginBottom: 24 }}>
                {stationResults.map((s) => (
                  <button
                    key={s.id}
                    onClick={() => { setStation(s); setStationQuery(''); }}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 10,
                      padding: '10px 14px',
                      background: TOKEN.surface,
                      border: `1px solid ${TOKEN.border}`,
                      borderRadius: TOKEN.r.md,
                      cursor: 'pointer',
                      fontFamily: FONT,
                      textAlign: 'left',
                    }}
                  >
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 700, color: TOKEN.text1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {s.name}
                      </div>
                      <div style={{ fontSize: 11, color: TOKEN.text3, marginTop: 1 }}>
                        {s.lines.join(' · ')} · {s.city}
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            )}
            {!stationResults.length && <div style={{ height: 24 }} />}
          </>
        )}

        {error && (
          <div style={{ marginBottom: 14, padding: 10, background: TOKEN.hotBg, color: TOKEN.hot, borderRadius: TOKEN.r.md, fontSize: 12 }}>{error}</div>
        )}

        <button
          onClick={onSubmit}
          disabled={!canSubmit}
          style={primaryButtonStyle(canSubmit)}
        >
          {submitting ? '이동 중…' : '투표하러 가기'}
        </button>
      </div>
    </div>
  );
}

// ── Wizard landing (search + nearby + categories) ───────────────────

interface LandingProps {
  onPickCategory: (k: Category) => void;
  onPickPlaceId: (id: string) => void;
  renderHeader: (title: string) => React.ReactNode;
}

interface NearbyHit {
  station: Station;
  dist: number;
}

function WizardLanding({ onPickCategory, onPickPlaceId, renderHeader }: LandingProps) {
  const [query, setQuery] = useState('');
  const [coords, setCoords] = useState<Coords | null>(null);
  const [geoLoading, setGeoLoading] = useState(false);
  const [geoError, setGeoError] = useState<string | null>(null);
  const [showGeoSheet, setShowGeoSheet] = useState(false);
  const [submitting, setSubmitting] = useState<string | null>(null);

  const searchResults = useMemo(() => {
    if (!query.trim()) return [];
    return searchStations({ query, limit: 8 });
  }, [query]);

  const nearby: NearbyHit[] = useMemo(() => {
    if (!coords) return [];
    return STATIONS
      .map((s) => ({ station: s, dist: distanceM(coords, { lat: s.lat, lng: s.lng }) }))
      .filter((x) => x.dist < 1500)
      .sort((a, b) => a.dist - b.dist)
      .slice(0, 6);
  }, [coords]);

  useEffect(() => {
    if (!showGeoSheet) return;
    // close sheet on Escape
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setShowGeoSheet(false); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [showGeoSheet]);

  const runGeo = async () => {
    setShowGeoSheet(false);
    setGeoLoading(true);
    setGeoError(null);
    try {
      const c = await requestCoords();
      setCoords(c);
    } catch (e) {
      const code = (e as Error).message;
      setGeoError(
        code === 'denied' ? '위치 권한이 차단됐어요'
          : code === 'timeout' ? '위치를 못 찾았어요'
          : '위치를 사용할 수 없어요'
      );
    } finally {
      setGeoLoading(false);
    }
  };

  const pickStation = async (s: Station) => {
    if (submitting) return;
    setSubmitting(s.id);
    try {
      // Fast lane: station-level place (no car).  Granular subway:line:station:car
      // is still available via category → subway wizard.
      const id = `subway:${s.name}:${s.lines.join(',')}`;
      await api.upsertPlace({
        id,
        name: s.name,
        type: 'subway',
        district: s.city + (s.areas[0] ? ' ' + s.areas[0] : ''),
        detail: s.lines.join(' · '),
      });
      onPickPlaceId(id);
    } catch {
      setSubmitting(null);
    }
  };

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', background: TOKEN.bg, fontFamily: FONT }}>
      {renderHeader('지금 어디 계세요?')}
      <div style={{ flex: 1, overflowY: 'auto', padding: '20px 20px 60px' }}>
        {/* Search input */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            background: TOKEN.surface,
            border: `1.5px solid ${TOKEN.border}`,
            borderRadius: TOKEN.r.lg,
            padding: '12px 14px',
            marginBottom: 16,
          }}
        >
          <Search size={18} color={TOKEN.text3} />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="역명 검색 (예: 강남, ㄱㄴ)"
            style={{ flex: 1, background: 'none', border: 'none', outline: 'none', fontSize: 14, fontFamily: FONT, color: TOKEN.text1, minWidth: 0 }}
          />
          {query && (
            <button onClick={() => setQuery('')} aria-label="지우기" style={{ background: 'none', border: 'none', cursor: 'pointer', color: TOKEN.text3, fontSize: 18, padding: 0 }}>×</button>
          )}
        </div>

        {/* Search results — replaces other content when active */}
        {query.trim() ? (
          <div>
            {searchResults.length === 0 ? (
              <div style={{ padding: '24px', textAlign: 'center', fontSize: 13, color: TOKEN.text3 }}>
                "{query}" 역을 못 찾았어요
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {searchResults.map((s) => (
                  <StationRow key={s.id} station={s} loading={submitting === `subway:${s.name}:${s.lines.join(',')}`} onTap={() => pickStation(s)} />
                ))}
              </div>
            )}
          </div>
        ) : (
          <>
            {/* Nearby section */}
            {!coords && !geoLoading && !geoError && (
              <button
                onClick={() => setShowGeoSheet(true)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 12,
                  width: '100%', padding: '14px 16px',
                  background: TOKEN.coldBg,
                  border: `1.5px dashed ${TOKEN.cold}55`,
                  borderRadius: TOKEN.r.lg, cursor: 'pointer', fontFamily: FONT,
                  marginBottom: 18, textAlign: 'left',
                }}
              >
                <div style={{ width: 36, height: 36, borderRadius: 10, background: TOKEN.cold, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <LocateFixed size={18} color="#fff" strokeWidth={2.2} />
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 14, fontWeight: 700, color: TOKEN.cold }}>근처 역 찾기</div>
                  <div style={{ fontSize: 11, color: TOKEN.text2, marginTop: 2 }}>위치는 저장하지 않아요</div>
                </div>
              </button>
            )}
            {geoLoading && (
              <div style={{ padding: '14px', textAlign: 'center', fontSize: 12, color: TOKEN.text3, marginBottom: 18 }}>
                위치 찾는 중…
              </div>
            )}
            {geoError && (
              <div style={{ padding: '12px 14px', background: TOKEN.hotBg, color: TOKEN.hot, borderRadius: TOKEN.r.md, fontSize: 12, marginBottom: 18 }}>
                {geoError} — 아래서 직접 선택하세요
              </div>
            )}
            {coords && nearby.length > 0 && (
              <div style={{ marginBottom: 18 }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: TOKEN.text2, marginBottom: 8, letterSpacing: '0.3px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span>📍 가까운 역</span>
                  <button onClick={() => { setCoords(null); setGeoError(null); }} style={{ background: 'none', border: 'none', color: TOKEN.text3, fontSize: 11, cursor: 'pointer', fontFamily: FONT }}>
                    숨기기
                  </button>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {nearby.map((h) => (
                    <StationRow
                      key={h.station.id}
                      station={h.station}
                      distance={h.dist}
                      loading={submitting === `subway:${h.station.name}:${h.station.lines.join(',')}`}
                      onTap={() => pickStation(h.station)}
                    />
                  ))}
                </div>
              </div>
            )}
            {coords && nearby.length === 0 && (
              <div style={{ padding: '12px', fontSize: 12, color: TOKEN.text3, textAlign: 'center', marginBottom: 18 }}>
                1.5km 안에 등록된 역이 없어요
              </div>
            )}

            {/* Category grid */}
            <div style={{ fontSize: 12, fontWeight: 700, color: TOKEN.text2, marginBottom: 10, letterSpacing: '0.3px' }}>
              유형으로 찾기
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              {CATEGORIES.map((c) => {
                const Icon = c.Icon;
                return (
                  <button
                    key={c.key}
                    onClick={() => onPickCategory(c.key)}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 10,
                      padding: '14px 12px',
                      borderRadius: TOKEN.r.lg,
                      border: `1.5px solid ${TOKEN.border}`,
                      background: TOKEN.surface,
                      cursor: 'pointer', fontFamily: FONT, textAlign: 'left',
                    }}
                  >
                    <div style={{ width: 32, height: 32, borderRadius: 9, background: c.tint + '15', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      <Icon size={18} color={c.tint} strokeWidth={2.1} />
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 800, color: TOKEN.text1, letterSpacing: '-0.2px' }}>{c.label}</div>
                      <div style={{ fontSize: 10, color: TOKEN.text3, marginTop: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.sub}</div>
                    </div>
                  </button>
                );
              })}
            </div>
          </>
        )}
      </div>

      {/* Soft ask sheet */}
      {showGeoSheet && (
        <div
          onClick={() => setShowGeoSheet(false)}
          style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 100, display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{ background: TOKEN.surface, borderTopLeftRadius: TOKEN.r.xl, borderTopRightRadius: TOKEN.r.xl, padding: '22px 22px 30px', maxWidth: 420, width: '100%' }}
          >
            <div style={{ fontSize: 17, fontWeight: 900, color: TOKEN.text1, marginBottom: 8, letterSpacing: '-0.3px' }}>
              근처 역 찾기
            </div>
            <div style={{ fontSize: 13, color: TOKEN.text2, lineHeight: 1.6, marginBottom: 22 }}>
              가까운 지하철역을 보여드릴게요.<br />
              <b>위치 정보는 서버에 저장되지 않고</b>, 추천에만 잠깐 사용해요.
            </div>
            <button onClick={runGeo} style={{ width: '100%', padding: '14px', background: TOKEN.cold, color: '#fff', border: 'none', borderRadius: TOKEN.r.lg, fontSize: 15, fontWeight: 700, cursor: 'pointer', fontFamily: FONT, marginBottom: 8 }}>
              위치 허용하기
            </button>
            <button onClick={() => setShowGeoSheet(false)} style={{ width: '100%', padding: '14px', background: 'none', color: TOKEN.text2, border: 'none', fontSize: 14, cursor: 'pointer', fontFamily: FONT }}>
              취소
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function StationRow({ station, distance, loading, onTap }: { station: Station; distance?: number; loading?: boolean; onTap: () => void }) {
  return (
    <button
      onClick={loading ? undefined : onTap}
      disabled={loading}
      style={{
        display: 'flex', alignItems: 'center', gap: 12,
        width: '100%', padding: '12px 14px',
        background: TOKEN.surface, border: `1px solid ${TOKEN.border}`,
        borderRadius: TOKEN.r.md, textAlign: 'left',
        cursor: loading ? 'wait' : 'pointer', fontFamily: FONT,
        opacity: loading ? 0.6 : 1,
      }}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 2, flexShrink: 0, alignItems: 'center', minWidth: 24 }}>
        {station.lines.slice(0, 2).map((l) => (
          <span key={l} style={{ width: 14, height: 14, borderRadius: '50%', background: lineColor(l), color: '#fff', fontSize: 9, fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            {l.match(/^\d+호선$/) ? l.replace('호선', '') : ''}
          </span>
        ))}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: TOKEN.text1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {station.name}
        </div>
        <div style={{ fontSize: 11, color: TOKEN.text3, marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {station.lines.join(' · ')} · {station.city}
        </div>
      </div>
      {distance !== undefined && (
        <span style={{ fontSize: 11, color: TOKEN.text3, flexShrink: 0 }}>{formatDistance(distance)}</span>
      )}
    </button>
  );
}

// ── Line picker ─────────────────────────────────────────────────────

function LinePicker({ selected, onSelect }: { selected: string | null; onSelect: (l: string | null) => void }) {
  const [showAll, setShowAll] = useState(false);
  const top = priorityLines();
  const rest = ALL_LINES.filter((l) => !top.includes(l));
  const list = showAll ? [...top, ...rest] : top;

  return (
    <div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
        {list.map((l) => {
          const active = selected === l;
          return (
            <button
              key={l}
              onClick={() => onSelect(active ? null : l)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                padding: '8px 12px',
                background: active ? lineColor(l) : TOKEN.surface,
                color: active ? '#fff' : TOKEN.text1,
                border: `1.5px solid ${active ? lineColor(l) : TOKEN.border}`,
                borderRadius: 999,
                fontSize: 12,
                fontWeight: 700,
                cursor: 'pointer',
                fontFamily: FONT,
                transition: 'all 0.12s',
              }}
            >
              <span style={{ width: 10, height: 10, borderRadius: '50%', background: active ? '#fff' : lineColor(l), flexShrink: 0 }} />
              {l}
            </button>
          );
        })}
      </div>
      {!showAll && rest.length > 0 && (
        <button
          onClick={() => setShowAll(true)}
          style={{
            marginTop: 10,
            background: 'none',
            border: 'none',
            color: TOKEN.cold,
            fontSize: 12,
            fontWeight: 700,
            cursor: 'pointer',
            fontFamily: FONT,
            padding: 0,
          }}
        >
          + 전체 노선 보기 ({rest.length})
        </button>
      )}
    </div>
  );
}

// ── Style helpers ───────────────────────────────────────────────────

function Label({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ fontSize: 12, fontWeight: 700, color: TOKEN.text2, marginBottom: 10, letterSpacing: '0.3px' }}>
      {children}
    </div>
  );
}

function fieldStyle(active: boolean): React.CSSProperties {
  return {
    width: '100%',
    padding: '13px 14px',
    border: `2px solid ${active ? TOKEN.cold : TOKEN.border}`,
    borderRadius: TOKEN.r.md,
    fontSize: 14,
    fontFamily: FONT,
    color: TOKEN.text1,
    background: TOKEN.bg,
    outline: 'none',
    transition: 'border-color 0.18s',
    boxSizing: 'border-box',
  };
}

function primaryButtonStyle(enabled: boolean): React.CSSProperties {
  return {
    width: '100%',
    padding: '16px',
    background: enabled ? TOKEN.cold : TOKEN.border,
    color: '#fff',
    border: 'none',
    borderRadius: TOKEN.r.lg,
    fontSize: 15,
    fontWeight: 700,
    cursor: enabled ? 'pointer' : 'default',
    fontFamily: FONT,
    boxShadow: enabled ? `0 6px 20px ${TOKEN.cold}35` : 'none',
    transition: 'all 0.15s',
  };
}
