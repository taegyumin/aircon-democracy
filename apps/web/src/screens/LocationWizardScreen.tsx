'use client';

import { useMemo, useState, useEffect } from 'react';
import { TramFront, TrainFront, Bus, GraduationCap, Building2, MapPin, LocateFixed, Search, Hourglass } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { TOKEN, FONT } from '@aircon/core';
import { api } from '../lib/apiClient';
import type { PlaceType } from '@aircon/core';
import { lineColor, searchStations, STATIONS, type Station } from '@aircon/core';
import { BackIcon } from '../components/Icons';
import { recordLine } from '../lib/recentPlaces';
import { distanceM, formatDistance, type Coords } from '@aircon/core';
import { requestCoords } from '../lib/geoClient';
import { findSegments, findTrainSegments, segmentPlaceId, platformPlaceId, neighborNames } from '@aircon/core';
import type { SubwayMatchResult, BusMatchResult } from '../lib/apiClient';
import { NaverMapPicker } from '../components/NaverMapPicker';
import { searchTrainStations } from '@aircon/core';
import { SNUClassroomWizard } from './SNUClassroomWizard';

interface Props {
  onBack: () => void;
  onPicked: (placeId: string) => void;
  onRegisterFreeform: (initialType: PlaceType) => void;
}

type Category = 'subway' | 'train' | 'bus' | 'classroom' | 'office' | 'other';

const CATEGORIES: { key: Category; Icon: LucideIcon; tint: string; label: string; sub: string }[] = [
  { key: 'subway',    Icon: TramFront,     tint: '#1B53E5', label: '지하철',     sub: '도시철도' },
  { key: 'train',     Icon: TrainFront,    tint: '#DC2626', label: '기차',       sub: 'KTX·SRT·무궁화호 등' },
  { key: 'bus',       Icon: Bus,           tint: '#16A34A', label: '버스',       sub: '시내·시외' },
  { key: 'classroom', Icon: GraduationCap, tint: '#7C3AED', label: '강의실',     sub: '학교' },
  { key: 'other',     Icon: MapPin,        tint: '#F97316', label: '카페·음식점', sub: '지도에서 위치 찍기' },
  { key: 'office',    Icon: Building2,     tint: '#475569', label: '사무실',     sub: '회사' },
];

const CAR_OPTIONS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

const TRAIN_TYPES = ['KTX', 'SRT', 'ITX-새마을', 'ITX-마음', '무궁화호', '누리로'] as const;
type TrainType = (typeof TRAIN_TYPES)[number];
const TRAIN_CAR_OPTIONS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20];

