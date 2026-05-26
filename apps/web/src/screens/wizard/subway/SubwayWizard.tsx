'use client';

// 지하철 wizard — 두 mode (열차 안 / 열차 기다리는 중) 토글.
// 가장 복잡한 wizard라서 sub-component + hook + pure builder로 잘게 쪼갬.

import { useMemo, useState } from 'react';
import { Hourglass, TramFront } from 'lucide-react';
import {
  TOKEN, FONT, searchStations, neighborNames, STATIONS,
  type Station, findSegments,
} from '@aircon/core';
import { api } from '../../../lib/apiClient';
import { recordLine } from '../../../lib/recentPlaces';
import { WizardHeader } from '../WizardHeader';
import { TrainModeBody } from './TrainModeBody';
import { PlatformModeBody } from './PlatformModeBody';
import { useSubwayTrainMatch } from './useSubwayTrainMatch';
import { buildSubwayTrainPlace, buildSubwayPlatformPlace } from './buildSubwayPlace';

type SubwayMode = 'train' | 'platform';

interface Props {
  onBack: () => void;
  onPicked: (placeId: string) => void;
}

export function SubwayWizard({ onBack, onPicked }: Props) {
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

  // Segment resolution — pass city to disambiguate multi-city "1호선" etc.
  const segments = useMemo(() => {
    if (!prevStation || !nextStationSel) return [];
    const city = prevStation.city === nextStationSel.city ? prevStation.city : undefined;
    return findSegments(prevStation.name, nextStationSel.name, city);
  }, [prevStation, nextStationSel]);

  const resolvedSegment = useMemo(() => {
    if (segments.length === 0) return null;
    if (segments.length === 1) return segments[0];
    return pickedLine ? segments.find((s) => s.line === pickedLine) ?? null : null;
  }, [segments, pickedLine]);

  const { trainMatch, matchLoading, bumpNonce } = useSubwayTrainMatch(resolvedSegment);

  const submitTrain = async () => {
    if (!resolvedSegment || car === null || submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      const payload = buildSubwayTrainPlace({
        line: resolvedSegment.line,
        prev: resolvedSegment.prev,
        next: resolvedSegment.next,
        car,
        trainMatch: trainMatch ? { matched: trainMatch.matched, trainNo: trainMatch.trainNo, destination: trainMatch.destination } : null,
      });
      await api.upsertPlace(payload);
      recordLine(resolvedSegment.line);
      onPicked(payload.id);
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
      const payload = buildSubwayPlatformPlace({ station: platStation });
      await api.upsertPlace(payload);
      onPicked(payload.id);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSubmitting(false);
    }
  };

  const trainCanSubmit = !!resolvedSegment && car !== null && !submitting;
  const platformCanSubmit = !!platStation && !submitting;

  // suggestions 로직 (2026-05-27 디자인 결정):
  //   - 검색창에 텍스트 있음 → 전체 역 검색 결과 (인접 필터 X — 사용자 직접 typing).
  //   - 검색창 비고 + 반대 station 입력됨 → 인접역 list (편의용).
  //   - 검색창 비고 + 양쪽 다 비음 → 빈 list.
  // 별도 chip 컴포넌트 X — 검색창 아래 한 자리에 통합.
  const prevSuggestions = useMemo(() => {
    const q = prevQuery.trim();
    if (q) return searchStations({ query: q, limit: 8 });
    if (nextStationSel) {
      const neighbors = new Set(neighborNames(nextStationSel.name, nextStationSel.city));
      return STATIONS.filter((s) => neighbors.has(s.name) && s.city === nextStationSel.city).slice(0, 8);
    }
    return [];
  }, [prevQuery, nextStationSel]);

  const nextSuggestions = useMemo(() => {
    const q = nextQuery.trim();
    if (q) return searchStations({ query: q, limit: 8 });
    if (prevStation) {
      const neighbors = new Set(neighborNames(prevStation.name, prevStation.city));
      return STATIONS.filter((s) => neighbors.has(s.name) && s.city === prevStation.city).slice(0, 8);
    }
    return [];
  }, [nextQuery, prevStation]);

  const platSuggestions = useMemo(
    () => platQuery.trim() ? searchStations({ query: platQuery, limit: 8 }) : [],
    [platQuery],
  );

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', background: TOKEN.bg, fontFamily: FONT }}>
      <WizardHeader title="지하철" onBack={onBack} />
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
            setPrevStation={(s) => { setPrevStation(s); bumpNonce(); }}
            nextQuery={nextQuery} setNextQuery={setNextQuery}
            nextStation={nextStationSel}
            setNextStation={(s) => { setNextStationSel(s); bumpNonce(); }}
            prevSuggestions={prevSuggestions}
            nextSuggestions={nextSuggestions}
            segments={segments}
            resolvedSegment={resolvedSegment}
            pickedLine={pickedLine}
            setPickedLine={setPickedLine}
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
