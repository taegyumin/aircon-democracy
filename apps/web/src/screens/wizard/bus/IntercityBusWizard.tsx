'use client';

// 고속버스·시외버스 wizard. 좌석권 정보(출도착 터미널 + 정확 출발시각)로 TAGO 검증.
// kind 토글로 ExpBusInfo / SuburbsBusInfo 둘 다 cover.
// placeId = intercity-bus:{kind}:{routeId}:{depPlandTime}

import { useEffect, useMemo, useRef, useState } from 'react';
import { TOKEN, FONT, joinYmdHm, INTERCITY_BUS_VERIFY_ERROR_COPY } from '@aircon/core';
import type { IntercityBusTerminal, IntercityBusVerifyResult } from '@aircon/core';
import { api } from '../../../lib/apiClient';
import { WizardHeader } from '../WizardHeader';
import { Label } from '../Label';
import { fieldStyle, primaryButtonStyle } from '../styles';
import { SimpleSuggestInput } from '../train/SimpleSuggestInput';

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

  // 자동완성 — 사용자 키워드 → backend terminalNm 검색. 지하철·시내버스 패턴 통일.
  const [depQuery, setDepQuery] = useState('');
  const [depTerminalId, setDepTerminalId] = useState('');
  const [depSugg, setDepSugg] = useState<IntercityBusTerminal[]>([]);
  const [arrQuery, setArrQuery] = useState('');
  const [arrTerminalId, setArrTerminalId] = useState('');
  const [arrSugg, setArrSugg] = useState<IntercityBusTerminal[]>([]);
  const depSeq = useRef(0);
  const arrSeq = useRef(0);

  const runDt = useMemo(() => todayYmd(), []);
  const [depHour, setDepHour] = useState<string>('');
  const [depMin, setDepMin] = useState<string>('');

  const [verifying, setVerifying] = useState(false);
  const [result, setResult] = useState<IntercityBusVerifyResult | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // kind 변경 시 reset.
  useEffect(() => {
    setDepQuery(''); setArrQuery('');
    setDepTerminalId(''); setArrTerminalId('');
    setDepSugg([]); setArrSugg([]);
    setResult(null); setError(null);
  }, [kind]);

  // depQuery 키워드 검색 (debounce 200ms).
  useEffect(() => {
    const q = depQuery.trim();
    if (!q || depTerminalId) { setDepSugg([]); return; }
    const mySeq = ++depSeq.current;
    const t = setTimeout(async () => {
      try {
        const { terminals } = await api.listIntercityBusTerminals(kind, { terminalNm: q });
        if (depSeq.current === mySeq) setDepSugg(terminals.slice(0, 8));
      } catch {/* keep */}
    }, 200);
    return () => clearTimeout(t);
  }, [depQuery, kind, depTerminalId]);

  useEffect(() => {
    const q = arrQuery.trim();
    if (!q || arrTerminalId) { setArrSugg([]); return; }
    const mySeq = ++arrSeq.current;
    const t = setTimeout(async () => {
      try {
        const { terminals } = await api.listIntercityBusTerminals(kind, { terminalNm: q });
        if (arrSeq.current === mySeq) setArrSugg(terminals.slice(0, 8));
      } catch {/* keep */}
    }, 200);
    return () => clearTimeout(t);
  }, [arrQuery, kind, arrTerminalId]);

  // 사용자 suggestion 선택 — label 형식 매칭 후 terminalId 발급.
  function handleDepChange(v: string) {
    setDepQuery(v); setResult(null);
    const hit = depSugg.find((t) => `${t.terminalNm}${t.cityName ? ` (${t.cityName})` : ''}` === v);
    setDepTerminalId(hit?.terminalId ?? '');
  }
  function handleArrChange(v: string) {
    setArrQuery(v); setResult(null);
    const hit = arrSugg.find((t) => `${t.terminalNm}${t.cityName ? ` (${t.cityName})` : ''}` === v);
    setArrTerminalId(hit?.terminalId ?? '');
  }
  const depSuggestions = depSugg.map((t) => `${t.terminalNm}${t.cityName ? ` (${t.cityName})` : ''}`);
  const arrSuggestions = arrSugg.map((t) => `${t.terminalNm}${t.cityName ? ` (${t.cityName})` : ''}`);

  const depPlandTime = useMemo(() => joinYmdHm(runDt, depHour, depMin), [runDt, depHour, depMin]);

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
        <div style={{ marginBottom: 22 }}>
          <SimpleSuggestInput
            value={depQuery}
            setValue={handleDepChange}
            placeholder="예: 서울고속, 센트럴, 동서울"
            suggestions={depSuggestions}
          />
        </div>

        <Label>도착 터미널 *</Label>
        <div style={{ marginBottom: 22 }}>
          <SimpleSuggestInput
            value={arrQuery}
            setValue={handleArrChange}
            placeholder="예: 부산종합, 대전복합"
            suggestions={arrSuggestions}
          />
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
            {INTERCITY_BUS_VERIFY_ERROR_COPY[error] ?? error}
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