export function LocationWizardScreen({ onBack, onPicked, onRegisterFreeform }: Props) {
  const [category, setCategory] = useState<Category | null>(null);

  // Bus state
  const [busRoute, setBusRoute] = useState('');
  const [busStop, setBusStop] = useState('');
  const [busMatch, setBusMatch] = useState<BusMatchResult | null>(null);
  const [busMatchLoading, setBusMatchLoading] = useState(false);
  const [busMatchTriggered, setBusMatchTriggered] = useState(false);

  // Train state
  const [trainType, setTrainType] = useState<TrainType | null>(null);
  const [trainCar, setTrainCar] = useState<number | 'unknown' | null>(null);
  const [trainDest, setTrainDest] = useState('');
  // Optional segment-precise mode: when user provides prev+next station that
  // matches a known KTX/SRT/ITX/무궁화호 chain, we auto-detect the line.
  const [trainPrevQuery, setTrainPrevQuery] = useState('');
  const [trainNextQuery, setTrainNextQuery] = useState('');
  const [pickedTrainRoute, setPickedTrainRoute] = useState<string | null>(null); // "operator::line"

  const trainSegmentMatches = useMemo(() => {
    const a = trainPrevQuery.trim();
    const b = trainNextQuery.trim();
    if (!a || !b) return [];
    return findTrainSegments(a, b);
  }, [trainPrevQuery, trainNextQuery]);

  const resolvedTrainSegment = useMemo(() => {
    if (trainSegmentMatches.length === 0) return null;
    if (trainSegmentMatches.length === 1) return trainSegmentMatches[0];
    if (!pickedTrainRoute) return null;
    return trainSegmentMatches.find((s) => `${s.operator}::${s.line}` === pickedTrainRoute) ?? null;
  }, [trainSegmentMatches, pickedTrainRoute]);

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submitTrain = async () => {
    if (!trainCar) return;
    // Two valid paths: segment-precise (prev+next matched) OR type-based (trainType set).
    const seg = resolvedTrainSegment;
    if (!seg && !trainType) return;
    setSubmitting(true);
    setError(null);
    try {
      const carLabel = trainCar === 'unknown' ? '호차 미정' : `${trainCar}호차`;
      const carIdPart = trainCar === 'unknown' ? 'x' : String(trainCar);
      let id: string;
      let name: string;
      let detail: string;
      if (seg) {
        // Segment-precise bucket — groups votes by exact route segment + car.
        id = `train:seg:${seg.operator}:${seg.line}:${seg.prev}-${seg.next}:${carIdPart}`;
        name = `${seg.line} ${seg.prev}→${seg.next} · ${carLabel}`;
        detail = `${seg.operator} · ${seg.line} · ${seg.prev}→${seg.next}`;
      } else {
        const dest = trainDest.trim();
        const destPart = dest ? `:${dest}` : '';
        id = `train:${trainType}${destPart}:${carIdPart}`;
        name = dest ? `${trainType} ${carLabel} (${dest}행)` : `${trainType} ${carLabel}`;
        detail = dest ? `${trainType} · ${dest}행` : (trainType ?? '');
      }
      await api.upsertPlace({
        id,
        name,
        type: 'train',
        district: undefined,
        detail,
      });
      onPicked(id);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSubmitting(false);
    }
  };

  const tryMatchBus = async () => {
    const route = busRoute.trim();
    const stop = busStop.trim();
    if (!route || !stop) return;
    setBusMatchLoading(true);
    setBusMatchTriggered(true);
    setBusMatch(null);
    setError(null);
    try {
      const m = await api.matchBusVehicle({ routeName: route, stopName: stop });
      setBusMatch(m);
    } catch (e) {
      setBusMatch({ matched: false, reason: (e as Error).message });
    } finally {
      setBusMatchLoading(false);
    }
  };

  const submitBus = async () => {
    const route = busRoute.trim();
    if (!route) return;
    setSubmitting(true);
    setError(null);
    try {
      const stop = busStop.trim();
      let id: string;
      let name: string;
      let detail: string | undefined;
      if (busMatch?.matched && busMatch.vehId) {
        // 차량 단위 집계 — 같은 차량 탑승자끼리 모음
        id = `bus:vehicle:${busMatch.vehId}`;
        name = `${busMatch.routeName ?? route}번 [차량 ${busMatch.plainNo ?? busMatch.vehId}]`;
        detail = busMatch.currentStop ? `${busMatch.currentStop} 지남` : undefined;
      } else {
        id = stop ? `bus:${route}:${stop}` : `bus:${route}`;
        name = stop ? `${route}번 버스 (${stop})` : `${route}번 버스`;
        detail = stop || undefined;
      }
      await api.upsertPlace({
        id,
        name,
        type: 'bus',
        district: undefined,
        detail,
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
          if (k === 'subway' || k === 'bus' || k === 'train' || k === 'classroom' || k === 'other') setCategory(k);
          else onRegisterFreeform(k as PlaceType);
        }}
        onPickPlaceId={onPicked}
        renderHeader={renderHeader}
      />
    );
  }

  // ── STEP 2: VENUE (카페·음식점·기타) — Naver Map picker ──────────────
  if (category === 'other') {
    return (
      <div style={{ height: '100%', display: 'flex', flexDirection: 'column', background: TOKEN.bg, fontFamily: FONT }}>
        {renderHeader('카페·음식점 위치', () => setCategory(null))}
        <div style={{ flex: 1, minHeight: 0 }}>
          <NaverMapPicker
            onConfirm={async ({ placeId, name, address, lat, lng }) => {
              try {
                await api.upsertPlace({
                  id: placeId,
                  name,
                  type: 'other',
                  district: address || undefined,
                  detail: `좌표 ${lat.toFixed(4)}, ${lng.toFixed(4)}`,
                });
                onPicked(placeId);
              } catch (e) {
                alert((e as Error).message);
              }
            }}
          />
        </div>
      </div>
    );
  }

  // ── STEP 2: SUBWAY ────────────────────────────────────────────────
  if (category === 'subway') {
    return (
      <SubwayWizard
        onPicked={onPicked}
        renderHeader={(t) => renderHeader(t, () => { setCategory(null); })}
      />
    );
  }

  // ── STEP 2: CLASSROOM (서울대) ─────────────────────────────────────
  if (category === 'classroom') {
    return (
      <SNUClassroomWizard
        onPicked={onPicked}
        onFreeform={() => onRegisterFreeform('classroom')}
        renderHeader={(t) => renderHeader(t, () => { setCategory(null); })}
      />
    );
  }

  // ── STEP 2: TRAIN ─────────────────────────────────────────────────
  if (category === 'train') {
    // Either: segment-precise (prev+next matched + car) OR legacy (trainType + car)
    const canSubmit = !!trainCar && (resolvedTrainSegment !== null || !!trainType) && !submitting;
    const trainStationSuggestions = (q: string): string[] => {
      const t = q.trim();
      if (!t) return [];
      const fromSubway = STATIONS.filter((s) => s.name.includes(t)).slice(0, 5).map((s) => s.name.replace(/역$/, ''));
      const fromTrain = searchTrainStations(t, 5).map((s) => s.name.replace(/역$/, ''));
      const merged: string[] = [];
      for (const n of [...fromSubway, ...fromTrain]) if (!merged.includes(n)) merged.push(n);
      return merged.slice(0, 8);
    };
    const prevSuggestions = trainStationSuggestions(trainPrevQuery);
    const nextSuggestions = trainStationSuggestions(trainNextQuery);
    return (
      <div style={{ height: '100%', display: 'flex', flexDirection: 'column', background: TOKEN.bg, fontFamily: FONT }}>
        {renderHeader('기차', () => {
          setCategory(null); setTrainType(null); setTrainCar(null); setTrainDest('');
          setTrainPrevQuery(''); setTrainNextQuery(''); setPickedTrainRoute(null);
        })}
        <div style={{ flex: 1, overflowY: 'auto', padding: '20px 20px 80px' }}>
          {/* ── Segment-precise input (optional) ────────────────────── */}
          <div style={{ marginBottom: 22, padding: 14, background: TOKEN.surface, border: `1px solid ${TOKEN.border}`, borderRadius: TOKEN.r.md }}>
            <Label>방금 지나간 역 → 다음 도착 역 <span style={{ fontWeight: 400, color: TOKEN.text3 }}>(알면 입력하세요. 노선 자동 매칭)</span></Label>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              <SimpleSuggestInput
                value={trainPrevQuery}
                setValue={(v) => { setTrainPrevQuery(v); setPickedTrainRoute(null); }}
                placeholder="예: 대전"
                suggestions={prevSuggestions}
              />
              <SimpleSuggestInput
                value={trainNextQuery}
                setValue={(v) => { setTrainNextQuery(v); setPickedTrainRoute(null); }}
                placeholder="예: 김천(구미)"
                suggestions={nextSuggestions}
              />
            </div>
            {trainPrevQuery.trim() && trainNextQuery.trim() && trainSegmentMatches.length === 0 && (
              <div style={{ marginTop: 10, padding: 10, background: TOKEN.hotBg, color: TOKEN.hot, borderRadius: TOKEN.r.sm, fontSize: 12, lineHeight: 1.5 }}>
                두 역이 같은 열차 노선의 인접 정차역이 아니에요. 오타를 확인하거나, 아래에서 열차 종류를 직접 골라주세요.
              </div>
            )}
            {trainSegmentMatches.length === 1 && (
              <div style={{ marginTop: 10, padding: 10, background: TOKEN.coldBg, border: `1.5px solid ${TOKEN.cold}`, borderRadius: TOKEN.r.sm, fontSize: 13, fontWeight: 700, color: TOKEN.cold }}>
                ✓ {trainSegmentMatches[0].operator} · {trainSegmentMatches[0].line} · {trainSegmentMatches[0].prev}→{trainSegmentMatches[0].next}
              </div>
            )}
            {trainSegmentMatches.length > 1 && (
              <div style={{ marginTop: 10 }}>
                <div style={{ fontSize: 11, color: TOKEN.text2, marginBottom: 6 }}>여러 열차가 다닙니다. 어느 열차?</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {trainSegmentMatches.map((s) => {
                    const k = `${s.operator}::${s.line}`;
                    const active = pickedTrainRoute === k;
                    return (
                      <button
                        key={k}
                        onClick={() => setPickedTrainRoute(active ? null : k)}
                        style={{
                          padding: '7px 12px',
                          background: active ? TOKEN.cold : TOKEN.surface,
                          color: active ? '#fff' : TOKEN.text1,
                          border: `1.5px solid ${active ? TOKEN.cold : TOKEN.border}`,
                          borderRadius: 999, fontSize: 12, fontWeight: 700,
                          cursor: 'pointer', fontFamily: FONT,
                        }}
                      >
                        {s.line}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          <Label>{resolvedTrainSegment ? '어떤 열차 타고 계세요? (자동 감지됨)' : '어떤 열차 타고 계세요? *'}</Label>
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
    const canMatch = !!busRoute.trim() && !!busStop.trim() && !busMatchLoading;
    return (
      <div style={{ height: '100%', display: 'flex', flexDirection: 'column', background: TOKEN.bg, fontFamily: FONT }}>
        {renderHeader('버스', () => {
          setCategory(null);
          setBusRoute(''); setBusStop(''); setBusMatch(null); setBusMatchTriggered(false);
        })}
        <div style={{ flex: 1, overflowY: 'auto', padding: '24px 20px 60px' }}>
          <div style={{ fontSize: 20, fontWeight: 900, color: TOKEN.text1, marginBottom: 6, letterSpacing: '-0.4px' }}>
            어떤 버스 타고 계세요?
          </div>
          <div style={{ fontSize: 13, color: TOKEN.text2, marginBottom: 22, lineHeight: 1.6 }}>
            노선 번호 + 지금 지나는 정류장을 알려주시면 어떤 차량인지 찾아드릴게요.
          </div>

          <Label>노선 번호 *</Label>
          <input
            value={busRoute}
            onChange={(e) => { setBusRoute(e.target.value); setBusMatch(null); setBusMatchTriggered(false); }}
            placeholder="예: 272, 5511, M7106"
            style={fieldStyle(!!busRoute)}
            inputMode="text"
            autoFocus
          />

          <div style={{ height: 14 }} />

          <Label>지나는 정류장 *</Label>
          <input
            value={busStop}
            onChange={(e) => { setBusStop(e.target.value); setBusMatch(null); setBusMatchTriggered(false); }}
            placeholder="예: 신촌오거리, 강남역.강남대로"
            style={fieldStyle(!!busStop)}
          />

          <div style={{ height: 18 }} />

          {!busMatchTriggered && (
            <button
              onClick={tryMatchBus}
              disabled={!canMatch}
              style={{
                width: '100%', padding: '13px',
                background: canMatch ? TOKEN.surface : TOKEN.bg,
                color: canMatch ? TOKEN.cold : TOKEN.text3,
                border: `1.5px solid ${canMatch ? TOKEN.cold : TOKEN.border}`,
                borderRadius: TOKEN.r.md, fontSize: 14, fontWeight: 700,
                cursor: canMatch ? 'pointer' : 'default', fontFamily: FONT,
              }}
            >
              너가 타고 있는 버스 찾기
            </button>
          )}

          {busMatchLoading && (
            <div style={{ padding: '14px', textAlign: 'center', fontSize: 13, color: TOKEN.text2 }}>
              {busRoute}번 차량 위치 조회 중…
            </div>
          )}

          {!busMatchLoading && busMatch && (
            <div style={{
              padding: '14px 16px',
              background: busMatch.matched ? '#F0FDF4' : TOKEN.surface,
              border: `1.5px solid ${busMatch.matched ? TOKEN.ok : TOKEN.border}`,
              borderRadius: TOKEN.r.md,
            }}>
              {busMatch.matched ? (
                <div>
                  <div style={{ fontSize: 11, color: TOKEN.text2, marginBottom: 4 }}>이 버스 맞으시죠?</div>
                  <div style={{ fontSize: 16, fontWeight: 900, color: TOKEN.text1, letterSpacing: '-0.3px' }}>
                    {busMatch.routeName}번 · 차량번호 {busMatch.plainNo}
                  </div>
                  <div style={{ fontSize: 12, color: TOKEN.text2, marginTop: 4 }}>
                    {busMatch.currentStop} 지나는 중{busMatch.nextStop ? ` · 다음 ${busMatch.nextStop}` : ''}
                  </div>
                </div>
              ) : (
                <div style={{ fontSize: 12, color: TOKEN.text3, lineHeight: 1.5 }}>
                  {busMatch.reason === 'no_vehicle_at_stop'
                    ? `${busRoute}번이 지금 ${busStop} 근처에 없어요. 정류장명 확인하거나 그냥 노선 단위로 투표할게요.`
                    : busMatch.reason === 'route_or_stop_not_found'
                    ? '노선 또는 정류장을 못 찾았어요. 정확한 이름을 입력해주세요.'
                    : busMatch.reason === 'no_api_key'
                    ? '아직 API 키 활성화 대기 중이에요. 잠시 후 다시 시도해주세요. (그래도 노선 단위로 투표는 가능)'
                    : '차량을 못 찾았어요. 노선 단위로 투표할게요.'}
                </div>
              )}
            </div>
          )}

          {error && (
            <div style={{ marginTop: 14, padding: 10, background: TOKEN.hotBg, color: TOKEN.hot, borderRadius: TOKEN.r.md, fontSize: 12 }}>{error}</div>
          )}

          <div style={{ height: 28 }} />

          <button
            onClick={submitBus}
            disabled={!busRoute.trim() || submitting}
            style={primaryButtonStyle(!!busRoute.trim() && !submitting)}
          >
            {submitting ? '이동 중…' : busMatch?.matched ? '이 차량으로 투표하기' : '투표하러 가기'}
          </button>
        </div>
      </div>
    );
  }

  return null;
}

// ── Subway wizard sub-component ─────────────────────────────────────

interface SubwayWizardProps {
  onPicked: (placeId: string) => void;
  renderHeader: (title: string) => React.ReactNode;
}

type SubwayMode = 'train' | 'platform';

function SubwayWizard({ onPicked, renderHeader }: SubwayWizardProps) {
  const [mode, setMode] = useState<SubwayMode>('train');

  // 열차 안 (train mode) state
  const [prevQuery, setPrevQuery] = useState('');
  const [prevStation, setPrevStation] = useState<Station | null>(null);
  const [nextQuery, setNextQuery] = useState('');
  const [nextStationSel, setNextStationSel] = useState<Station | null>(null);
  const [pickedLine, setPickedLine] = useState<string | null>(null);

  // 플랫폼 (platform mode) state
  const [platQuery, setPlatQuery] = useState('');
  const [platStation, setPlatStation] = useState<Station | null>(null);

  // Shared
  const [car, setCar] = useState<number | 'unknown' | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Realtime train match (auto-fired when segment resolves)
  const [trainMatch, setTrainMatch] = useState<SubwayMatchResult | null>(null);
  const [matchLoading, setMatchLoading] = useState(false);

  // Segment resolution — pass city to disambiguate multi-city "1호선" etc.
  const segments = useMemo(() => {
    if (!prevStation || !nextStationSel) return [];
    // Both stations should share a city for a valid same-line segment.
    const city = prevStation.city === nextStationSel.city ? prevStation.city : undefined;
    return findSegments(prevStation.name, nextStationSel.name, city);
  }, [prevStation, nextStationSel]);

  const resolvedSegment = useMemo(() => {
    if (segments.length === 0) return null;
    if (segments.length === 1) return segments[0];
    return pickedLine ? segments.find((s) => s.line === pickedLine) ?? null : null;
  }, [segments, pickedLine]);

  const noMatch = prevStation && nextStationSel && segments.length === 0;

  // Auto-fire realtime match once we have a resolved segment (Seoul lines 1~9 only)
  useEffect(() => {
    setTrainMatch(null);
    if (!resolvedSegment) return;
    if (!/^[1-9]호선$/.test(resolvedSegment.line)) return;
    let cancelled = false;
    setMatchLoading(true);
    api.matchSubwayTrain({
      line: resolvedSegment.line,
      prev: resolvedSegment.prev,
      next: resolvedSegment.next,
    })
      .then((res) => {
        if (!cancelled) setTrainMatch(res);
      })
      .catch(() => {
        if (!cancelled) setTrainMatch({ matched: false, reason: 'network' });
      })
      .finally(() => {
        if (!cancelled) setMatchLoading(false);
      });
    return () => { cancelled = true; };
  }, [resolvedSegment?.line, resolvedSegment?.prev, resolvedSegment?.next]);

  const submitTrain = async () => {
    if (!resolvedSegment || car === null || submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      const carPart = car === 'unknown' ? '' : ` ${car}호차`;
      const carIdPart = car === 'unknown' ? 'x' : String(car);
      // Prefer train-aware ID when realtime match succeeded — aggregates votes
      // per physical train, not per segment (서비스 핵심 묘미).
      let id: string;
      let name: string;
      let detail: string;
      if (trainMatch?.matched && trainMatch.trainNo) {
        id = `subway:train:${resolvedSegment.line}:${trainMatch.trainNo}:${carIdPart}`;
        const dest = trainMatch.destination ? ` (${trainMatch.destination}행)` : '';
        name = `${resolvedSegment.line} ${trainMatch.trainNo}번 열차${dest}${carPart}`;
        detail = `${resolvedSegment.line} · ${trainMatch.trainNo}번 열차 · ${resolvedSegment.prev}→${resolvedSegment.next}`;
      } else {
        id = segmentPlaceId(resolvedSegment.line, resolvedSegment.prev, resolvedSegment.next, car);
        name = `${resolvedSegment.line} ${resolvedSegment.prev}→${resolvedSegment.next}${carPart}`;
        detail = `${resolvedSegment.line} · ${resolvedSegment.prev}→${resolvedSegment.next} 구간`;
      }
      await api.upsertPlace({
        id,
        name,
        type: 'subway',
        district: undefined,
        detail,
      });
      recordLine(resolvedSegment.line);
      onPicked(id);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSubmitting(false);
    }
  };

  const submitPlatform = async () => {
    if (!platStation || submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      const id = platformPlaceId(platStation.name, platStation.lines);
      const name = `${platStation.name} 승강장`;
      await api.upsertPlace({
        id,
        name,
        type: 'subway',
        district: platStation.city + (platStation.areas[0] ? ' ' + platStation.areas[0] : ''),
        detail: platStation.lines.join(' · '),
      });
      onPicked(id);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSubmitting(false);
    }
  };

  const trainCanSubmit = !!resolvedSegment && car !== null && !submitting;
  const platformCanSubmit = !!platStation && !submitting;
  // When one side is selected, restrict the other side's suggestions to ACTUAL
  // adjacent stations — turns autocomplete into a "pick one of N neighbors" UI.
  // City-scope the neighbor lookup so 교대역(서울)'s 부산 neighbors don't leak in.
  const restrictNamesFor = (anchor: Station | null): Set<string> | null => {
    if (!anchor) return null;
    return new Set(neighborNames(anchor.name, anchor.city));
  };

  const prevSuggestions = useMemo(() => {
    const restrict = restrictNamesFor(nextStationSel);
    if (restrict) {
      // Same-city restriction keeps multi-city collisions (시청, 교대) clean.
      const all = STATIONS.filter(
        (s) => restrict.has(s.name) && (!nextStationSel || s.city === nextStationSel.city),
      );
      const q = prevQuery.trim();
      return (q ? all.filter((s) => s.name.includes(q)) : all).slice(0, 8);
    }
    return prevQuery.trim() ? searchStations({ query: prevQuery, limit: 5 }) : [];
  }, [prevQuery, nextStationSel]);

  const nextSuggestions = useMemo(() => {
    const restrict = restrictNamesFor(prevStation);
    if (restrict) {
      const all = STATIONS.filter(
        (s) => restrict.has(s.name) && (!prevStation || s.city === prevStation.city),
      );
      const q = nextQuery.trim();
      return (q ? all.filter((s) => s.name.includes(q)) : all).slice(0, 8);
    }
    return nextQuery.trim() ? searchStations({ query: nextQuery, limit: 5 }) : [];
  }, [nextQuery, prevStation]);

  const platSuggestions = useMemo(() => platQuery.trim() ? searchStations({ query: platQuery, limit: 8 }) : [], [platQuery]);

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', background: TOKEN.bg, fontFamily: FONT }}>
      {renderHeader('지하철')}
      <div style={{ flex: 1, overflowY: 'auto', padding: '20px 20px 80px' }}>
        {/* Mode toggle */}
        <div style={{ display: 'flex', background: TOKEN.bg, border: `1px solid ${TOKEN.border}`, borderRadius: TOKEN.r.lg, padding: 4, marginBottom: 20 }}>
          <button
            onClick={() => setMode('train')}
            style={{
              flex: 1, padding: '10px',
              background: mode === 'train' ? TOKEN.surface : 'transparent',
              border: 'none', borderRadius: TOKEN.r.md,
              fontSize: 13, fontWeight: 700,
              color: mode === 'train' ? TOKEN.text1 : TOKEN.text3,
              cursor: 'pointer', fontFamily: FONT,
              boxShadow: mode === 'train' ? '0 1px 3px rgba(0,0,0,0.06)' : 'none',
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6,
            }}
          >
            <TramFront size={16} color={mode === 'train' ? TOKEN.text1 : TOKEN.text3} strokeWidth={2} />
            열차 안
          </button>
          <button
            onClick={() => setMode('platform')}
            style={{
              flex: 1, padding: '10px',
              background: mode === 'platform' ? TOKEN.surface : 'transparent',
              border: 'none', borderRadius: TOKEN.r.md,
              fontSize: 13, fontWeight: 700,
              color: mode === 'platform' ? TOKEN.text1 : TOKEN.text3,
              cursor: 'pointer', fontFamily: FONT,
              boxShadow: mode === 'platform' ? '0 1px 3px rgba(0,0,0,0.06)' : 'none',
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6,
            }}
          >
            <Hourglass size={16} color={mode === 'platform' ? TOKEN.text1 : TOKEN.text3} strokeWidth={2} />
            열차 기다리는 중
          </button>
        </div>

        {mode === 'train' ? (
          <TrainModeBody
            prevQuery={prevQuery} setPrevQuery={setPrevQuery}
            prevStation={prevStation} setPrevStation={setPrevStation}
            nextQuery={nextQuery} setNextQuery={setNextQuery}
            nextStation={nextStationSel} setNextStation={setNextStationSel}
            prevSuggestions={prevSuggestions}
            nextSuggestions={nextSuggestions}
            segments={segments}
            resolvedSegment={resolvedSegment}
            pickedLine={pickedLine}
            setPickedLine={setPickedLine}
            noMatch={!!noMatch}
            car={car} setCar={setCar}
            error={error}
            submitting={submitting}
            canSubmit={trainCanSubmit}
            onSubmit={submitTrain}
            trainMatch={trainMatch}
            matchLoading={matchLoading}
          />
        ) : (
          <PlatformModeBody
            query={platQuery} setQuery={setPlatQuery}
            station={platStation} setStation={setPlatStation}
            suggestions={platSuggestions}
            error={error}
            submitting={submitting}
            canSubmit={platformCanSubmit}
            onSubmit={submitPlatform}
          />
        )}
      </div>
    </div>
  );
}

// ── Train mode body ─────────────────────────────────────────────────

interface TrainModeBodyProps {
  prevQuery: string; setPrevQuery: (v: string) => void;
  prevStation: Station | null; setPrevStation: (v: Station | null) => void;
  nextQuery: string; setNextQuery: (v: string) => void;
  nextStation: Station | null; setNextStation: (v: Station | null) => void;
  prevSuggestions: Station[];
  nextSuggestions: Station[];
  segments: { line: string; prev: string; next: string }[];
  resolvedSegment: { line: string; prev: string; next: string } | null;
  pickedLine: string | null; setPickedLine: (v: string | null) => void;
  noMatch: boolean;
  car: number | 'unknown' | null; setCar: (v: number | 'unknown' | null) => void;
  error: string | null;
  submitting: boolean;
  canSubmit: boolean;
  onSubmit: () => void;
  trainMatch: SubwayMatchResult | null;
  matchLoading: boolean;
}

function TrainModeBody(p: TrainModeBodyProps) {
  return (
    <>
      <div style={{ fontSize: 13, color: TOKEN.text2, marginBottom: 14, lineHeight: 1.6 }}>
        안내방송 들리는 대로 두 역만 입력하세요. 노선과 방향은 자동으로 알아낼게요.
      </div>

      <StationAutocomplete
        label="🔵 방금 지나간 역"
        query={p.prevQuery}
        setQuery={p.setPrevQuery}
        station={p.prevStation}
        setStation={p.setPrevStation}
        suggestions={p.prevSuggestions}
        placeholder="예: 강남"
      />
      <div style={{ height: 12 }} />
      <StationAutocomplete
        label="🔴 다음 도착 역"
        query={p.nextQuery}
        setQuery={p.setNextQuery}
        station={p.nextStation}
        setStation={p.setNextStation}
        suggestions={p.nextSuggestions}
        placeholder="예: 역삼"
      />

      <div style={{ height: 18 }} />

      {/* Match feedback */}
      {p.prevStation && p.nextStation && (
        <>
          {p.segments.length === 0 && (
            <div style={{ padding: '14px', background: TOKEN.hotBg, color: TOKEN.hot, borderRadius: TOKEN.r.md, fontSize: 13, lineHeight: 1.6, marginBottom: 14 }}>
              두 역이 인접해 있지 않아요.<br />
              <span style={{ fontSize: 11, color: TOKEN.text2 }}>오타가 있거나 다음역이 아닐 수 있어요. 다시 확인해주세요.</span>
            </div>
          )}
          {p.segments.length === 1 && (
            <div style={{ padding: '14px', background: TOKEN.coldBg, border: `1.5px solid ${TOKEN.cold}`, borderRadius: TOKEN.r.md, marginBottom: 14 }}>
              <div style={{ fontSize: 11, color: TOKEN.text2, marginBottom: 4 }}>자동 매칭</div>
              <div style={{ fontSize: 15, fontWeight: 800, color: TOKEN.cold, display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ width: 10, height: 10, borderRadius: '50%', background: lineColor(p.segments[0].line) }} />
                {p.segments[0].line} · {p.segments[0].prev} → {p.segments[0].next}
              </div>
            </div>
          )}
          {p.segments.length > 1 && (
            <div style={{ marginBottom: 14 }}>
              <Label>이 구간은 여러 노선이 있어요. 어느 노선?</Label>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {p.segments.map((s) => {
                  const active = p.pickedLine === s.line;
                  return (
                    <button
                      key={s.line}
                      onClick={() => p.setPickedLine(active ? null : s.line)}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 6,
                        padding: '8px 14px',
                        background: active ? lineColor(s.line) : TOKEN.surface,
                        color: active ? '#fff' : TOKEN.text1,
                        border: `1.5px solid ${active ? lineColor(s.line) : TOKEN.border}`,
                        borderRadius: 999, fontSize: 13, fontWeight: 700,
                        cursor: 'pointer', fontFamily: FONT,
                      }}
                    >
                      <span style={{ width: 10, height: 10, borderRadius: '50%', background: active ? '#fff' : lineColor(s.line) }} />
                      {s.line}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </>
      )}

      {/* Train identity card (realtime match) */}
      {p.resolvedSegment && (p.matchLoading || p.trainMatch) && (
        <div style={{
          marginBottom: 16,
          padding: '14px 16px',
          background: p.trainMatch?.matched ? '#F0FDF4' : TOKEN.surface,
          border: `1.5px solid ${p.trainMatch?.matched ? TOKEN.ok : TOKEN.border}`,
          borderRadius: TOKEN.r.md,
        }}>
          {p.matchLoading ? (
            <div style={{ fontSize: 13, color: TOKEN.text2 }}>지금 그 구간 지나는 열차 찾는 중…</div>
          ) : p.trainMatch?.matched ? (
            <div>
              <div style={{ fontSize: 11, color: TOKEN.text2, marginBottom: 4 }}>이 열차 맞으시죠?</div>
              <div style={{ fontSize: 16, fontWeight: 900, color: TOKEN.text1, letterSpacing: '-0.3px' }}>
                {p.resolvedSegment.line} · {p.trainMatch.trainNo}번 열차
              </div>
              {p.trainMatch.destination && (
                <div style={{ fontSize: 12, color: TOKEN.text2, marginTop: 2 }}>
                  {p.trainMatch.destination}행 · 현재 {p.trainMatch.currentStation}
                </div>
              )}
            </div>
          ) : (
            <div style={{ fontSize: 12, color: TOKEN.text3, lineHeight: 1.5 }}>
              지금 그 구간 지나는 열차를 못 찾았어요. 구간 단위로 투표할게요.
            </div>
          )}
        </div>
      )}

      {/* Car picker only after segment resolved */}
      {p.resolvedSegment && (
        <>
          <Label>{p.trainMatch?.matched ? '몇 번째 칸에 있어요?' : '몇 호차예요?'}</Label>
          <button
            onClick={() => p.setCar(p.car === 'unknown' ? null : 'unknown')}
            style={{
              width: '100%', padding: '14px',
              background: p.car === 'unknown' ? TOKEN.cold : TOKEN.surface,
              color: p.car === 'unknown' ? '#fff' : TOKEN.text1,
              border: `1.5px dashed ${p.car === 'unknown' ? TOKEN.cold : TOKEN.border}`,
              borderRadius: TOKEN.r.md, fontSize: 14, fontWeight: 700,
              cursor: 'pointer', fontFamily: FONT, marginBottom: 8,
            }}
          >
            {p.car === 'unknown' ? '✓ 칸 모름' : '칸 모름 — 그래도 투표할게요'}
          </button>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 8, marginBottom: 20 }}>
            {CAR_OPTIONS.map((n) => {
              const active = p.car === n;
              return (
                <button
                  key={n}
                  onClick={() => p.setCar(active ? null : n)}
                  style={{
                    padding: '12px 0',
                    background: active ? TOKEN.cold : TOKEN.surface,
                    color: active ? '#fff' : TOKEN.text1,
                    border: `1.5px solid ${active ? TOKEN.cold : TOKEN.border}`,
                    borderRadius: TOKEN.r.md,
                    fontSize: 16, fontWeight: 800, cursor: 'pointer',
                    fontFamily: FONT, fontVariantNumeric: 'tabular-nums',
                  }}
                >
                  {n}
                </button>
              );
            })}
          </div>
        </>
      )}

      {p.error && (
        <div style={{ marginBottom: 14, padding: 10, background: TOKEN.hotBg, color: TOKEN.hot, borderRadius: TOKEN.r.md, fontSize: 12 }}>{p.error}</div>
      )}

      <button onClick={p.onSubmit} disabled={!p.canSubmit} style={primaryButtonStyle(p.canSubmit)}>
        {p.submitting ? '이동 중…' : '투표하러 가기'}
      </button>
    </>
  );
}

// ── Platform mode body ──────────────────────────────────────────────

interface PlatformModeBodyProps {
  query: string; setQuery: (v: string) => void;
  station: Station | null; setStation: (v: Station | null) => void;
  suggestions: Station[];
  error: string | null;
  submitting: boolean;
  canSubmit: boolean;
  onSubmit: () => void;
}

function PlatformModeBody(p: PlatformModeBodyProps) {
  return (
    <>
      <div style={{ fontSize: 13, color: TOKEN.text2, marginBottom: 14, lineHeight: 1.6 }}>
        어느 역에서 열차 기다리고 계세요? 그 역에서 기다리는 모든 분들과 같은 의견이 모입니다.
      </div>
      <StationAutocomplete
        label="역 이름"
        query={p.query}
        setQuery={p.setQuery}
        station={p.station}
        setStation={p.setStation}
        suggestions={p.suggestions}
        placeholder="예: 강남, ㄱㄴ"
      />
      <div style={{ height: 20 }} />
      {p.error && (
        <div style={{ marginBottom: 14, padding: 10, background: TOKEN.hotBg, color: TOKEN.hot, borderRadius: TOKEN.r.md, fontSize: 12 }}>{p.error}</div>
      )}
      <button onClick={p.onSubmit} disabled={!p.canSubmit} style={primaryButtonStyle(p.canSubmit)}>
        {p.submitting ? '이동 중…' : '투표하러 가기'}
      </button>
    </>
  );
}

// ── Lightweight text-only suggestion input (used by train segment picker) ──

function SimpleSuggestInput({ value, setValue, placeholder, suggestions }: {
  value: string;
  setValue: (v: string) => void;
  placeholder: string;
  suggestions: string[];
}) {
  const [focused, setFocused] = useState(false);
  const showList = focused && value.trim() !== '' && suggestions.length > 0 &&
    !suggestions.some((s) => s === value.trim());
  return (
    <div style={{ position: 'relative' }}>
      <input
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onFocus={() => setFocused(true)}
        onBlur={() => setTimeout(() => setFocused(false), 120)}
        placeholder={placeholder}
        style={fieldStyle(!!value)}
      />
      {showList && (
        <div style={{
          position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 10,
          marginTop: 4, background: TOKEN.surface,
          border: `1px solid ${TOKEN.border}`, borderRadius: TOKEN.r.md,
          boxShadow: '0 4px 14px rgba(0,0,0,0.08)', overflow: 'hidden',
        }}>
          {suggestions.slice(0, 6).map((s) => (
            <button
              key={s}
              onMouseDown={(e) => { e.preventDefault(); setValue(s); setFocused(false); }}
              style={{
                display: 'block', width: '100%', textAlign: 'left',
                padding: '10px 14px', background: 'transparent', border: 'none',
                borderBottom: `1px solid ${TOKEN.border}`,
                fontSize: 13, color: TOKEN.text1, cursor: 'pointer', fontFamily: FONT,
              }}
            >
              {s}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Station autocomplete (shared) ──────────────────────────────────

function StationAutocomplete({ label, query, setQuery, station, setStation, suggestions, placeholder }: {
  label: string;
  query: string; setQuery: (v: string) => void;
  station: Station | null; setStation: (v: Station | null) => void;
  suggestions: Station[];
  placeholder: string;
}) {
  if (station) {
    return (
      <div>
        <Label>{label}</Label>
        <div style={{
          display: 'flex', alignItems: 'center', gap: 10,
          padding: '12px 14px',
          background: TOKEN.coldBg, border: `2px solid ${TOKEN.cold}`,
          borderRadius: TOKEN.r.md,
        }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: TOKEN.text1 }}>{station.name}</div>
            <div style={{ fontSize: 11, color: TOKEN.text3, marginTop: 2 }}>
              {station.lines.join(' · ')}{station.city ? ' · ' + station.city : ''}
            </div>
          </div>
          <button
            onClick={() => { setStation(null); setQuery(''); }}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: TOKEN.text2, fontSize: 13, fontFamily: FONT }}
          >
            변경
          </button>
        </div>
      </div>
    );
  }
  return (
    <div>
      <Label>{label}</Label>
      <input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder={placeholder}
        style={fieldStyle(!!query)}
      />
      {suggestions.length > 0 && (
        <div style={{ marginTop: 6, display: 'flex', flexDirection: 'column', gap: 4 }}>
          {suggestions.map((s) => (
            <button
              key={s.id}
              onClick={() => { setStation(s); setQuery(''); }}
              style={{
                display: 'flex', alignItems: 'center', gap: 10,
                padding: '10px 14px',
                background: TOKEN.surface, border: `1px solid ${TOKEN.border}`,
                borderRadius: TOKEN.r.md, cursor: 'pointer', fontFamily: FONT,
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
  // 검색창 제거 (2026-05-26): 지하철/버스/카페/강의실 UX 흐름이 다 달라
  // 검색 하나로 통합 불가. 카테고리 선택 → 흐름별 wizard 가 더 명확.
  const [coords, setCoords] = useState<Coords | null>(null);
  const [geoLoading, setGeoLoading] = useState(false);
  const [geoError, setGeoError] = useState<string | null>(null);
  const [showGeoSheet, setShowGeoSheet] = useState(false);
  const [submitting, setSubmitting] = useState<string | null>(null);

  const nearby: NearbyHit[] = useMemo(() => {
    if (!coords) return [];
    return STATIONS
      .filter((s) => typeof s.lat === 'number' && typeof s.lng === 'number')
      .map((s) => ({ station: s, dist: distanceM(coords, { lat: s.lat as number, lng: s.lng as number }) }))
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
