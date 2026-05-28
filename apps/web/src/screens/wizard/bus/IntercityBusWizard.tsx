'use client';

// 고속버스·시외버스 wizard. 좌석권 정보(출도착 터미널 + 정확 출발시각)로 TAGO 검증.
// kind 토글로 ExpBusInfo / SuburbsBusInfo 둘 다 cover.
// placeId = intercity-bus:{kind}:{routeId}:{depPlandTime}

import { useEffect, useMemo, useState } from 'react';
import { TOKEN, FONT } from '@aircon/core';
import type { TrainCity, IntercityBusTerminal, IntercityBusVerifyResult } from '@aircon/core';
import { api } from '../../../lib/apiClient';
import { WizardHeader } from '../WizardHeader';
import { Label } from '../Label';
import { fieldStyle, primaryButtonStyle } from '../styles';

interface Props {
  onBack: () => void;
  onPicked: (placeId: string) => void;
}

type Kind = 'exp' | 'suburbs';

function todayYmd(): string {
  const d = new Date();
  return `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`;
}


function formatPlanTime(s: string | undefined): string {
  if (!s || s.length < 12) return '';
  return `${s.slice(8, 10)}:${s.slice(10, 12)}`;
}

export function IntercityBusWizard({ onBack, onPicked }: Props) {
  const [kind, setKind] = useState<Kind>('exp');

  const [cities, setCities] = useState<TrainCity[]>([]);
  const [depCity, setDepCity] = useState('');
  const [arrCity, setArrCity] = useState('');
  const [depTerminals, setDepTerminals] = useState<IntercityBusTerminal[]>([]);
  const [arrTerminals, setArrTerminals] = useState<IntercityBusTerminal[]>([]);
  const [depTerminalId, setDepTerminalId] = useState('');
  const [arrTerminalId, setArrTerminalId] = useState('');

  // 현재 탑승 차량 투표라 runDt = 오늘. 등급은 자동매칭에 거의 불필요 (다중 매칭 시
  // 사용자 picker로 추후 처리). 입력 부담 줄여 출도착 + 시각만으로 핵심 path.
  const runDt = useMemo(() => todayYmd(), []);
  const [depHour, setDepHour] = useState<string>('');
  const [depMin, setDepMin] = useState<string>('');

  const [verifying, setVerifying] = useState(false);
  const [result, setResult] = useState<IntercityBusVerifyResult | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // kind 변경 시 cities 다시 로드 (등급 미사용).
  useEffect(() => {
    setCities([]); setDepCity(''); setArrCity('');
    setResult(null); setError(null);
    let cancelled = false;
    api.listIntercityBusCities(kind).then((d) => { if (!cancelled) setCities(d.cities); }).catch((e: Error) => { if (!cancelled) setError(e.message); });
    return () => { cancelled = true; };
  }, [kind]);

  // 출발 도시 → 터미널 list
  useEffect(() => {
    if (!depCity) { setDepTerminals([]); setDepTerminalId(''); return; }
    let cancelled = false;
    api.listIntercityBusTerminals(kind, { cityCode: depCity }).then((d) => {
      if (!cancelled) { setDepTerminals(d.terminals); setDepTerminalId(''); }
    }).catch(() => {});
    return () => { cancelled = true; };
  }, [kind, depCity]);

  useEffect(() => {
    if (!arrCity) { setArrTerminals([]); setArrTerminalId(''); return; }
    let cancelled = false;
    api.listIntercityBusTerminals(kind, { cityCode: arrCity }).then((d) => {
      if (!cancelled) { setArrTerminals(d.terminals); setArrTerminalId(''); }
    }).catch(() => {});
    return () => { cancelled = true; };
  }, [kind, arrCity]);

  const depPlandTime = useMemo(() => {
    if (!runDt || !depHour || !depMin) return '';
    return `${runDt}${depHour.padStart(2, '0')}${depMin.padStart(2, '0')}`;
  }, [runDt, depHour, depMin]);

  const canVerify = !!depTerminalId && !!arrTerminalId && depPlandTime.length === 12 && !verifying;

  const verify = async () => {
    if (!canVerify) return;
    setVerifying(true); setError(null); setResult(null);
    try {
      const r = await api.verifyIntercityBus(kind, {
        depTerminalId, arrTerminalId, depPlandTime,
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
    if (!result?.matched || !result.placeId) return;
    setSubmitting(true);
    try {
      const kindLabel = result.kind === 'exp' ? '고속버스' : '시외버스';
      await api.upsertPlace({
        id: result.placeId,
        name: `${kindLabel} ${result.gradeNm ?? ''} · ${result.depPlaceNm}→${result.arrPlaceNm}`.trim(),
        type: 'bus',
        detail: `${formatPlanTime(result.depPlandTime)} 출발`,
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
      <WizardHeader title="고속·시외버스" onBack={onBack} />
      <div style={{ flex: 1, overflowY: 'auto', padding: '20px 20px 80px' }}>
        <div style={{ marginBottom: 14, padding: 12, background: '#FEF3C7', borderRadius: TOKEN.r.md, fontSize: 12, color: '#92400E', lineHeight: 1.5 }}>
          승차권에 적힌 정보로 차량을 식별합니다. 같은 차량 사용자끼리만 묶여요.
        </div>

        {/* Kind toggle */}
        <div style={{ display: 'flex', background: TOKEN.bg, border: `1px solid ${TOKEN.border}`, borderRadius: TOKEN.r.lg, padding: 4, marginBottom: 22 }}>
          {[
            { v: 'exp' as const, label: '고속버스' },
            { v: 'suburbs' as const, label: '시외버스' },
          ].map(({ v, label }) => {
            const active = kind === v;
            return (
              <button key={v} onClick={() => setKind(v)} style={{
                flex: 1, padding: '10px',
                background: active ? TOKEN.surface : 'transparent',
                border: 'none', borderRadius: TOKEN.r.md,
                fontSize: 13, fontWeight: 700,
                color: active ? TOKEN.text1 : TOKEN.text3,
                cursor: 'pointer', fontFamily: FONT,
                boxShadow: active ? '0 1px 3px rgba(0,0,0,0.06)' : 'none',
              }}>{label}</button>
            );
          })}
        </div>

        <Label>출발 터미널 *</Label>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 22 }}>
          <select value={depCity} onChange={(e) => setDepCity(e.target.value)} style={fieldStyle(!!depCity)}>
            <option value="">시·도 선택</option>
            {cities.map((c) => <option key={c.cityCode} value={c.cityCode}>{c.cityName}</option>)}
          </select>
          <select value={depTerminalId} onChange={(e) => setDepTerminalId(e.target.value)} disabled={!depCity} style={fieldStyle(!!depTerminalId)}>
            <option value="">터미널 선택</option>
            {depTerminals.map((t) => <option key={t.terminalId} value={t.terminalId}>{t.terminalNm}</option>)}
          </select>
        </div>

        <Label>도착 터미널 *</Label>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 22 }}>
          <select value={arrCity} onChange={(e) => setArrCity(e.target.value)} style={fieldStyle(!!arrCity)}>
            <option value="">시·도 선택</option>
            {cities.map((c) => <option key={c.cityCode} value={c.cityCode}>{c.cityName}</option>)}
          </select>
          <select value={arrTerminalId} onChange={(e) => setArrTerminalId(e.target.value)} disabled={!arrCity} style={fieldStyle(!!arrTerminalId)}>
            <option value="">터미널 선택</option>
            {arrTerminals.map((t) => <option key={t.terminalId} value={t.terminalId}>{t.terminalNm}</option>)}
          </select>
        </div>

        <Label>출발 시각 * <span style={{ fontWeight: 400, color: TOKEN.text3 }}>(승차권 정확히)</span></Label>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 8px 1fr', alignItems: 'center', gap: 4, marginBottom: 22 }}>
          <input
            value={depHour}
            onChange={(e) => { setDepHour(e.target.value.replace(/[^0-9]/g, '').slice(0, 2)); setResult(null); }}
            placeholder="시 (예: 14)"
            inputMode="numeric"
            style={fieldStyle(!!depHour)}
          />
          <div style={{ textAlign: 'center', color: TOKEN.text3 }}>:</div>
          <input
            value={depMin}
            onChange={(e) => { setDepMin(e.target.value.replace(/[^0-9]/g, '').slice(0, 2)); setResult(null); }}
            placeholder="분 (예: 30)"
            inputMode="numeric"
            style={fieldStyle(!!depMin)}
          />
        </div>

        {result?.matched && (
          <div style={{ marginBottom: 14, padding: 14, background: TOKEN.coldBg, border: `1.5px solid ${TOKEN.cold}`, borderRadius: TOKEN.r.md }}>
            <div style={{ fontSize: 13, fontWeight: 800, color: TOKEN.cold, marginBottom: 4 }}>
              ✓ {result.gradeNm} · {result.depPlaceNm}→{result.arrPlaceNm}
            </div>
            <div style={{ fontSize: 12, color: TOKEN.text2 }}>
              {formatPlanTime(result.depPlandTime)} 출발 → {formatPlanTime(result.arrPlandTime)} 도착
            </div>
          </div>
        )}

        {error && (
          <div style={{ marginBottom: 14, padding: 10, background: TOKEN.hotBg, color: TOKEN.hot, borderRadius: TOKEN.r.md, fontSize: 12 }}>
            {error === 'not_found' && '해당 시각 출발 버스를 찾지 못했어요. 승차권 다시 확인해주세요.'}
            {error === 'service_closed' && '해당 노선·날짜에 운행 정보가 없어요.'}
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
