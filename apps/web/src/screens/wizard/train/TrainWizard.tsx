'use client';

// 기차 (KTX/SRT/무궁화호/ITX/누리로) wizard.
// 두 가지 경로:
//   1. prev+next 역 입력 → findTrainSegments로 노선 자동 매칭 (segment-precise)
//   2. 그냥 열차 종류 + (선택) 행선지 + 호차 입력 (type-based fallback)

import { useMemo, useState } from 'react';
import { TOKEN, FONT, findTrainSegments, searchTrainStations, STATIONS } from '@aircon/core';
import { api } from '../../../lib/apiClient';
import { WizardHeader } from '../WizardHeader';
import { Label } from '../Label';
import { fieldStyle, primaryButtonStyle } from '../styles';
import { SimpleSuggestInput } from './SimpleSuggestInput';
import { buildTrainPlace } from './buildTrainPlace';

const TRAIN_TYPES = ['KTX', 'SRT', 'ITX-새마을', 'ITX-마음', '무궁화호', '누리로'] as const;
type TrainType = (typeof TRAIN_TYPES)[number];
const TRAIN_CAR_OPTIONS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20];

interface Props {
  onBack: () => void;
  onPicked: (placeId: string) => void;
}

export function TrainWizard({ onBack, onPicked }: Props) {
  const [trainType, setTrainType] = useState<TrainType | null>(null);
  const [trainCar, setTrainCar] = useState<number | 'unknown' | null>(null);
  const [trainDest, setTrainDest] = useState('');
  const [prevQuery, setPrevQuery] = useState('');
  const [nextQuery, setNextQuery] = useState('');
  const [pickedRoute, setPickedRoute] = useState<string | null>(null); // "operator::line"
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const segmentMatches = useMemo(() => {
    const a = prevQuery.trim();
    const b = nextQuery.trim();
    if (!a || !b) return [];
    return findTrainSegments(a, b);
  }, [prevQuery, nextQuery]);

  const resolvedSegment = useMemo(() => {
    if (segmentMatches.length === 0) return null;
    if (segmentMatches.length === 1) return segmentMatches[0];
    if (!pickedRoute) return null;
    return segmentMatches.find((s) => `${s.operator}::${s.line}` === pickedRoute) ?? null;
  }, [segmentMatches, pickedRoute]);

  const stationSuggestions = (q: string): string[] => {
    const t = q.trim();
    if (!t) return [];
    const fromSubway = STATIONS.filter((s) => s.name.includes(t)).slice(0, 5).map((s) => s.name.replace(/역$/, ''));
    const fromTrain = searchTrainStations(t, 5).map((s) => s.name.replace(/역$/, ''));
    const merged: string[] = [];
    for (const n of [...fromSubway, ...fromTrain]) if (!merged.includes(n)) merged.push(n);
    return merged.slice(0, 8);
  };
  const prevSuggestions = stationSuggestions(prevQuery);
  const nextSuggestions = stationSuggestions(nextQuery);

  const canSubmit = !!trainCar && (resolvedSegment !== null || !!trainType) && !submitting;

  const submit = async () => {
    if (!trainCar) return;
    if (!resolvedSegment && !trainType) return;
    setSubmitting(true);
    setError(null);
    try {
      const payload = buildTrainPlace({
        trainCar,
        trainType,
        trainDest,
        segment: resolvedSegment,
      });
      await api.upsertPlace(payload);
      onPicked(payload.id);
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
        {/* Segment-precise input (optional) */}
        <div style={{ marginBottom: 22, padding: 14, background: TOKEN.surface, border: `1px solid ${TOKEN.border}`, borderRadius: TOKEN.r.md }}>
          <Label>방금 지나간 역 → 다음 도착 역 <span style={{ fontWeight: 400, color: TOKEN.text3 }}>(알면 입력하세요. 노선 자동 매칭)</span></Label>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            <SimpleSuggestInput
              value={prevQuery}
              setValue={(v) => { setPrevQuery(v); setPickedRoute(null); }}
              placeholder="예: 대전"
              suggestions={prevSuggestions}
            />
            <SimpleSuggestInput
              value={nextQuery}
              setValue={(v) => { setNextQuery(v); setPickedRoute(null); }}
              placeholder="예: 김천(구미)"
              suggestions={nextSuggestions}
            />
          </div>
          {prevQuery.trim() && nextQuery.trim() && segmentMatches.length === 0 && (
            <div style={{ marginTop: 10, padding: 10, background: TOKEN.hotBg, color: TOKEN.hot, borderRadius: TOKEN.r.sm, fontSize: 12, lineHeight: 1.5 }}>
              두 역이 같은 열차 노선의 인접 정차역이 아니에요. 오타를 확인하거나, 아래에서 열차 종류를 직접 골라주세요.
            </div>
          )}
          {segmentMatches.length === 1 && (
            <div style={{ marginTop: 10, padding: 10, background: TOKEN.coldBg, border: `1.5px solid ${TOKEN.cold}`, borderRadius: TOKEN.r.sm, fontSize: 13, fontWeight: 700, color: TOKEN.cold }}>
              ✓ {segmentMatches[0].operator} · {segmentMatches[0].line} · {segmentMatches[0].prev}→{segmentMatches[0].next}
            </div>
          )}
          {segmentMatches.length > 1 && (
            <div style={{ marginTop: 10 }}>
              <div style={{ fontSize: 11, color: TOKEN.text2, marginBottom: 6 }}>여러 열차가 다닙니다. 어느 열차?</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {segmentMatches.map((s) => {
                  const k = `${s.operator}::${s.line}`;
                  const active = pickedRoute === k;
                  return (
                    <button
                      key={k}
                      onClick={() => setPickedRoute(active ? null : k)}
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

        <Label>{resolvedSegment ? '어떤 열차 타고 계세요? (자동 감지됨)' : '어떤 열차 타고 계세요? *'}</Label>
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
                  fontSize: 14, fontWeight: 800,
                  cursor: 'pointer', fontFamily: FONT,
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
            width: '100%', padding: '14px',
            background: trainCar === 'unknown' ? TOKEN.cold : TOKEN.surface,
            color: trainCar === 'unknown' ? '#fff' : TOKEN.text1,
            border: `1.5px dashed ${trainCar === 'unknown' ? TOKEN.cold : TOKEN.border}`,
            borderRadius: TOKEN.r.md, fontSize: 14, fontWeight: 700,
            cursor: 'pointer', fontFamily: FONT, marginBottom: 8,
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
                  fontSize: 14, fontWeight: 800,
                  cursor: 'pointer', fontFamily: FONT,
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
        <button onClick={submit} disabled={!canSubmit} style={primaryButtonStyle(canSubmit)}>
          {submitting ? '이동 중…' : '투표하러 가기'}
        </button>
      </div>
    </div>
  );
}
