'use client';

import { useMemo, useState, useEffect } from 'react';
import { Hourglass, TramFront } from 'lucide-react';
import { TOKEN, FONT } from '@aircon/core';
import { api } from '../lib/apiClient';
import type { PlaceType } from '@aircon/core';
import { lineColor, searchStations, type Station, STATIONS } from '@aircon/core';
import { BackIcon } from '../components/Icons';
import { recordLine } from '../lib/recentPlaces';
import { findSegments, segmentPlaceId, platformPlaceId, neighborNames } from '@aircon/core';
import type { SubwayMatchResult } from '../lib/apiClient';
import { WizardLanding } from './wizard/WizardLanding';
import { type Category } from './wizard/categories';
import { BusWizard } from './wizard/bus/BusWizard';
import { TrainWizard } from './wizard/train/TrainWizard';
import { CafeWizard } from './wizard/cafe/CafeWizard';
import { ClassroomWizard } from './wizard/classroom/ClassroomWizard';

interface Props {
  onBack: () => void;
  onPicked: (placeId: string) => void;
  onRegisterFreeform: (initialType: PlaceType) => void;
}

const CAR_OPTIONS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

export function LocationWizardScreen({ onBack, onPicked, onRegisterFreeform }: Props) {
  const [category, setCategory] = useState<Category | null>(null);

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
    return <CafeWizard onBack={() => setCategory(null)} onPicked={onPicked} />;
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
      <ClassroomWizard
        onBack={() => setCategory(null)}
        onPicked={onPicked}
        onFreeform={() => onRegisterFreeform('classroom')}
      />
    );
  }

  // ── STEP 2: TRAIN ─────────────────────────────────────────────────
  if (category === 'train') {
    return <TrainWizard onBack={() => setCategory(null)} onPicked={onPicked} />;
  }

  // ── STEP 2: BUS ───────────────────────────────────────────────────
  if (category === 'bus') {
    return <BusWizard onBack={() => setCategory(null)} onPicked={onPicked} />;
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
  // matchNonce: "변경" 후 같은 역 재선택해도 useEffect 강제 refire.
  // 또 사용자가 ↻ 버튼으로 manual refetch도 가능.
  const [matchNonce, setMatchNonce] = useState(0);

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
  }, [resolvedSegment?.line, resolvedSegment?.prev, resolvedSegment?.next, matchNonce]);

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
            prevStation={prevStation}
            setPrevStation={(s) => { setPrevStation(s); setMatchNonce((n) => n + 1); }}
            nextQuery={nextQuery} setNextQuery={setNextQuery}
            nextStation={nextStationSel}
            setNextStation={(s) => { setNextStationSel(s); setMatchNonce((n) => n + 1); }}
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
