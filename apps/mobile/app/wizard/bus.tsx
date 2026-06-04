// Mobile 버스 wizard — 노선 + 정류장 입력 후 차량 매칭 + RouteTimeline 시각 picker.
// 2026-06-04: web RouteTimeline RN 포팅 통합. match.matched=true 후 timeline에서 차량 override 가능.

import { useEffect, useState } from 'react';
import { View, Text, TextInput, Pressable, ScrollView, StyleSheet, ActivityIndicator } from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { TOKEN, SEOUL_REGION, buildBusPlace, type BusMatchResult, type BusRouteStation, type BusVehiclePosition } from '@aircon/core';
import { api, API_BASE } from '../../src/lib/apiClient';
import { RouteTimeline } from '../../src/components/RouteTimeline';

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
      const res = await fetch(`${API_BASE}/api/realtime/bus/match`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Aircon-Intent': 'user-action', Origin: API_BASE },
        body: JSON.stringify({ routeName: route.trim(), stopName: stop.trim() }),
      });
      const body = (await res.json()) as BusMatchResult;
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
        <Text style={styles.title}>어떤 버스 타고 계세요?</Text>
        <Text style={styles.hint}>노선 번호 + 지금 지나는 정류장을 알려주시면 어떤 차량인지 찾아드릴게요.</Text>

        <Text style={styles.label}>노선 번호 *</Text>
        <TextInput
          value={route}
          onChangeText={(v) => { setRoute(v); setMatch(null); setPickedVeh(null); }}
          placeholder="예: 272, 5511, M7106"
          placeholderTextColor={TOKEN.text3}
          style={styles.input}
          autoFocus
        />

        <View style={{ height: 12 }} />

        <Text style={styles.label}>지나는 정류장 *</Text>
        <TextInput
          value={stop}
          onChangeText={(v) => { setStop(v); setMatch(null); setPickedVeh(null); }}
          placeholder="예: 신촌오거리, 강남역.강남대로"
          placeholderTextColor={TOKEN.text3}
          style={styles.input}
        />

        <Pressable
          onPress={tryMatch}
          disabled={!route.trim() || !stop.trim() || matchLoading}
          style={[styles.findBtn, (!route.trim() || !stop.trim()) && styles.findBtnDisabled]}
        >
          {matchLoading
            ? <ActivityIndicator color={TOKEN.cold} />
            : <Text style={styles.findText}>너가 타고 있는 버스 찾기</Text>}
        </Pressable>

        {match && (
          <View style={[styles.matchBox, match.matched && styles.matchBoxOk]}>
            {match.matched
              ? <>
                  <Text style={styles.matchLabel}>이 버스 맞으시죠?</Text>
                  <Text style={styles.matchTitle}>{match.routeName}번 · 차량번호 {pickedVeh?.plainNo ?? match.plainNo}</Text>
                  {match.currentStop && <Text style={styles.matchSub}>{match.currentStop} 지나는 중{match.nextStop ? ` · 다음 ${match.nextStop}` : ''}</Text>}
                </>
              : <Text style={styles.matchFail}>
                  {match.reason === 'no_vehicle_at_stop' ? '근처에 차량이 없어요. 노선 단위로 투표할게요.'
                    : match.reason === 'no_api_key' ? 'API 키 활성화 대기 중. 노선 단위로 투표할게요.'
                    : '매칭 실패. 노선 단위로 투표할게요.'}
                </Text>}
          </View>
        )}

        {/* RouteTimeline — matched && stations/vehicles 로드됐을 때만. 사용자가 다른 차량 override 가능. */}
        {match?.matched && stations.length > 0 && (
          <View style={{ marginTop: 14 }}>
            <Text style={styles.label}>또는 노선에서 직접 차량 선택</Text>
            <RouteTimeline
              stations={stations}
              vehicles={vehicles}
              selectedVehId={pickedVeh?.vehId ?? match.vehId ?? null}
              onPickVehicle={setPickedVeh}
            />
          </View>
        )}

        {error && <View style={styles.error}><Text style={styles.errorText}>{error}</Text></View>}

        <Pressable onPress={submit} disabled={!route.trim() || submitting} style={[styles.submit, !route.trim() && styles.submitDisabled]}>
          {submitting ? <ActivityIndicator color="#fff" /> : <Text style={styles.submitText}>{match?.matched ? '이 차량으로 투표' : '투표하러 가기'}</Text>}
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: TOKEN.bg },
  scroll: { padding: 20, paddingBottom: 60 },
  title: { fontSize: 20, fontWeight: '900', color: TOKEN.text1, marginBottom: 6 },
  hint: { fontSize: 13, color: TOKEN.text2, marginBottom: 22, lineHeight: 18 },
  label: { fontSize: 12, fontWeight: '700', color: TOKEN.text2, marginBottom: 8, letterSpacing: 0.3 },
  input: { padding: 13, borderWidth: 2, borderColor: TOKEN.border, borderRadius: TOKEN.r.md, fontSize: 14, color: TOKEN.text1, backgroundColor: TOKEN.bg },
  findBtn: { marginTop: 18, padding: 13, backgroundColor: TOKEN.surface, borderWidth: 1.5, borderColor: TOKEN.cold, borderRadius: TOKEN.r.md, alignItems: 'center' },
  findBtnDisabled: { borderColor: TOKEN.border },
  findText: { fontSize: 14, fontWeight: '700', color: TOKEN.cold },
  matchBox: { marginTop: 16, padding: 14, backgroundColor: TOKEN.surface, borderWidth: 1.5, borderColor: TOKEN.border, borderRadius: TOKEN.r.md },
  matchBoxOk: { backgroundColor: '#F0FDF4', borderColor: TOKEN.ok },
  matchLabel: { fontSize: 11, color: TOKEN.text2, marginBottom: 4 },
  matchTitle: { fontSize: 16, fontWeight: '900', color: TOKEN.text1 },
  matchSub: { fontSize: 12, color: TOKEN.text2, marginTop: 4 },
  matchFail: { fontSize: 12, color: TOKEN.text3, lineHeight: 18 },
  error: { marginTop: 14, padding: 10, backgroundColor: TOKEN.hotBg, borderRadius: TOKEN.r.md },
  errorText: { color: TOKEN.hot, fontSize: 12 },
  submit: { marginTop: 28, padding: 16, backgroundColor: TOKEN.cold, borderRadius: TOKEN.r.lg, alignItems: 'center' },
  submitDisabled: { backgroundColor: TOKEN.border },
  submitText: { fontSize: 15, fontWeight: '700', color: '#fff' },
});
