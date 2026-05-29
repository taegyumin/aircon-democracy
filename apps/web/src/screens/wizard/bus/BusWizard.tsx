'use client';

// 버스 wizard — Claude Design 'Bus Vote Redesign' 와이어프레임 반영.
// 흐름:
//   ① 번호 입력 (autocomplete + 양방향 종점 row)
//   ② 노선 확정 + ConfirmedBusChip + BusConfirmCard + GPS 권한 카드
//   ③ 정류장 선택 — GPS 허용: 근처 정류장 / 거부: 검색 + 전체 list. "모름" 옵션 항상.
//
// 백엔드: /api/realtime/bus/route-search + /route-stations (data.go.kr 래핑).
// 차량 매칭은 정류장 확정 후 기존 /bus/match로 호출.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  TOKEN, FONT, distanceM, formatDistance,
  CITY_CODES, SEOUL_REGION,
  type BusRouteCandidate, type BusRouteStation, type Coords,
  type BusMatchCandidate,
} from '@aircon/core';
import { api } from '../../../lib/apiClient';
import { WizardHeader } from '../WizardHeader';
import { useBusMatch, freshenBusMatch } from './useBusMatch';
import { buildBusPlace } from './buildBusPlace';
import { RouteTimeline } from './RouteTimeline';
import type { BusVehiclePosition } from '@aircon/core';

// region: 'seoul' (ws.bus.go.kr) 또는 cityCode 숫자 문자열 (TAGO 1613000).
// 사용자 변경 가능. GPS로 자동 추론 후 사용자가 dropdown으로 override.
type Region = string; // 'seoul' | '21' | '31010' ...
const DEFAULT_REGION: Region = SEOUL_REGION;

// ── 시각 토큰 (디자인 시안 정렬) ──────────────────────────────────
// 서울 시내버스 type 색. 디자인 BUS map 충실.
const BUS_TYPE_COLOR: Record<string, string> = {
  '간선': '#0052A4', '지선': '#4E9C3F', '광역': '#C00010',
  '순환': '#E8A000', '마을': '#4E9C3F', '공항': '#0090D2',
  '인천': '#0052A4', '경기': '#4E9C3F',
};
function busColor(typeLabel: string): string {
  return BUS_TYPE_COLOR[typeLabel] ?? '#0052A4';
}

interface Props {
  onBack: () => void;
  onPicked: (placeId: string) => void;
}

type Phase = 'number' | 'route-confirmed' | 'stops';
type GpsState = 'idle' | 'pending' | 'granted' | 'denied' | 'unsupported';
type StopSel = BusRouteStation | { unknown: true } | null;

