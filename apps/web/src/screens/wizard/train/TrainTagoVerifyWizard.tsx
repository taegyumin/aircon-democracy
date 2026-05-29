'use client';

// 간선철도 (KTX·SRT·ITX·새마을·무궁화·누리로 …) 좌석권 검증 wizard.
// TAGO TrainInfo의 시각표로 사용자 입력 차량이 운행 중인지 검증 → placeId 발급.
// 매칭 키: train:tago:{trainNo}:{runDt}:car{N}
//
// 사용자 정책 (2026-05-28): 차량 단위 식별은 사용자가 좌석권에서 직접 본 정보로만.
// 시간표 보간 추정으로 trainNo를 시스템이 부여하면 일관성 깨짐 (지방 도시철도 케이스).
// 간선철도는 좌석권에 trainNo + 호차가 명시되어 있어 사용자 입력만으로 안정 매칭.

import { useEffect, useMemo, useState } from 'react';
import { TOKEN, FONT, joinYmdHm, TRAIN_VERIFY_ERROR_COPY } from '@aircon/core';
import type { TrainVerifyResult } from '@aircon/core';
import { api } from '../../../lib/apiClient';
import { WizardHeader } from '../WizardHeader';
import { Label } from '../Label';
import { fieldStyle, primaryButtonStyle } from '../styles';
import { SimpleSuggestInput } from './SimpleSuggestInput';

// 전국 기차역 일괄 cache — TAGO TrainInfo의 cityCode 별 호출을 한꺼번에 fetch.
// 15개 cityCode × 평균 12개 역 = ~200건. 페이지 마운트 시 한 번. 키워드 검색은 frontend에서.
interface TrainStationCached {
  nodeId: string;
  nodeName: string;
  cityName: string;
}

interface Props {
  onBack: () => void;
  onPicked: (placeId: string) => void;
}

const CAR_OPTIONS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20];

