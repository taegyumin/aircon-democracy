'use client';

// 간선철도 (KTX·SRT·ITX·새마을·무궁화·누리로 …) 좌석권 검증 wizard.
// TAGO TrainInfo의 시각표로 사용자 입력 차량이 운행 중인지 검증 → placeId 발급.
// 매칭 키: train:tago:{trainNo}:{runDt}:car{N}
//
// 사용자 정책 (2026-05-28): 차량 단위 식별은 사용자가 좌석권에서 직접 본 정보로만.
// 시간표 보간 추정으로 trainNo를 시스템이 부여하면 일관성 깨짐 (지방 도시철도 케이스).
// 간선철도는 좌석권에 trainNo + 호차가 명시되어 있어 사용자 입력만으로 안정 매칭.

import { useEffect, useMemo, useState } from 'react';
import { TOKEN, FONT } from '@aircon/core';
import type { TrainCity, TrainStationApi, TrainVerifyResult } from '@aircon/core';
import { api } from '../../../lib/apiClient';
import { WizardHeader } from '../WizardHeader';
import { Label } from '../Label';
import { fieldStyle, primaryButtonStyle } from '../styles';

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
  // 1) 도시 → 역 로드 cascade
  const [cities, setCities] = useState<TrainCity[]>([]);
  const [depCity, setDepCity] = useState<string>(''); // cityCode
  const [arrCity, setArrCity] = useState<string>('');
  const [depStations, setDepStations] = useState<TrainStationApi[]>([]);
  const [arrStations, setArrStations] = useState<TrainStationApi[]>([]);
  const [depPlaceId, setDepPlaceId] = useState<string>('');
  const [arrPlaceId, setArrPlaceId] = useState<string>('');

  // 2) 좌석권 입력 — 시각만 (열차번호 외울 필요 X, backend 자동 매칭)
  const [carOrdr, setCarOrdr] = useState<number | null>(null);
  const todayStr = useMemo(() => formatRunDt(new Date()), []);
  const tomorrowStr = useMemo(() => {
    const t = new Date(); t.setDate(t.getDate() + 1); return formatRunDt(t);
  }, []);
  const [runDt, setRunDt] = useState<string>(todayStr);
  const [depHour, setDepHour] = useState<string>('');
  const [depMin, setDepMin] = useState<string>('');

  // 3) 검증 결과
  const [verifying, setVerifying] = useState(false);
  const [result, setResult] = useState<TrainVerifyResult | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 도시 list 한 번 로드
  useEffect(() => {
    let cancelled = false;
    api.listTrainCities().then((d) => {
      if (!cancelled) setCities(d.cities);
    }).catch((e: Error) => { if (!cancelled) setError(e.message); });
    return () => { cancelled = true; };
  }, []);

  // 출발 도시 변경 시 역 list 로드
  useEffect(() => {
    if (!depCity) { setDepStations([]); setDepPlaceId(''); return; }
    let cancelled = false;
    api.listTrainStations(depCity).then((d) => {
      if (!cancelled) { setDepStations(d.stations); setDepPlaceId(''); }
    }).catch((e: Error) => { if (!cancelled) setError(e.message); });
    return () => { cancelled = true; };
  }, [depCity]);

  // 도착 도시 변경 시 역 list 로드
  useEffect(() => {
    if (!arrCity) { setArrStations([]); setArrPlaceId(''); return; }
    let cancelled = false;
    api.listTrainStations(arrCity).then((d) => {
      if (!cancelled) { setArrStations(d.stations); setArrPlaceId(''); }
    }).catch((e: Error) => { if (!cancelled) setError(e.message); });
    return () => { cancelled = true; };
  }, [arrCity]);

  const depPlandTimeHHMI = useMemo(() => {
    if (!runDt || !depHour || !depMin) return '';
    return `${runDt}${depHour.padStart(2, '0')}${depMin.padStart(2, '0')}`;
  }, [runDt, depHour, depMin]);

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

        <Label>출발일</Label>
        <div style={{ display: 'flex', gap: 8, marginBottom: 22 }}>
          {[
            { value: todayStr, label: '오늘' },
            { value: tomorrowStr, label: '내일' },
          ].map(({ value, label }) => {
            const active = runDt === value;
            return (
              <button key={value} onClick={() => setRunDt(value)} style={{
                flex: 1, padding: '12px',
                background: active ? TOKEN.cold : TOKEN.surface,
                color: active ? '#fff' : TOKEN.text1,
                border: `1.5px solid ${active ? TOKEN.cold : TOKEN.border}`,
                borderRadius: TOKEN.r.md, fontSize: 14, fontWeight: 700,
                cursor: 'pointer', fontFamily: FONT,
              }}>{label}</button>
            );
          })}
        </div>

        <Label>출발역 *</Label>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 22 }}>
          <select value={depCity} onChange={(e) => setDepCity(e.target.value)} style={fieldStyle(!!depCity)}>
            <option value="">시·도 선택</option>
            {cities.map((c) => <option key={c.cityCode} value={c.cityCode}>{c.cityName}</option>)}
          </select>
          <select value={depPlaceId} onChange={(e) => setDepPlaceId(e.target.value)} disabled={!depCity} style={fieldStyle(!!depPlaceId)}>
            <option value="">역 선택</option>
            {depStations.map((s) => <option key={s.nodeId} value={s.nodeId}>{s.nodeName}</option>)}
          </select>
        </div>

        <Label>도착역 *</Label>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 22 }}>
          <select value={arrCity} onChange={(e) => setArrCity(e.target.value)} style={fieldStyle(!!arrCity)}>
            <option value="">시·도 선택</option>
            {cities.map((c) => <option key={c.cityCode} value={c.cityCode}>{c.cityName}</option>)}
          </select>
          <select value={arrPlaceId} onChange={(e) => setArrPlaceId(e.target.value)} disabled={!arrCity} style={fieldStyle(!!arrPlaceId)}>
            <option value="">역 선택</option>
            {arrStations.map((s) => <option key={s.nodeId} value={s.nodeId}>{s.nodeName}</option>)}
          </select>
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
            {error === 'not_found' && '해당 열차를 찾지 못했어요. 좌석권 다시 확인해주세요.'}
            {error === 'service_closed' && '해당 일자에 운행 정보가 없어요.'}
            {error !== 'not_found' && error !== 'service_closed' && error}
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