export function BusWizard({ onBack, onPicked }: Props) {
  const [phase, setPhase] = useState<Phase>('number');

  // Region — privacy contract: 자동 GPS 요청 X. 사용자가 'GPS로 찾기' 버튼 누를 때만 요청.
  // (이전 회귀: 진입 시 silent geolocation → 사용자 모르게 좌표 NCP/서버 전송. LLM P1.)
  const [region, setRegion] = useState<Region>(DEFAULT_REGION);
  const [regionLabel, setRegionLabel] = useState<string>('서울특별시');
  const [regionDetecting, setRegionDetecting] = useState(false);

  // Step 1 — 번호 input + autocomplete
  const [routeQuery, setRouteQuery] = useState('');
  const [routeCandidates, setRouteCandidates] = useState<BusRouteCandidate[]>([]);
  const [routeLoading, setRouteLoading] = useState(false);
  const routeSeqRef = useRef(0);

  // 사용자가 명시적으로 'GPS로 찾기' 누를 때만 위치 요청 + 서버 호출.
  const detectRegionByGps = useCallback(() => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) return;
    setRegionDetecting(true);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        try {
          const res = await api.busRegionByCoords(pos.coords.latitude, pos.coords.longitude);
          if (res.region) {
            setRegion(res.region);
            const fromCode = res.region === 'seoul'
              ? '서울특별시'
              : CITY_CODES.find((c) => String(c.code) === res.region)?.name
                ?? res.sigunguName ?? res.sidoName ?? res.region;
            setRegionLabel(fromCode);
          }
        } catch { /* keep current */ }
        setRegionDetecting(false);
      },
      () => { setRegionDetecting(false); },
      { enableHighAccuracy: false, timeout: 6000, maximumAge: 300_000 },
    );
  }, []);

  // Step 2/3 — 확정된 노선 + 정류장
  const [selectedRoute, setSelectedRoute] = useState<BusRouteCandidate | null>(null);
  const [stations, setStations] = useState<BusRouteStation[]>([]);
  const [stationsLoading, setStationsLoading] = useState(false);
  const [stationsErr, setStationsErr] = useState<string | null>(null);
  const [gps, setGps] = useState<GpsState>('idle');
  const [coords, setCoords] = useState<Coords | null>(null);
  const [stopSearch, setStopSearch] = useState('');
  const [stopSel, setStopSel] = useState<StopSel>(null);

  // 정류장 확정 후 차량 매칭 (기존 hook 그대로).
  const { match: rawMatch, loading: matchLoading, tryMatch, reset: resetMatch } = useBusMatch();
  const selectedStopName = stopSel && 'name' in stopSel ? stopSel.name : '';
  const freshMatch = freshenBusMatch(rawMatch, selectedRoute?.name ?? '', selectedStopName, region, selectedRoute?.id);

  // 다중 차량 후보 picker — 출퇴근 시 같은 stop 근처 차량 2+ 발견 시. 사용자가
  // 카드 탭하면 그 vehId로 vote bucket 확정. 정류장 바뀌면 reset.
  const [pickedCandidate, setPickedCandidate] = useState<BusMatchCandidate | null>(null);
  useEffect(() => { setPickedCandidate(null); }, [selectedStopName, selectedRoute?.id]);

  // ── Timeline picker — 노선의 vehicle 전체를 시각적으로 노출. 정류장 이름 입력 우회 ──
  // 사용자가 자기 탑승 차량을 직접 클릭. 사용자 정책 (2026-05-28):
  // "정류장 이름 외우는 사람 없다. 시각적으로 보여주고 선택"
  const [vehicles, setVehicles] = useState<BusVehiclePosition[]>([]);
  const [vehiclesLoading, setVehiclesLoading] = useState(false);
  const [pickedTimelineVeh, setPickedTimelineVeh] = useState<BusVehiclePosition | null>(null);
  const vehiclesSeqRef = useRef(0);

  // 노선 확정 시 vehicles 로드. 노선 바뀌면 reset + refetch.
  useEffect(() => {
    if (!selectedRoute) { setVehicles([]); setPickedTimelineVeh(null); return; }
    const mySeq = ++vehiclesSeqRef.current;
    setVehiclesLoading(true); setPickedTimelineVeh(null);
    api.listBusRouteVehicles(selectedRoute.id, region).then((r) => {
      if (vehiclesSeqRef.current !== mySeq) return;
      setVehicles(r.vehicles ?? []);
      setVehiclesLoading(false);
    }).catch(() => {
      if (vehiclesSeqRef.current !== mySeq) return;
      setVehicles([]); setVehiclesLoading(false);
    });
  }, [selectedRoute, region]);

  // Timeline pick → phase='stops' + stopSel 자동 set. canSubmit 활성화 위해.
  useEffect(() => {
    if (!pickedTimelineVeh) return;
    const stopAt = stations.find((s) => s.seq === pickedTimelineVeh.stOrd);
    if (stopAt) {
      setStopSel(stopAt);
      setPhase('stops');
    }
  }, [pickedTimelineVeh, stations]);

  // dev/prod에서 picker UI 즉시 테스트용 — URL ?mock=multi-candidate-bus.
  const mockMatch = useMemo(() => {
    if (typeof window === 'undefined') return null;
    const mock = new URLSearchParams(window.location.search).get('mock');
    if (mock !== 'multi-candidate-bus' || !selectedRoute || !selectedStopName) return null;
    return {
      matched: false as const,
      reason: 'multi_candidate',
      routeId: selectedRoute.id, routeName: selectedRoute.name,
      currentStop: selectedStopName,
      candidates: [
        { vehId: 'V1', plainNo: '서울74사1234', stOrd: 10, stopFlag: '0', progress: 0.2, progressLabel: 'just-left' as const },
        { vehId: 'V2', plainNo: '서울74사5678', stOrd: 11, stopFlag: '0', progress: 0.85, progressLabel: 'approaching' as const },
        { vehId: 'V3', plainNo: '서울74사9012', stOrd: 11, stopFlag: '1', progress: 1, progressLabel: 'at-stop' as const },
      ],
      input: { routeName: selectedRoute.name, stopName: selectedStopName, region, routeId: selectedRoute.id },
    };
  }, [selectedRoute, selectedStopName, region]);

  // Effective match — picker로 사용자가 선택했으면 그 차량으로 confirmed match override.
  // mock query 있으면 raw 대신 mock 사용.
  const baseMatch = mockMatch ?? freshMatch;
  const matchAfterCandidate = pickedCandidate && baseMatch
    ? {
        ...baseMatch,
        matched: true,
        vehId: pickedCandidate.vehId,
        plainNo: pickedCandidate.plainNo,
        progress: pickedCandidate.progress,
        progressLabel: pickedCandidate.progressLabel,
        reason: undefined,
        candidates: undefined,
      }
    : baseMatch;
  // Timeline picker가 가장 우선 — 사용자가 자기 차량 직접 클릭.
  // 사용자가 명시적으로 픽한 거라 항상 'at-stop' 진행도로 표현.
  // matchAfterCandidate와 동일 shape 유지 (reason/candidates undefined) — TS union narrow.
  const vehicleMatch = pickedTimelineVeh
    ? {
        matched: true as const,
        vehId: pickedTimelineVeh.vehId,
        plainNo: pickedTimelineVeh.plainNo,
        routeId: selectedRoute?.id,
        routeName: selectedRoute?.name,
        currentStop: stations.find((s) => s.seq === pickedTimelineVeh.stOrd)?.name,
        nextStop: stations.find((s) => s.seq === pickedTimelineVeh.stOrd + 1)?.name,
        progress: 1 as number,
        progressLabel: 'at-stop' as const,
        reason: undefined,
        candidates: undefined,
      }
    : matchAfterCandidate;

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // ── Autocomplete (debounce 200ms) ────────────────────────────────
  useEffect(() => {
    if (phase !== 'number') return;
    const q = routeQuery.trim();
    if (!q) { setRouteCandidates([]); setRouteLoading(false); return; }
    const mySeq = ++routeSeqRef.current;
    setRouteLoading(true);
    const t = setTimeout(async () => {
      try {
        const res = await api.searchBusRoutes(q, region);
        if (routeSeqRef.current !== mySeq) return;
        setRouteCandidates(res.routes ?? []);
      } catch {
        if (routeSeqRef.current !== mySeq) return;
        setRouteCandidates([]);
      } finally {
        if (routeSeqRef.current === mySeq) setRouteLoading(false);
      }
    }, 200);
    return () => { clearTimeout(t); };
  }, [routeQuery, phase, region]);

  // ── 노선 선택 시 정류장 list 로드 ─────────────────────────────────
  // LLM P2: seq guard 추가 — 사용자가 빠르게 다른 노선 선택하면 옛 응답이
  // 새 stations를 덮어쓰는 race. mySeq로 in-flight 무효화.
  const stationsSeqRef = useRef(0);
  const pickRoute = useCallback(async (r: BusRouteCandidate) => {
    const mySeq = ++stationsSeqRef.current;
    setSelectedRoute(r);
    setPhase('route-confirmed');
    setStopSel(null); setStopSearch('');
    setStationsLoading(true); setStationsErr(null);
    try {
      const res = await api.listBusRouteStations(r.id, region);
      if (stationsSeqRef.current !== mySeq) return; // stale — 다른 pick 진행 중.
      setStations(res.stations ?? []);
      if (res.reason) setStationsErr(res.reason);
    } catch (e) {
      if (stationsSeqRef.current !== mySeq) return;
      setStations([]);
      setStationsErr((e as Error).message);
    } finally {
      if (stationsSeqRef.current === mySeq) setStationsLoading(false);
    }
  }, [region]);

  // ── GPS 요청 ──────────────────────────────────────────────────────
  const requestGps = useCallback(() => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      setGps('unsupported'); setPhase('stops'); return;
    }
    setGps('pending');
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude, accuracyM: pos.coords.accuracy });
        setGps('granted'); setPhase('stops');
      },
      () => { setGps('denied'); setPhase('stops'); },
      { enableHighAccuracy: false, timeout: 8000, maximumAge: 60_000 },
    );
  }, []);

  const skipGps = useCallback(() => { setGps('denied'); setPhase('stops'); }, []);

  // ── 정류장 선택 후 차량 매칭 자동 trigger ─────────────────────────
  useEffect(() => {
    if (!selectedRoute || !stopSel || !('name' in stopSel)) return;
    tryMatch({
      routeName: selectedRoute.name,
      stopName: stopSel.name,
      region,
      routeId: selectedRoute.id,
    });
  }, [selectedRoute, stopSel, tryMatch, region]);

  const resetToNumber = useCallback(() => {
    setPhase('number');
    setSelectedRoute(null);
    setStations([]); setStopSel(null); setStopSearch('');
    setGps('idle'); setCoords(null);
    resetMatch();
  }, [resetMatch]);

  // region 수동 변경 — 진행 중 모든 state 초기화 (이전 region의 routeId가 무효).
  const changeRegion = useCallback((next: Region) => {
    setRegion(next);
    const label = next === 'seoul'
      ? '서울특별시'
      : CITY_CODES.find((c) => String(c.code) === next)?.name ?? next;
    setRegionLabel(label);
    resetToNumber();
    setRouteQuery(''); setRouteCandidates([]);
  }, [resetToNumber]);

  // ── Submit ────────────────────────────────────────────────────────
  const canSubmit = phase === 'stops' && !!selectedRoute && !!stopSel && !submitting && !matchLoading;
  const submit = async () => {
    if (!selectedRoute) return;
    setSubmitting(true); setError(null);
    try {
      const routeName = selectedRoute.name;
      const stopName = stopSel && 'name' in stopSel ? stopSel.name : '';
      const payload = buildBusPlace({
        routeName, stopName, match: vehicleMatch,
        region, routeId: selectedRoute.id,
      });
      await api.upsertPlace(payload);
      onPicked(payload.id);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSubmitting(false);
    }
  };

  // ── CTA copy ──────────────────────────────────────────────────────
  const ctaLabel = (() => {
    if (submitting) return '이동 중…';
    if (phase === 'number') return routeQuery.trim() ? '버스를 선택해주세요' : '번호를 입력해주세요';
    if (phase === 'route-confirmed') return '정류장을 선택해주세요';
    if (stopSel && 'unknown' in stopSel) return `${selectedRoute?.name}번 노선으로 투표하기`;
    if (stopSel && 'name' in stopSel) return `${stopSel.name}에서 투표하기`;
    return '정류장을 선택해주세요';
  })();

  // ── Render ────────────────────────────────────────────────────────
  const typeColor = selectedRoute ? busColor(selectedRoute.typeLabel) : TOKEN.cold;

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', background: TOKEN.bg, fontFamily: FONT }}>
      <WizardHeader title="버스" onBack={onBack} />

      {/* Region inline picker — 헤더 바로 아래, Step 1 위. GPS로 자동 추론된 값 + native select. */}
      <RegionPicker
        region={region}
        label={regionLabel}
        detecting={regionDetecting}
        onChange={changeRegion}
        onUseGps={detectRegionByGps}
      />

      <div style={{ flex: 1, overflowY: 'auto', padding: '14px 0 24px' }}>
        {phase === 'number' && (
          <NumberStep
            query={routeQuery}
            setQuery={setRouteQuery}
            candidates={routeCandidates}
            loading={routeLoading}
            onPick={pickRoute}
          />
        )}

        {phase !== 'number' && selectedRoute && (
          <>
            <div style={{ padding: '0 16px', marginBottom: 14 }}>
              <ConfirmedBusChip
                route={selectedRoute}
                typeColor={typeColor}
                onEdit={resetToNumber}
              />
            </div>
            <BusConfirmCard
              route={selectedRoute}
              typeColor={typeColor}
              stopName={stopSel && 'name' in stopSel ? stopSel.name : null}
              confirmed={!!vehicleMatch?.matched}
              progress={vehicleMatch?.matched ? vehicleMatch.progress : null}
              vehPlainNo={vehicleMatch?.matched ? vehicleMatch.plainNo : null}
            />
            <div style={{ height: 12 }} />

            {/* ★ Timeline picker — 노선 정류장 + vehicle 시각화. 사용자가 자기 버스 직접 클릭.
                "정류장 이름 외우는 사람 없다" 정책에 따라 정류장 텍스트 입력 우회. */}
            {stations.length > 0 && (
              <div style={{ padding: '0 16px', marginBottom: 12 }}>
                <div style={{ fontSize: 12, color: TOKEN.text2, fontWeight: 700, marginBottom: 8, letterSpacing: '0.3px' }}>
                  내가 탄 버스를 골라주세요
                  {vehiclesLoading && <span style={{ fontWeight: 400, color: TOKEN.text3, marginLeft: 6 }}>· 위치 갱신 중…</span>}
                </div>
                <RouteTimeline
                  stations={stations}
                  vehicles={vehicles}
                  selectedVehId={pickedTimelineVeh?.vehId ?? null}
                  onPickVehicle={setPickedTimelineVeh}
                  userLatLng={coords ? { lat: coords.lat, lng: coords.lng } : null}
                />
              </div>
            )}

            {/* 다중 후보 picker — backend에서 multi_candidate 반환 시 */}
            {vehicleMatch?.reason === 'multi_candidate' && (vehicleMatch.candidates?.length ?? 0) >= 2 && (
              <BusCandidatePicker
                typeColor={typeColor}
                currentStop={vehicleMatch.currentStop ?? selectedStopName}
                candidates={vehicleMatch.candidates!}
                onPick={setPickedCandidate}
              />
            )}

            {/* reason 분기 메시지 — 사용자에게 명확한 안내 */}
            {vehicleMatch && !vehicleMatch.matched && vehicleMatch.reason && vehicleMatch.reason !== 'multi_candidate' && (
              <BusReasonNote reason={vehicleMatch.reason} typeColor={typeColor} />
            )}

            <div style={{ height: 8 }} />

            {phase === 'route-confirmed' && (
              <GpsRequestCard
                pending={gps === 'pending'}
                onAllow={requestGps}
                onSkip={skipGps}
              />
            )}

            {phase === 'stops' && (
              <StopPicker
                stations={stations}
                loading={stationsLoading}
                err={stationsErr}
                gps={gps}
                coords={coords}
                typeColor={typeColor}
                search={stopSearch}
                setSearch={setStopSearch}
                selectedStop={stopSel}
                onPick={setStopSel}
              />
            )}
          </>
        )}

        {error && (
          <div style={{ margin: '12px 16px 0', padding: 10, background: TOKEN.hotBg, color: TOKEN.hot, borderRadius: TOKEN.r.md, fontSize: 12 }}>
            {error}
          </div>
        )}
      </div>

      {/* Bottom CTA */}
      <div style={{ padding: '0 16px 24px', flexShrink: 0 }}>
        <button
          onClick={submit}
          disabled={!canSubmit}
          style={{
            width: '100%', padding: '17px 0',
            background: canSubmit ? TOKEN.cold : '#CDD2DA',
            color: canSubmit ? '#fff' : '#A0A8B3',
            border: 'none', borderRadius: 16, fontSize: 16, fontWeight: 700,
            cursor: canSubmit ? 'pointer' : 'default', fontFamily: FONT,
            boxShadow: canSubmit ? `0 6px 24px ${TOKEN.cold}40` : 'none',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
          }}
        >
          {ctaLabel}
          {canSubmit && <ArrowRight color="#fff" size={18} />}
        </button>
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════
// Region inline picker — GPS 자동 추론 + native <select> 변경.
// 광역시 9개 (서울 + TAGO 8개) + 경기/강원/충북/충남/전북/전남/경북/경남 시·군 130개.
// 138개 정도라 native select가 가장 가벼움. group으로 보기 좋게.
// ════════════════════════════════════════════════════════════════════

