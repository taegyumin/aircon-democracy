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
import { StopPicker } from './StopPicker';
import { RegionPicker } from './RegionPicker';
import { NumberStep } from './NumberStep';
import { ConfirmedBusChip, BusConfirmCard } from './BusConfirmCard';
import { BusCandidatePicker, BusReasonNote } from './BusCandidatePicker';
import { GpsRequestCard } from './GpsRequestCard';
import { ArrowRight } from './icons';
import type { BusVehiclePosition, BusMatchResult } from '@aircon/core';

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
          if (res.region) setRegion(res.region);
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
  // satisfies BusMatchResult로 contract 보증. reason/candidates는 undefined로 명시 —
  // matchAfterCandidate union과 동일 shape 유지해 narrowing 안 깨지게.
  const vehicleMatch = pickedTimelineVeh
    ? ({
        matched: true,
        vehId: pickedTimelineVeh.vehId,
        plainNo: pickedTimelineVeh.plainNo,
        routeId: selectedRoute?.id,
        routeName: selectedRoute?.name,
        currentStop: stations.find((s) => s.seq === pickedTimelineVeh.stOrd)?.name,
        nextStop: stations.find((s) => s.seq === pickedTimelineVeh.stOrd + 1)?.name,
        progress: 1,
        progressLabel: 'at-stop',
        reason: undefined,
        candidates: undefined,
      } satisfies BusMatchResult)
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

