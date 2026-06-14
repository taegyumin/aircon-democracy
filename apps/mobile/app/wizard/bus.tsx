// Mobile 버스 wizard — 노선 + 정류장 입력 후 차량 매칭 + RouteTimeline 시각 picker. 디자인 시스템 적용.
// 2026-06-04: web RouteTimeline RN 포팅 통합. match.matched=true 후 timeline에서 차량 override 가능.

import { useEffect, useState } from 'react';
import { View, ScrollView, StyleSheet } from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { TOKEN, SPACE, SEOUL_REGION, buildBusPlace, type BusMatchResult, type BusRouteStation, type BusVehiclePosition } from '@aircon/core';
import { api } from '../../src/lib/apiClient';
import { RouteTimeline } from '../../src/components/RouteTimeline';
import { AppText, Field, Button, Card, Badge } from '../../src/ui';

export default function BusWizard() {
  const [route, setRoute] = useState('');
  const [stop, setStop] = useState('');
  const [match, setMatch] = useState<BusMatchResult | null>(null);
  const [matchLoading, setMatchLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Timeline picker — match.matched=true 후 사용자가 자기 탑승 차량을 직접 클릭 가능.
  const [stations, setStations] = useState<BusRouteStation[]>([]);
  const [vehicles, setVehicles] = useState<BusVehiclePosition[]>([]);
  const [pickedVeh, setPickedVeh] = useState<BusVehiclePosition | null>(null);

  // matched && routeId 있을 때 stations + vehicles 로드. routeId 바뀌면 reset + refetch.
  useEffect(() => {
    if (!match?.matched || !match.routeId) { setStations([]); setVehicles([]); setPickedVeh(null); return; }
    const routeId = match.routeId;
    let cancelled = false;
    Promise.all([
      api.listBusRouteStations(routeId, SEOUL_REGION).catch(() => ({ stations: [] })),
      api.listBusRouteVehicles(routeId, SEOUL_REGION).catch(() => ({ vehicles: [] })),
    ]).then(([sRes, vRes]) => {
      if (cancelled) return;
      setStations(sRes.stations ?? []);
      setVehicles(vRes.vehicles ?? []);
    });
    return () => { cancelled = true; };
  }, [match?.matched, match?.routeId]);

  const tryMatch = async () => {
    if (!route.trim() || !stop.trim()) return;
    setMatchLoading(true);
    setMatch(null);
    setPickedVeh(null);
    setError(null);
    try {
      // api.matchBusVehicle 통해 Bearer + onResponse(token capture) 흐름 유지.
      const body = await api.matchBusVehicle({ routeName: route.trim(), stopName: stop.trim() });
      setMatch(body);
    } catch (e) {
      setMatch({ matched: false, reason: (e as Error).message });
    } finally {
      setMatchLoading(false);
    }
  };

  const submit = async () => {
    if (!route.trim()) return;
    setSubmitting(true);
    setError(null);
    try {
      // pickedVeh 있으면 그 차량으로 match override → buildBusPlace는 matched=true 흐름으로.
      const effectiveMatch: BusMatchResult | null = pickedVeh && match
        ? { ...match, matched: true, vehId: pickedVeh.vehId, plainNo: pickedVeh.plainNo, reason: undefined, candidates: undefined }
        : match;
      const payload = buildBusPlace({ routeName: route, stopName: stop, match: effectiveMatch });
      await api.upsertPlace(payload);
      router.push(`/p/${encodeURIComponent(payload.id)}`);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSubmitting(false);
    }
  };

  const canFind = !!route.trim() && !!stop.trim() && !matchLoading;

  return (
    <SafeAreaView style={styles.safe} edges={['bottom']}>
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <AppText variant="title">어떤 버스 타고 계세요?</AppText>
        <AppText variant="body" color={TOKEN.text2} style={styles.hint}>
          노선 번호 + 지금 지나는 정류장을 알려주시면 어떤 차량인지 찾아드릴게요.
        </AppText>

        <View style={{ gap: SPACE.fieldGap }}>
          <Field
            label="노선 번호"
            value={route}
            onChangeText={(v) => { setRoute(v); setMatch(null); setPickedVeh(null); }}
            placeholder="예: 272, 5511, M7106"
            autoFocus
          />
          <Field
            label="지나는 정류장"
            value={stop}
            onChangeText={(v) => { setStop(v); setMatch(null); setPickedVeh(null); }}
            placeholder="예: 신촌오거리, 강남역.강남대로"
          />
        </View>

        <View style={{ marginTop: SPACE.s4 }}>
          <Button label="타고 계신 버스 찾기" variant="secondary" onPress={tryMatch} loading={matchLoading} disabled={!canFind} />
        </View>

        {match && (
          <Card style={[styles.matchBox, match.matched && styles.matchBoxOk]}>
            {match.matched ? (
              <>
                <Badge label="이 버스 맞으시죠?" color={TOKEN.ok} bg={TOKEN.okBg} />
                <AppText variant="title2" style={{ marginTop: SPACE.s2 }}>
                  {match.routeName}번 · 차량번호 {pickedVeh?.plainNo ?? match.plainNo}
                </AppText>
                {match.currentStop && (
                  <AppText variant="caption" color={TOKEN.text2} style={{ marginTop: 2 }}>
                    {match.currentStop} 지나는 중{match.nextStop ? ` · 다음 ${match.nextStop}` : ''}
                  </AppText>
                )}
              </>
            ) : (
              <AppText variant="caption" color={TOKEN.text2}>
                {match.reason === 'no_vehicle_at_stop' ? '근처에 차량이 없어요. 노선 단위로 투표할게요.'
                  : match.reason === 'no_api_key' ? 'API 키 활성화 대기 중. 노선 단위로 투표할게요.'
                  : '매칭 실패. 노선 단위로 투표할게요.'}
              </AppText>
            )}
          </Card>
        )}

        {/* RouteTimeline — matched && stations/vehicles 로드됐을 때만. 사용자가 다른 차량 override 가능. */}
        {match?.matched && stations.length > 0 && (
          <View style={{ marginTop: SPACE.s4 }}>
            <AppText variant="label" color={TOKEN.text2} style={{ marginBottom: SPACE.s2 }}>또는 노선에서 직접 차량 선택</AppText>
            <RouteTimeline
              stations={stations}
              vehicles={vehicles}
              selectedVehId={pickedVeh?.vehId ?? match.vehId ?? null}
              onPickVehicle={setPickedVeh}
            />
          </View>
        )}

        {error && (
          <Card style={styles.errorBox}>
            <AppText variant="caption" color={TOKEN.hot}>{error}</AppText>
          </Card>
        )}

        <View style={{ marginTop: SPACE.s7 }}>
          <Button label={match?.matched ? '이 차량으로 투표' : '투표하러 가기'} onPress={submit} loading={submitting} disabled={!route.trim()} />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: TOKEN.bg },
  scroll: { padding: SPACE.screenPadding, paddingBottom: SPACE.bottomInset },
  hint: { marginTop: SPACE.s2, marginBottom: SPACE.s5, lineHeight: 21 },
  matchBox: { marginTop: SPACE.s4 },
  matchBoxOk: { backgroundColor: TOKEN.okBg, borderColor: TOKEN.ok, borderWidth: 1.5 },
  errorBox: { marginTop: SPACE.s4, backgroundColor: TOKEN.hotBg, borderColor: TOKEN.hotBg },
});