function RegionPicker({
  region, label, detecting, onChange, onUseGps,
}: {
  region: Region;
  label: string;
  detecting: boolean;
  onChange: (next: Region) => void;
  onUseGps: () => void;
}) {
  // 광역시 (서울 + TAGO 광역시 cityCode 코드값) + 시·군 prefix 기준 그룹 분류.
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
        {/* dropdown 화살표 */}
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

// ════════════════════════════════════════════════════════════════════
// ICONS — 디자인 시안 inline SVG
// ════════════════════════════════════════════════════════════════════

function ArrowRight({ color = TOKEN.text3, size = 16 }: { color?: string; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="M5 12h14M13 6l6 6-6 6" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
function CheckIcon({ color = TOKEN.ok, size = 15 }: { color?: string; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="M4.5 12.5l5 5L19.5 7" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
function SearchIcon({ size = 16, color = TOKEN.text3 }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle cx="11" cy="11" r="8" stroke={color} strokeWidth="2" />
      <path d="M21 21l-4.35-4.35" stroke={color} strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}
function GpsIcon({ size = 22, color = '#fff' }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle cx="12" cy="12" r="8" stroke={color} strokeWidth="1.8" />
      <circle cx="12" cy="12" r="3" fill={color} />
      <line x1="12" y1="2" x2="12" y2="5" stroke={color} strokeWidth="1.8" strokeLinecap="round" />
      <line x1="12" y1="19" x2="12" y2="22" stroke={color} strokeWidth="1.8" strokeLinecap="round" />
      <line x1="2" y1="12" x2="5" y2="12" stroke={color} strokeWidth="1.8" strokeLinecap="round" />
      <line x1="19" y1="12" x2="22" y2="12" stroke={color} strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}
function MapPinIcon({ size = 14, color = TOKEN.text3 }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="M12 21C12 21 5 14 5 9a7 7 0 1114 0c0 5-7 12-7 12z" stroke={color} strokeWidth="1.8" />
      <circle cx="12" cy="9" r="2.5" fill={color} />
    </svg>
  );
}
function BusGlyph({ size = 22, color = '#fff' }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden>
      <rect x="2" y="5" width="20" height="13" rx="2.5" stroke={color} strokeWidth="1.8" />
      <line x1="2" y1="9" x2="22" y2="9" stroke={color} strokeWidth="1.8" />
      <circle cx="6.5" cy="20" r="2" stroke={color} strokeWidth="1.6" />
      <circle cx="17.5" cy="20" r="2" stroke={color} strokeWidth="1.6" />
      <line x1="6.5" y1="18" x2="6.5" y2="13" stroke={color} strokeWidth="1.6" strokeLinecap="round" />
      <line x1="17.5" y1="18" x2="17.5" y2="13" stroke={color} strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

// ════════════════════════════════════════════════════════════════════
// STEP 1: 번호 입력 + autocomplete
// ════════════════════════════════════════════════════════════════════

function NumberStep({
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

// ════════════════════════════════════════════════════════════════════
// STEP 2: 노선 확정 후 — chip + BusConfirmCard + (GPS 권한 카드)
// ════════════════════════════════════════════════════════════════════

function ConfirmedBusChip({
  route, typeColor, onEdit,
}: {
  route: BusRouteCandidate;
  typeColor: string;
  onEdit: () => void;
}) {
  return (
    <div
      style={{
        background: TOKEN.surface, borderRadius: 14, padding: '12px 16px',
        display: 'flex', alignItems: 'center', gap: 10,
        border: `1.5px solid ${TOKEN.border}`,
        boxShadow: '0 1px 5px rgba(0,0,0,0.05)',
      }}
    >
      <BusBadge label={route.typeLabel} color={typeColor} size="sm" />
      <span style={{ fontSize: 17, fontWeight: 900, color: TOKEN.text1, letterSpacing: '-0.4px', flexShrink: 0 }}>
        {route.name}번
      </span>
      <span style={{ fontSize: 12, color: TOKEN.text2, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {route.startStop}→{route.endStop}
      </span>
      <CheckIcon color={TOKEN.ok} size={15} />
      <div style={{ width: 1, height: 14, background: TOKEN.border, margin: '0 4px' }} aria-hidden />
      <button
        onClick={onEdit}
        style={{ fontSize: 12, color: TOKEN.text3, background: 'none', border: 'none', cursor: 'pointer', fontFamily: FONT, padding: 0 }}
      >
        수정
      </button>
    </div>
  );
}

function BusConfirmCard({
  route, typeColor, stopName, confirmed, progress, vehPlainNo,
}: {
  route: BusRouteCandidate;
  typeColor: string;
  stopName: string | null;
  confirmed: boolean;
  progress?: number | null;
  vehPlainNo?: string | null;
}) {
  return (
    <div style={{ margin: '0 16px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
        <div style={{ width: 6, height: 6, borderRadius: '50%', background: confirmed ? TOKEN.ok : typeColor }} />
        <span style={{ fontSize: 11, fontWeight: 700, color: confirmed ? TOKEN.ok : typeColor, letterSpacing: '0.3px' }}>
          {confirmed ? '버스 확인됨' : '버스 노선 확정됨'}
        </span>
        {confirmed && <CheckIcon color={TOKEN.ok} size={13} />}
      </div>
      <div
        style={{
          background: TOKEN.surface, borderRadius: 18, overflow: 'hidden',
          border: `1.5px solid ${confirmed ? TOKEN.ok + '30' : 'transparent'}`,
          boxShadow: confirmed ? '0 2px 12px rgba(0,0,0,0.07)' : '0 6px 28px rgba(0,0,0,0.10)',
        }}
      >
        <div style={{ height: 4, background: typeColor }} />
        <div style={{ padding: '18px 18px 18px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 14 }}>
            <div
              style={{
                width: 44, height: 44, borderRadius: 12, background: typeColor, flexShrink: 0,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                boxShadow: `0 4px 14px ${typeColor}50`,
              }}
            >
              <BusGlyph size={22} color="#fff" />
            </div>
            <div style={{ minWidth: 0, flex: 1 }}>
              <div style={{ fontSize: 22, fontWeight: 900, color: TOKEN.text1, letterSpacing: '-0.5px', lineHeight: 1.2 }}>
                {route.name}번
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginTop: 3, flexWrap: 'wrap' }}>
                <span style={{ fontSize: 12, color: TOKEN.text2 }}>{route.startStop} → {route.endStop} 방향</span>
                <span style={{ color: TOKEN.border }}>·</span>
                <BusBadge label={route.typeLabel} color={typeColor} size="sm" />
              </div>
            </div>
          </div>

          {/* Route mini-viz: 시점 · (현재정류장) · 종점 */}
          <div style={{ background: TOKEN.bg, borderRadius: 10, padding: '11px 14px' }}>
            <div style={{ display: 'flex', alignItems: 'center', marginBottom: 5 }}>
              <div style={{ width: 9, height: 9, borderRadius: '50%', background: typeColor, flexShrink: 0 }} aria-hidden />
              <div style={{ flex: 1, height: 2, background: typeColor, opacity: 0.2 }} aria-hidden />
              {stopName && (
                <>
                  <div style={{ width: 9, height: 9, borderRadius: '50%', background: TOKEN.cold, flexShrink: 0, boxShadow: `0 2px 6px ${TOKEN.cold}55` }} aria-hidden />
                  <div style={{ flex: 1, height: 2, background: typeColor, opacity: 0.1 }} aria-hidden />
                </>
              )}
              <div style={{ width: 9, height: 9, borderRadius: '50%', background: typeColor, opacity: 0.38, flexShrink: 0 }} aria-hidden />
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: 12, fontWeight: 700, color: TOKEN.text1 }}>{route.startStop}</span>
              {stopName && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  <div style={{ width: 5, height: 5, borderRadius: '50%', background: TOKEN.cold }} aria-hidden />
                  <span style={{ fontSize: 10, color: TOKEN.cold, fontWeight: 600 }}>{stopName}</span>
                </div>
              )}
              <span style={{ fontSize: 12, fontWeight: 700, color: TOKEN.text2, opacity: 0.5 }}>{route.endStop}</span>
            </div>
          </div>

          {confirmed && (
            <>
              <div style={{ marginTop: 14, display: 'flex', alignItems: 'center', gap: 6 }}>
                <CheckIcon color={TOKEN.ok} size={14} />
                <span style={{ fontSize: 12, color: TOKEN.ok, fontWeight: 600 }}>버스가 확인됐어요</span>
                {vehPlainNo && (
                  <>
                    <span style={{ color: TOKEN.border }}>·</span>
                    <span style={{ fontSize: 12, color: TOKEN.text2 }}>{vehPlainNo}</span>
                  </>
                )}
              </div>
              {/* 차량 진행도 mini bar — progress 있을 때만 */}
              {typeof progress === 'number' && (
                <BusProgressInline color={typeColor} progress={progress} stopName={stopName} />
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// BusConfirmCard 내부 진행도 bar — 막 출발 → 진입 → 도착 표시.
function BusProgressInline({ color, progress, stopName }: { color: string; progress: number; stopName: string | null }) {
  const pct = Math.max(0, Math.min(1, progress)) * 100;
  const label = progress >= 0.95 ? '도착' : progress >= 0.6 ? '진입 중' : progress >= 0.3 ? '접근 중' : '막 출발';
  return (
    <div style={{ marginTop: 10 }}>
      <div style={{ position: 'relative', height: 6, background: TOKEN.bg, borderRadius: 3 }}>
        <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: `${pct}%`, background: color, borderRadius: 3, transition: 'width 240ms' }} />
        <div
          style={{
            position: 'absolute', left: `${pct}%`, top: -5,
            transform: 'translateX(-50%)',
            pointerEvents: 'none', filter: 'drop-shadow(0 1px 2px rgba(0,0,0,0.18))',
          }}
        >
          <MiniBusIcon color={color} />
        </div>
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 6 }}>
        <span style={{ fontSize: 10, color: TOKEN.text3 }}>이전 정류장</span>
        <span style={{ fontSize: 10, color, fontWeight: 700 }}>{label}</span>
        <span style={{ fontSize: 10, color: TOKEN.text3, maxWidth: '40%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{stopName ?? '정류장'}</span>
      </div>
    </div>
  );
}

// 작은 SVG 버스 — MiniTrain 같은 시각 weight, 버스는 가로형 + 두 바퀴 + 윈도우.
function MiniBusIcon({ color }: { color: string }) {
  return (
    <svg width={28} height={14} viewBox="0 0 28 14" style={{ display: 'block' }} aria-hidden>
      <rect x="1" y="2" width="22" height="9" rx="2" fill={color} />
      <rect x="3" y="3.5" width="4" height="4" rx="0.6" fill="rgba(255,255,255,0.55)" />
      <rect x="8.5" y="3.5" width="4" height="4" rx="0.6" fill="rgba(255,255,255,0.55)" />
      <rect x="14" y="3.5" width="4" height="4" rx="0.6" fill="rgba(255,255,255,0.55)" />
      <rect x="19.5" y="3" width="3" height="6" rx="0.8" fill="rgba(255,255,255,0.3)" />
      <circle cx="6" cy="12" r="1.5" fill={color} />
      <circle cx="18" cy="12" r="1.5" fill={color} />
    </svg>
  );
}

// 다중 차량 후보 picker — 지하철 CandidatePicker와 같은 패턴. 시안 디자인 적용.
function BusCandidatePicker({
  typeColor, currentStop, candidates, onPick,
}: {
  typeColor: string;
  currentStop: string;
  candidates: BusMatchCandidate[];
  onPick: (c: BusMatchCandidate) => void;
}) {
  return (
    <div style={{ margin: '0 16px 12px' }}>
      {/* 헤더 라벨 */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
        <div style={{ width: 6, height: 6, borderRadius: '50%', background: typeColor }} />
        <span style={{ fontSize: 11, fontWeight: 700, color: typeColor, letterSpacing: '0.3px' }}>
          어느 차량에 타고 계세요?
        </span>
      </div>
      {/* 안내 카드 */}
      <div style={{ background: TOKEN.coldBg, borderRadius: TOKEN.r.md, padding: '12px 14px', marginBottom: 10, display: 'flex', alignItems: 'flex-start', gap: 8 }}>
        <div style={{ width: 6, height: 6, borderRadius: '50%', background: TOKEN.cold, marginTop: 6, flexShrink: 0 }} aria-hidden />
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: TOKEN.text1, letterSpacing: '-0.2px', marginBottom: 2 }}>
            {currentStop} 근처에 차량 {candidates.length}대 운행 중이에요
          </div>
          <div style={{ fontSize: 11, color: TOKEN.text2, lineHeight: 1.5 }}>
            내가 탄 차량의 위치와 가장 비슷한 걸 탭해주세요
          </div>
        </div>
      </div>
      {/* 후보 카드 list */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {candidates.map((c) => {
          const label =
            c.progressLabel === 'at-stop' ? '도착'
            : c.progressLabel === 'approaching' ? '진입 중'
            : c.progressLabel === 'just-left' ? '막 출발'
            : '접근 중';
          return (
            <button
              key={c.vehId}
              onClick={() => onPick(c)}
              style={{
                width: '100%', textAlign: 'left', background: TOKEN.surface,
                border: `1px solid ${TOKEN.border}`, borderRadius: TOKEN.r.md,
                padding: '12px 14px', cursor: 'pointer', fontFamily: FONT,
                boxShadow: '0 1px 5px rgba(0,0,0,0.04)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                <span style={{ fontSize: 10, fontWeight: 700, color: '#fff', background: typeColor, padding: '2px 8px', borderRadius: 6 }}>BUS</span>
                <span style={{ fontSize: 14, fontWeight: 700, color: TOKEN.text1, letterSpacing: '-0.2px' }}>{c.plainNo}</span>
                <span style={{ fontSize: 11, color: TOKEN.text3 }}>·</span>
                <span style={{ fontSize: 12, color: TOKEN.text2 }}>{label}</span>
              </div>
              <BusProgressInline color={typeColor} progress={c.progress ?? 0.5} stopName={currentStop} />
            </button>
          );
        })}
      </div>
    </div>
  );
}

// 단일 매칭 실패 reason 분기 메시지.
function BusReasonNote({ reason, typeColor }: { reason: string; typeColor: string }) {
  const text =
    reason === 'no_vehicle_at_stop' ? '지금 이 정류장 근처에 운행 중인 차량이 없어요. 잠시 후 다시 확인하거나 정류장 단위로 투표하세요.'
    : reason === 'route_or_stop_not_found' ? '노선 또는 정류장 매칭에 실패했어요. 정류장 이름이 정확한지 확인해주세요.'
    : reason === 'no_api_key' ? '실시간 차량 정보를 가져올 수 없어요 (서버 설정).'
    : `매칭 실패: ${reason}`;
  return (
    <div style={{ margin: '0 16px 12px' }}>
      <div
        style={{
          background: TOKEN.surface, borderRadius: TOKEN.r.md, padding: '12px 14px',
          border: `1px solid ${TOKEN.border}`,
          display: 'flex', alignItems: 'flex-start', gap: 8,
        }}
      >
        <div style={{ width: 6, height: 6, borderRadius: '50%', background: typeColor, marginTop: 6, flexShrink: 0 }} aria-hidden />
        <div style={{ flex: 1, fontSize: 12, color: TOKEN.text2, lineHeight: 1.5 }}>{text}</div>
      </div>
    </div>
  );
}

function GpsRequestCard({
  pending, onAllow, onSkip,
}: {
  pending: boolean;
  onAllow: () => void;
  onSkip: () => void;
}) {
  return (
    <div style={{ margin: '0 16px' }}>
      <div
        style={{
          background: TOKEN.surface, borderRadius: 18, padding: 18,
          border: `1.5px solid ${TOKEN.cold}1A`,
          boxShadow: '0 4px 24px rgba(27,83,229,0.09)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 13, marginBottom: 14 }}>
          <div
            style={{
              width: 44, height: 44, borderRadius: '50%', background: TOKEN.cold, flexShrink: 0,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: `0 4px 16px ${TOKEN.cold}35`,
            }}
          >
            <GpsIcon size={20} color="#fff" />
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 15, fontWeight: 700, color: TOKEN.text1, marginBottom: 3, letterSpacing: '-0.3px' }}>
              지나는 정류장을 찾아드릴까요?
            </div>
            <div style={{ fontSize: 12, color: TOKEN.text2, lineHeight: 1.55 }}>
              현재 위치로 이 노선의 정류장을<br />자동으로 추천해드려요
            </div>
            <div style={{ fontSize: 11, color: TOKEN.text3, marginTop: 5 }}>위치는 서버에 저장되지 않아요</div>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            onClick={onAllow}
            disabled={pending}
            style={{
              flex: 3, padding: '13px 0',
              background: pending ? TOKEN.coldBg : TOKEN.cold,
              color: pending ? TOKEN.cold : '#fff',
              border: 'none', borderRadius: 12, fontSize: 13, fontWeight: 700,
              cursor: pending ? 'default' : 'pointer', fontFamily: FONT,
              boxShadow: pending ? 'none' : `0 4px 14px ${TOKEN.cold}40`,
            }}
          >
            {pending ? '위치 확인 중…' : '위치 허용하기'}
          </button>
          <button
            onClick={onSkip}
            style={{
              flex: 2, padding: '13px 0', background: TOKEN.bg, color: TOKEN.text2,
              border: `1px solid ${TOKEN.border}`, borderRadius: 12, fontSize: 12,
              cursor: 'pointer', fontFamily: FONT,
            }}
          >
            직접 찾을게요
          </button>
        </div>
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════
// STEP 3: 정류장 선택 — GPS 분기 + 모름 옵션
// ════════════════════════════════════════════════════════════════════

function StopPicker({
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