function formatRunDt(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${y}${m}${dd}`;
}

function formatPlanTime(s: string | undefined): string {
  if (!s || s.length < 12) return '';
  // YYYYMMDDHHMI → HH:MI
  const hh = s.slice(8, 10);
  const mi = s.slice(10, 12);
  return `${hh}:${mi}`;
}

export function TrainTagoVerifyWizard({ onBack, onPicked }: Props) {
  // 전국 기차역 캐시 (페이지 마운트 시 일괄 fetch)
  const [allStations, setAllStations] = useState<TrainStationCached[]>([]);
  const [stationsLoading, setStationsLoading] = useState(true);

  // 출도착 입력 — 키워드 자동완성으로 선택. nodeId 저장하면 확정.
  const [depQuery, setDepQuery] = useState('');
  const [depPlaceId, setDepPlaceId] = useState<string>('');
  const [arrQuery, setArrQuery] = useState('');
  const [arrPlaceId, setArrPlaceId] = useState<string>('');

  // 좌석권 입력
  const [carOrdr, setCarOrdr] = useState<number | null>(null);
  const runDt = useMemo(() => formatRunDt(new Date()), []);
  const [depHour, setDepHour] = useState<string>('');
  const [depMin, setDepMin] = useState<string>('');

  // 검증 결과
  const [verifying, setVerifying] = useState(false);
  const [result, setResult] = useState<TrainVerifyResult | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 마운트 1회: cities 받고 → 각 city의 stations parallel fetch → flat cache.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { cities } = await api.listTrainCities();
        if (cancelled) return;
        const perCity = await Promise.all(
          cities.map(async (c) => {
            try {
              const { stations } = await api.listTrainStations(c.cityCode);
              return stations.map((s) => ({ nodeId: s.nodeId, nodeName: s.nodeName, cityName: c.cityName }));
            } catch { return []; }
          }),
        );
        if (cancelled) return;
        setAllStations(perCity.flat());
        setStationsLoading(false);
      } catch (e) {
        if (!cancelled) { setError((e as Error).message); setStationsLoading(false); }
      }
    })();
    return () => { cancelled = true; };
  }, []);

  // 키워드 → suggestion list. 정확 prefix 우선, includes 후순위. 8건 cap.
  function suggestStations(q: string): string[] {
    const t = q.trim();
    if (!t) return [];
    const lower = t.toLowerCase();
    const scored: { label: string; rank: number }[] = [];
    const seen = new Set<string>();
    for (const s of allStations) {
      const name = s.nodeName;
      const label = `${name} (${s.cityName})`;
      if (seen.has(label)) continue;
      const nameLower = name.toLowerCase();
      let rank = 99;
      if (name === t) rank = 0;
      else if (nameLower.startsWith(lower)) rank = 1;
      else if (nameLower.includes(lower)) rank = 2;
      if (rank < 99) { scored.push({ label, rank }); seen.add(label); }
    }
    scored.sort((a, b) => a.rank - b.rank);
    return scored.slice(0, 8).map((x) => x.label);
  }

  // setValue wrapper — 사용자가 suggestion 선택 시 label 형식 매칭해 nodeId 발급.
  // 사용자가 직접 타이핑하면 nodeId clear (정확 매칭 안 됐단 뜻).
  function handleDepChange(v: string) {
    setDepQuery(v);
    setResult(null);
    const m = /^(.+) \((.+)\)$/.exec(v);
    const hit = m ? allStations.find((s) => s.nodeName === m[1] && s.cityName === m[2]) : null;
    setDepPlaceId(hit?.nodeId ?? '');
  }
  function handleArrChange(v: string) {
    setArrQuery(v);
    setResult(null);
    const m = /^(.+) \((.+)\)$/.exec(v);
    const hit = m ? allStations.find((s) => s.nodeName === m[1] && s.cityName === m[2]) : null;
    setArrPlaceId(hit?.nodeId ?? '');
  }

  const depPlandTimeHHMI = useMemo(() => joinYmdHm(runDt, depHour, depMin), [runDt, depHour, depMin]);

  const canVerify = !!depPlaceId && !!arrPlaceId && depPlandTimeHHMI.length === 12 && !!carOrdr && !verifying;

  const verify = async () => {
    if (!canVerify || !carOrdr) return;
    setVerifying(true);
    setError(null);
    setResult(null);
    try {
      const r = await api.verifyTrain({
        depPlandTimeHHMI,
        runDt,
        depPlaceId,
        arrPlaceId,
        carOrdr,
      });
      setResult(r);
      if (!r.matched && r.reason) setError(r.reason);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setVerifying(false);
    }
  };

  const confirm = async () => {
    if (!result || !result.matched || !result.placeId) return;
    setSubmitting(true);
    try {
      await api.upsertPlace({
        id: result.placeId,
        name: `${result.vehicleKndNm ?? '열차'} ${result.trainNo} · ${result.carOrdr}호차`,
        type: 'train',
        detail: `${result.depPlaceNm}→${result.arrPlaceNm} · ${formatPlanTime(result.depPlandTime)} 출발`,
      });
      onPicked(result.placeId);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', background: TOKEN.bg, fontFamily: FONT }}>
      <WizardHeader title="기차" onBack={onBack} />
      <div style={{ flex: 1, overflowY: 'auto', padding: '20px 20px 80px' }}>
        <div style={{ marginBottom: 14, padding: 12, background: '#FEF3C7', borderRadius: TOKEN.r.md, fontSize: 12, color: '#92400E', lineHeight: 1.5 }}>
          좌석권에 적힌 정보로 차량을 식별합니다. 같은 차량 사용자끼리만 묶여요.
        </div>

        <Label>출발역 * <span style={{ fontWeight: 400, color: TOKEN.text3 }}>{stationsLoading ? '· 역 정보 로딩 중…' : ''}</span></Label>
        <div style={{ marginBottom: 22 }}>
          <SimpleSuggestInput
            value={depQuery}
            setValue={handleDepChange}
            placeholder="예: 서울, 용산, 부산"
            suggestions={suggestStations(depQuery)}
          />
        </div>

        <Label>도착역 *</Label>
        <div style={{ marginBottom: 22 }}>
          <SimpleSuggestInput
            value={arrQuery}
            setValue={handleArrChange}
            placeholder="예: 부산, 광주송정"
            suggestions={suggestStations(arrQuery)}
          />
        </div>

        <Label>출발 시각 * <span style={{ fontWeight: 400, color: TOKEN.text3 }}>(좌석권 상단)</span></Label>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 8px 1fr', alignItems: 'center', gap: 4, marginBottom: 22 }}>
          <input
            value={depHour}
            onChange={(e) => { setDepHour(e.target.value.replace(/[^0-9]/g, '').slice(0, 2)); setResult(null); }}
            placeholder="시 (예: 11)"
            inputMode="numeric"
            style={fieldStyle(!!depHour)}
          />
          <div style={{ textAlign: 'center', color: TOKEN.text3 }}>:</div>
          <input
            value={depMin}
            onChange={(e) => { setDepMin(e.target.value.replace(/[^0-9]/g, '').slice(0, 2)); setResult(null); }}
            placeholder="분 (예: 00)"
            inputMode="numeric"
            style={fieldStyle(!!depMin)}
          />
        </div>

        <Label>몇 호차예요? *</Label>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 6, marginBottom: 22 }}>
          {CAR_OPTIONS.map((n) => {
            const active = carOrdr === n;
            return (
              <button key={n} onClick={() => { setCarOrdr(active ? null : n); setResult(null); }} style={{
                padding: '12px 0',
                background: active ? TOKEN.cold : TOKEN.surface,
                color: active ? '#fff' : TOKEN.text1,
                border: `1.5px solid ${active ? TOKEN.cold : TOKEN.border}`,
                borderRadius: TOKEN.r.md, fontSize: 14, fontWeight: 800,
                cursor: 'pointer', fontFamily: FONT, fontVariantNumeric: 'tabular-nums',
              }}>{n}</button>
            );
          })}
        </div>

        {result && result.matched && (
          <div style={{ marginBottom: 14, padding: 14, background: TOKEN.coldBg, border: `1.5px solid ${TOKEN.cold}`, borderRadius: TOKEN.r.md }}>
            <div style={{ fontSize: 13, fontWeight: 800, color: TOKEN.cold, marginBottom: 4 }}>✓ {result.vehicleKndNm} {result.trainNo} · {result.carOrdr}호차</div>
            <div style={{ fontSize: 12, color: TOKEN.text2 }}>
              {result.depPlaceNm} {formatPlanTime(result.depPlandTime)} → {result.arrPlaceNm} {formatPlanTime(result.arrPlandTime)}
            </div>
          </div>
        )}

        {error && (
          <div style={{ marginBottom: 14, padding: 10, background: TOKEN.hotBg, color: TOKEN.hot, borderRadius: TOKEN.r.md, fontSize: 12 }}>
            {TRAIN_VERIFY_ERROR_COPY[error] ?? error}
          </div>
        )}

        <div style={{ height: 12 }} />
        {result?.matched ? (
          <button onClick={confirm} disabled={submitting} style={primaryButtonStyle(!submitting)}>
            {submitting ? '이동 중…' : '투표하러 가기'}
          </button>
        ) : (
          <button onClick={verify} disabled={!canVerify} style={primaryButtonStyle(canVerify)}>
            {verifying ? '확인 중…' : '운행 확인하기'}
          </button>
        )}
      </div>
    </div>
  );
}
