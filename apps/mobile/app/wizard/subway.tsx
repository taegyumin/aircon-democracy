// Mobile 지하철 wizard — web의 SubwayWizard 'train mode' core flow를 RN으로.
// 2026-06-04: 차량모드(실시간 trainNo 매칭) 추가. swopenAPI 1~9호선 + 신림선/신분당/우이신설/에버라인.
// 매칭됐으면 subway:train:{line}:{trainNo}:{car} placeId — 같은 차량 사용자끼리 vote bucket 묶임.
// 매칭 안 됐어도(no_train_at_segment / service_closed / realtime_unsupported) segment id fallback —
// 사용자는 그래도 투표 가능. no-vehicle headline로 안내.
// 비즈니스 로직(searchStations, findSegments, neighborNames, buildSubwayTrainPlace) @aircon/core 공유.

import { useEffect, useMemo, useState } from 'react';
import { View, Text, TextInput, Pressable, ScrollView, StyleSheet, ActivityIndicator } from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  TOKEN,
  STATIONS,
  searchStations,
  findSegments,
  neighborNames,
  lineColor,
  buildSubwayTrainPlace,
  type Station,
  type SubwayMatchResult,
} from '@aircon/core';
import { api, API_BASE } from '../../src/lib/apiClient';

export default function SubwayWizard() {
  const [prevQ, setPrevQ] = useState('');
  const [prev, setPrev] = useState<Station | null>(null);
  const [nextQ, setNextQ] = useState('');
  const [next, setNext] = useState<Station | null>(null);
  const [pickedLine, setPickedLine] = useState<string | null>(null);
  const [car, setCar] = useState<number | 'unknown' | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [trainMatch, setTrainMatch] = useState<SubwayMatchResult | null>(null);
  const [matchLoading, setMatchLoading] = useState(false);

  const segments = useMemo(() => {
    if (!prev || !next) return [];
    const city = prev.city === next.city ? prev.city : undefined;
    return findSegments(prev.name, next.name, city);
  }, [prev, next]);

  const resolved = useMemo(() => {
    if (segments.length === 0) return null;
    if (segments.length === 1) return segments[0];
    return pickedLine ? segments.find((s) => s.line === pickedLine) ?? null : null;
  }, [segments, pickedLine]);

  const restrictNeighbors = (anchor: Station | null) =>
    anchor ? new Set(neighborNames(anchor.name, anchor.city)) : null;

  const prevSugg = useMemo(() => {
    const r = restrictNeighbors(next);
    if (r) {
      return STATIONS
        .filter((s) => r.has(s.name) && (!next || s.city === next.city))
        .filter((s) => !prevQ.trim() || s.name.includes(prevQ.trim()))
        .slice(0, 6);
    }
    return prevQ.trim() ? searchStations({ query: prevQ, limit: 5 }) : [];
  }, [prevQ, next]);

  const nextSugg = useMemo(() => {
    const r = restrictNeighbors(prev);
    if (r) {
      return STATIONS
        .filter((s) => r.has(s.name) && (!prev || s.city === prev.city))
        .filter((s) => !nextQ.trim() || s.name.includes(nextQ.trim()))
        .slice(0, 6);
    }
    return nextQ.trim() ? searchStations({ query: nextQ, limit: 5 }) : [];
  }, [nextQ, prev]);

  // Segment 확정되면 차량 매칭 시도. 매번 segment 바뀔 때마다 재시도.
  // race 방지: cancelled flag. 매칭 실패해도 segment 모드로 fallback 가능 (submit에서 처리).
  useEffect(() => {
    if (!resolved) { setTrainMatch(null); setMatchLoading(false); return; }
    let cancelled = false;
    setTrainMatch(null);
    setMatchLoading(true);
    api.matchSubwayTrain({ line: resolved.line, prev: resolved.prev, next: resolved.next })
      .then((r) => { if (!cancelled) setTrainMatch(r); })
      .catch(() => { if (!cancelled) setTrainMatch({ matched: false, reason: 'upstream_error' }); })
      .finally(() => { if (!cancelled) setMatchLoading(false); });
    return () => { cancelled = true; };
  }, [resolved?.line, resolved?.prev, resolved?.next]);

  // headline state: 차량 매칭됐는지, no-vehicle인지, 미확정인지.
  const noVehicle = !!resolved && !!trainMatch && !trainMatch.matched && !matchLoading &&
    (trainMatch.reason === 'no_train_at_segment' || trainMatch.reason === 'service_closed' || trainMatch.reason === 'realtime_unsupported');
  const trainConfirmed = trainMatch?.matched ?? false;

  const canSubmit = !!resolved && car !== null && !submitting;

  const submit = async () => {
    if (!resolved || car === null) return;
    setSubmitting(true);
    setError(null);
    try {
      // buildSubwayTrainPlace: matched면 subway:train:..., 아니면 segment fallback.
      const payload = buildSubwayTrainPlace({
        line: resolved.line,
        prev: resolved.prev,
        next: resolved.next,
        car,
        trainMatch: trainMatch
          ? { matched: trainMatch.matched, trainNo: trainMatch.trainNo, destination: trainMatch.destination }
          : null,
      });
      const res = await fetch(`${API_BASE}/api/places/upsert`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Aircon-Intent': 'user-action', Origin: API_BASE },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as { error?: string } | null;
        throw new Error(body?.error ?? `HTTP ${res.status}`);
      }
      router.push(`/p/${encodeURIComponent(payload.id)}`);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <Text style={styles.hint}>안내방송 들리는 대로 두 역만 입력하세요. 노선과 방향은 자동으로 알아낼게요.</Text>

        <StationField
          label="🔵 방금 지나간 역"
          query={prevQ}
          setQuery={setPrevQ}
          station={prev}
          setStation={setPrev}
          suggestions={prevSugg}
          placeholder="예: 강남"
        />
        <View style={styles.gap12} />
        <StationField
          label="🔴 다음 도착 역"
          query={nextQ}
          setQuery={setNextQ}
          station={next}
          setStation={setNext}
          suggestions={nextSugg}
          placeholder="예: 역삼"
        />

        {prev && next && segments.length === 0 && (
          <View style={styles.alert}><Text style={styles.alertText}>두 역이 인접해 있지 않아요.</Text></View>
        )}
        {segments.length === 1 && (
          <View style={[styles.match, { borderColor: lineColor(segments[0].line) }]}>
            <Text style={styles.matchLabel}>
              {matchLoading ? '열차 찾는 중…' : trainConfirmed ? '✓ 열차 확인됨' : noVehicle ? '⚠️ 지금 이 구간에 차량이 없어요' : '자동 매칭'}
            </Text>
            <Text style={[styles.matchText, { color: lineColor(segments[0].line) }]}>
              {segments[0].line} · {segments[0].prev} → {segments[0].next}
              {trainConfirmed && trainMatch?.trainNo ? ` · ${trainMatch.trainNo}호` : ''}
            </Text>
            {noVehicle && (
              <Text style={styles.noVehicleSub}>
                막차 시간이 지났거나 차량 간격이 긴 시간대예요. 그래도 구간 단위로 투표할 수 있어요.
              </Text>
            )}
          </View>
        )}
        {segments.length > 1 && (
          <View style={styles.gap14Top}>
            <Text style={styles.fieldLabel}>여러 노선이 있어요. 어느 노선?</Text>
            <View style={styles.chipRow}>
              {segments.map((s) => {
                const active = pickedLine === s.line;
                return (
                  <Pressable
                    key={s.line}
                    onPress={() => setPickedLine(active ? null : s.line)}
                    style={[styles.chip, active && { backgroundColor: lineColor(s.line), borderColor: lineColor(s.line) }]}
                  >
                    <Text style={[styles.chipText, active && { color: '#fff' }]}>{s.line}</Text>
                  </Pressable>
                );
              })}
            </View>
          </View>
        )}

        {resolved && (
          <View style={styles.sectionGap}>
            <Text style={styles.fieldLabel}>몇 호차예요?</Text>
            <View style={styles.carGrid}>
              {[1,2,3,4,5,6,7,8,9,10].map((n) => {
                const active = car === n;
                return (
                  <Pressable key={n} onPress={() => setCar(active ? null : n)} style={[styles.carCell, active && styles.carCellActive]}>
                    <Text style={[styles.carText, active && { color: '#fff' }]}>{n}</Text>
                  </Pressable>
                );
              })}
            </View>
            <Pressable onPress={() => setCar(car === 'unknown' ? null : 'unknown')} style={[styles.unknown, car === 'unknown' && styles.unknownActive]}>
              <Text style={[styles.unknownText, car === 'unknown' && { color: '#fff' }]}>
                {car === 'unknown' ? '✓ 호차 모름' : '호차 모름 — 그래도 투표'}
              </Text>
            </Pressable>
          </View>
        )}

        {error && <View style={styles.error}><Text style={styles.errorText}>{error}</Text></View>}

        <Pressable onPress={submit} disabled={!canSubmit} style={[styles.submit, !canSubmit && styles.submitDisabled]}>
          {submitting ? <ActivityIndicator color="#fff" /> : <Text style={styles.submitText}>투표하러 가기</Text>}
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

function StationField({
  label, query, setQuery, station, setStation, suggestions, placeholder,
}: {
  label: string;
  query: string; setQuery: (v: string) => void;
  station: Station | null; setStation: (s: Station | null) => void;
  suggestions: Station[];
  placeholder: string;
}) {
  if (station) {
    return (
      <View>
        <Text style={styles.fieldLabel}>{label}</Text>
        <View style={styles.selectedRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.selectedName}>{station.name}</Text>
            <Text style={styles.selectedSub}>{station.lines.join(' · ')} · {station.city}</Text>
          </View>
          <Pressable onPress={() => { setStation(null); setQuery(''); }}>
            <Text style={styles.change}>변경</Text>
          </Pressable>
        </View>
      </View>
    );
  }
  return (
    <View>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput
        value={query}
        onChangeText={setQuery}
        placeholder={placeholder}
        placeholderTextColor={TOKEN.text3}
        style={styles.input}
      />
      {suggestions.length > 0 && (
        <View style={styles.suggestions}>
          {suggestions.map((s) => (
            <Pressable key={s.id} onPress={() => { setStation(s); setQuery(''); }} style={styles.suggestRow}>
              <Text style={styles.suggestName}>{s.name}</Text>
              <Text style={styles.suggestSub}>{s.lines.join(' · ')} · {s.city}</Text>
            </Pressable>
          ))}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: TOKEN.bg },
  scroll: { padding: 20, paddingBottom: 60 },
  hint: { fontSize: 13, color: TOKEN.text2, marginBottom: 14, lineHeight: 18 },
  fieldLabel: { fontSize: 12, fontWeight: '700', color: TOKEN.text2, marginBottom: 8, letterSpacing: 0.3 },
  input: {
    padding: 13, borderWidth: 2, borderColor: TOKEN.border,
    borderRadius: TOKEN.r.md, fontSize: 14, color: TOKEN.text1, backgroundColor: TOKEN.bg,
  },
  suggestions: { marginTop: 6, gap: 4 },
  suggestRow: { padding: 12, backgroundColor: TOKEN.surface, borderRadius: TOKEN.r.md, borderWidth: 1, borderColor: TOKEN.border },
  suggestName: { fontSize: 13, fontWeight: '700', color: TOKEN.text1 },
  suggestSub: { fontSize: 11, color: TOKEN.text3, marginTop: 2 },
  selectedRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12,
    backgroundColor: TOKEN.coldBg, borderWidth: 2, borderColor: TOKEN.cold, borderRadius: TOKEN.r.md,
  },
  selectedName: { fontSize: 14, fontWeight: '700', color: TOKEN.text1 },
  selectedSub: { fontSize: 11, color: TOKEN.text3, marginTop: 2 },
  change: { fontSize: 13, color: TOKEN.text2 },
  // Spacing tokens — inline {{ marginTop / height }} 대체.
  gap12: { height: 12 },
  gap14Top: { marginTop: 14 },
  sectionGap: { marginTop: 18 },
  alert: { marginTop: 14, padding: 14, backgroundColor: TOKEN.hotBg, borderRadius: TOKEN.r.md },
  alertText: { color: TOKEN.hot, fontSize: 13 },
  match: { marginTop: 14, padding: 14, backgroundColor: TOKEN.coldBg, borderWidth: 1.5, borderRadius: TOKEN.r.md },
  matchLabel: { fontSize: 11, color: TOKEN.text2, marginBottom: 4 },
  matchText: { fontSize: 15, fontWeight: '800' },
  noVehicleSub: { fontSize: 11, color: TOKEN.text2, lineHeight: 16, marginTop: 6 },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  chip: { paddingHorizontal: 14, paddingVertical: 8, backgroundColor: TOKEN.surface, borderWidth: 1.5, borderColor: TOKEN.border, borderRadius: 999 },
  chipText: { fontSize: 13, fontWeight: '700', color: TOKEN.text1 },
  carGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 6 },
  carCell: {
    width: '18%', paddingVertical: 12, backgroundColor: TOKEN.surface,
    borderWidth: 1.5, borderColor: TOKEN.border, borderRadius: TOKEN.r.md, alignItems: 'center',
  },
  carCellActive: { backgroundColor: TOKEN.cold, borderColor: TOKEN.cold },
  carText: { fontSize: 16, fontWeight: '800', color: TOKEN.text1 },
  unknown: { marginTop: 10, padding: 14, backgroundColor: TOKEN.surface, borderRadius: TOKEN.r.md, borderWidth: 1.5, borderStyle: 'dashed', borderColor: TOKEN.border, alignItems: 'center' },
  unknownActive: { backgroundColor: TOKEN.cold, borderColor: TOKEN.cold, borderStyle: 'solid' },
  unknownText: { fontSize: 14, fontWeight: '700', color: TOKEN.text1 },
  error: { marginTop: 14, padding: 10, backgroundColor: TOKEN.hotBg, borderRadius: TOKEN.r.md },
  errorText: { color: TOKEN.hot, fontSize: 12 },
  submit: { marginTop: 28, padding: 16, backgroundColor: TOKEN.cold, borderRadius: TOKEN.r.lg, alignItems: 'center' },
  submitDisabled: { backgroundColor: TOKEN.border },
  submitText: { fontSize: 15, fontWeight: '700', color: '#fff' },
});
