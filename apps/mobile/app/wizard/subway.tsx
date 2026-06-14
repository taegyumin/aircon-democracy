// Mobile 지하철 wizard — web의 SubwayWizard 'train mode' core flow를 RN으로. 디자인 시스템 적용.
// 2026-06-04: 차량모드(실시간 trainNo 매칭) 추가. swopenAPI 1~9호선 + 신림선/신분당/우이신설/에버라인.
// 매칭됐으면 subway:train:{line}:{trainNo}:{car} placeId — 같은 차량 사용자끼리 vote bucket 묶임.
// 매칭 안 됐어도(no_train_at_segment / service_closed / realtime_unsupported) segment id fallback —
// 사용자는 그래도 투표 가능. no-vehicle headline로 안내.
// 비즈니스 로직(searchStations, findSegments, neighborNames, buildSubwayTrainPlace) @aircon/core 공유.

import { useEffect, useMemo, useState } from 'react';
import { View, ScrollView, StyleSheet, Pressable } from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Check } from 'lucide-react-native';
import {
  TOKEN,
  SPACE,
  STATIONS,
  searchStations,
  findSegments,
  neighborNames,
  lineColor,
  carCountFor,
  buildSubwayTrainPlace,
  type Station,
  type SubwayMatchResult,
} from '@aircon/core';
import { api } from '../../src/lib/apiClient';
import { AppText, Input, Button, Card, Badge, ListRow, SelectionGrid } from '../../src/ui';

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

  // matchLoading 중에는 disable — 사용자가 빠르게 submit 누르면 segment fallback으로 가버리는
  // 회귀 방지 (Codex 리뷰 (C) 지적).
  const canSubmit = !!resolved && car !== null && !submitting && !matchLoading;

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
      await api.upsertPlace(payload);
      router.push(`/p/${encodeURIComponent(payload.id)}`);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSubmitting(false);
    }
  };

  const matchColor = segments.length === 1 ? lineColor(segments[0].line) : TOKEN.cold;

  return (
    <SafeAreaView style={styles.safe} edges={['bottom']}>
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <AppText variant="body" color={TOKEN.text2} style={styles.hint}>
          안내방송 들리는 대로 두 역만 입력하세요. 노선과 방향은 자동으로 알아낼게요.
        </AppText>

        <StationField
          dotColor={TOKEN.cold}
          label="방금 지나간 역"
          query={prevQ}
          setQuery={setPrevQ}
          station={prev}
          setStation={setPrev}
          suggestions={prevSugg}
          placeholder="예: 강남"
        />
        <View style={{ height: SPACE.fieldGap }} />
        <StationField
          dotColor={TOKEN.hot}
          label="다음 도착 역"
          query={nextQ}
          setQuery={setNextQ}
          station={next}
          setStation={setNext}
          suggestions={nextSugg}
          placeholder="예: 역삼"
        />

        {prev && next && segments.length === 0 && (
          <Card style={styles.warn}>
            <AppText variant="label" weight="semibold" color={TOKEN.hot}>두 역이 인접해 있지 않아요</AppText>
            <AppText variant="caption" color={TOKEN.text2} style={{ marginTop: 2 }}>안내방송에 나온 바로 다음 역으로 다시 확인해 주세요.</AppText>
          </Card>
        )}

        {segments.length === 1 && (
          <Card style={[styles.match, { borderColor: matchColor }]}>
            <View style={styles.matchHead}>
              {trainConfirmed
                ? <Badge label="열차 확인됨" color={TOKEN.ok} bg={TOKEN.okBg} />
                : noVehicle
                  ? <Badge label="차량 없음" color={TOKEN.hot} bg={TOKEN.hotBg} />
                  : <Badge label={matchLoading ? '열차 찾는 중' : '자동 매칭'} color={matchColor} bg={TOKEN.coldBg} />}
            </View>
            <AppText variant="title2" color={matchColor} style={{ marginTop: SPACE.s2 }}>
              {segments[0].line} · {segments[0].prev} → {segments[0].next}
              {trainConfirmed && trainMatch?.trainNo ? ` · ${trainMatch.trainNo}호` : ''}
            </AppText>
            {noVehicle && (
              <AppText variant="caption" color={TOKEN.text2} style={{ marginTop: SPACE.s2 }}>
                막차 시간이 지났거나 차량 간격이 긴 시간대예요. 그래도 구간 단위로 투표할 수 있어요.
              </AppText>
            )}
          </Card>
        )}

        {segments.length > 1 && (
          <View style={styles.section}>
            <AppText variant="label" color={TOKEN.text2} style={styles.fieldLabel}>여러 노선이 있어요. 어느 노선?</AppText>
            <View style={styles.chipRow}>
              {segments.map((s) => {
                const active = pickedLine === s.line;
                const lc = lineColor(s.line);
                return (
                  <Pressable
                    key={s.line}
                    onPress={() => setPickedLine(active ? null : s.line)}
                    accessibilityRole="button"
                    accessibilityState={{ selected: active }}
                    style={[styles.lineChip, active ? { backgroundColor: lc, borderColor: lc } : { borderColor: TOKEN.border }]}
                  >
                    <AppText variant="label" weight="bold" color={active ? '#FFFFFF' : TOKEN.text1}>{s.line}</AppText>
                  </Pressable>
                );
              })}
            </View>
          </View>
        )}

        {resolved && (
          <View style={styles.section}>
            <AppText variant="label" color={TOKEN.text2} style={styles.fieldLabel}>몇 호차예요?</AppText>
            <SelectionGrid
              columns={5}
              items={Array.from({ length: carCountFor(resolved.line) }, (_, i) => ({ key: String(i + 1), label: String(i + 1) }))}
              selectedKey={typeof car === 'number' ? String(car) : null}
              onSelect={(k) => { const n = Number(k); setCar(car === n ? null : n); }}
            />
            <Pressable
              onPress={() => setCar(car === 'unknown' ? null : 'unknown')}
              accessibilityRole="button"
              accessibilityState={{ selected: car === 'unknown' }}
              style={[styles.unknown, car === 'unknown' && styles.unknownActive]}
            >
              {car === 'unknown' && <Check size={16} color="#FFFFFF" />}
              <AppText variant="label" weight="bold" color={car === 'unknown' ? '#FFFFFF' : TOKEN.text2}>
                {car === 'unknown' ? '호차 모름' : '호차 모름 — 그래도 투표'}
              </AppText>
            </Pressable>
          </View>
        )}

        {error && (
          <Card style={styles.warn}>
            <AppText variant="caption" color={TOKEN.hot}>{error}</AppText>
          </Card>
        )}

        <View style={{ marginTop: SPACE.s7 }}>
          <Button label="투표하러 가기" onPress={submit} loading={submitting} disabled={!canSubmit} />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function StationField({
  dotColor, label, query, setQuery, station, setStation, suggestions, placeholder,
}: {
  dotColor: string;
  label: string;
  query: string; setQuery: (v: string) => void;
  station: Station | null; setStation: (s: Station | null) => void;
  suggestions: Station[];
  placeholder: string;
}) {
  return (
    <View>
      <View style={styles.fieldLabelRow}>
        <View style={[styles.dot, { backgroundColor: dotColor }]} />
        <AppText variant="label" color={TOKEN.text2}>{label}</AppText>
      </View>
      {station ? (
        <View style={[styles.selectedRow, { borderColor: dotColor }]}>
          <View style={{ flex: 1, minWidth: 0 }}>
            <AppText variant="bodyLg" weight="bold" numberOfLines={1}>{station.name}</AppText>
            <AppText variant="caption" color={TOKEN.text3} numberOfLines={1} style={{ marginTop: 2 }}>{station.lines.join(' · ')} · {station.city}</AppText>
          </View>
          <Button label="변경" variant="ghost" full={false} onPress={() => { setStation(null); setQuery(''); }} style={styles.changeBtn} />
        </View>
      ) : (
        <>
          <Input value={query} onChangeText={setQuery} placeholder={placeholder} />
          {suggestions.length > 0 && (
            <View style={styles.suggestions}>
              {suggestions.map((s) => (
                <ListRow
                  key={s.id}
                  title={s.name}
                  sub={`${s.lines.join(' · ')} · ${s.city}`}
                  trailing={<View />}
                  onPress={() => { setStation(s); setQuery(''); }}
                />
              ))}
            </View>
          )}
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: TOKEN.bg },
  scroll: { padding: SPACE.screenPadding, paddingBottom: SPACE.bottomInset },
  hint: { marginBottom: SPACE.s5, lineHeight: 21 },
  fieldLabelRow: { flexDirection: 'row', alignItems: 'center', gap: SPACE.s2, marginBottom: SPACE.s2 },
  fieldLabel: { marginBottom: SPACE.s3 },
  dot: { width: 10, height: 10, borderRadius: 5 },
  suggestions: { marginTop: SPACE.s2, gap: SPACE.rowGap },
  selectedRow: {
    flexDirection: 'row', alignItems: 'center', gap: SPACE.s3, padding: SPACE.s3, paddingLeft: SPACE.s4,
    backgroundColor: TOKEN.surface, borderWidth: 1.5, borderRadius: TOKEN.r.lg,
  },
  changeBtn: { height: 40, paddingHorizontal: SPACE.s3 },
  section: { marginTop: SPACE.s5 },
  warn: { marginTop: SPACE.s4, backgroundColor: TOKEN.hotBg, borderColor: TOKEN.hotBg },
  match: { marginTop: SPACE.s4, borderWidth: 1.5 },
  matchHead: { flexDirection: 'row' },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACE.s2 },
  lineChip: { paddingHorizontal: SPACE.s4, minHeight: 40, justifyContent: 'center', backgroundColor: TOKEN.surface, borderWidth: 1.5, borderRadius: TOKEN.r.pill },
  unknown: {
    flexDirection: 'row', gap: SPACE.s2, marginTop: SPACE.s3, minHeight: SPACE.touchMin, padding: SPACE.s3,
    backgroundColor: TOKEN.surface, borderRadius: TOKEN.r.md, borderWidth: 1.5, borderStyle: 'dashed',
    borderColor: TOKEN.border, alignItems: 'center', justifyContent: 'center',
  },
  unknownActive: { backgroundColor: TOKEN.cold, borderColor: TOKEN.cold, borderStyle: 'solid' },
});
