// Mobile 기차 wizard (RN) — web TrainTagoVerifyWizard 포팅.
// TAGO TrainInfo로 좌석권 정보(출도착역 + 시/분 + 호차) 검증 → placeId 발급.

import { useEffect, useMemo, useState } from 'react';
import { View, Text, TextInput, Pressable, ScrollView, StyleSheet, ActivityIndicator } from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { TOKEN, joinYmdHm, TRAIN_VERIFY_ERROR_COPY, parseStationLabel } from '@aircon/core';
import type { TrainVerifyResult } from '@aircon/core';
import { api } from '../../src/lib/apiClient';
import { SimpleSuggestInput } from '../../src/components/SimpleSuggestInput';

interface TrainStationCached {
  nodeId: string;
  nodeName: string;
  cityName: string;
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
  return `${s.slice(8, 10)}:${s.slice(10, 12)}`;
}

export default function TrainWizard() {
  const [allStations, setAllStations] = useState<TrainStationCached[]>([]);
  const [stationsLoading, setStationsLoading] = useState(true);

  const [depQuery, setDepQuery] = useState('');
  const [depPlaceId, setDepPlaceId] = useState('');
  const [arrQuery, setArrQuery] = useState('');
  const [arrPlaceId, setArrPlaceId] = useState('');

  const [carOrdr, setCarOrdr] = useState<number | null>(null);
  const runDt = useMemo(() => formatRunDt(new Date()), []);
  const [depHour, setDepHour] = useState('');
  const [depMin, setDepMin] = useState('');

  const [verifying, setVerifying] = useState(false);
  const [result, setResult] = useState<TrainVerifyResult | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

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

  function suggestStations(q: string): string[] {
    const t = q.trim();
    if (!t) return [];
    const lower = t.toLowerCase();
    const scored: { label: string; rank: number }[] = [];
    const seen = new Set<string>();
    for (const s of allStations) {
      const label = `${s.nodeName} (${s.cityName})`;
      if (seen.has(label)) continue;
      const nameLower = s.nodeName.toLowerCase();
      let rank = 99;
      if (s.nodeName === t) rank = 0;
      else if (nameLower.startsWith(lower)) rank = 1;
      else if (nameLower.includes(lower)) rank = 2;
      if (rank < 99) { scored.push({ label, rank }); seen.add(label); }
    }
    scored.sort((a, b) => a.rank - b.rank);
    return scored.slice(0, 8).map((x) => x.label);
  }

  function findByLabel(v: string): TrainStationCached | null {
    const parsed = parseStationLabel(v);
    if (!parsed) return null;
    return allStations.find((s) => s.nodeName === parsed.name && s.cityName === parsed.city) ?? null;
  }
  function handleDepChange(v: string) {
    setDepQuery(v);
    setResult(null);
    setDepPlaceId(findByLabel(v)?.nodeId ?? '');
  }
  function handleArrChange(v: string) {
    setArrQuery(v);
    setResult(null);
    setArrPlaceId(findByLabel(v)?.nodeId ?? '');
  }

  const depPlandTimeHHMI = useMemo(() => joinYmdHm(runDt, depHour, depMin), [runDt, depHour, depMin]);

  const canVerify = !!depPlaceId && !!arrPlaceId && depPlandTimeHHMI.length === 12 && !!carOrdr && !verifying;

  const verify = async () => {
    if (!canVerify || !carOrdr) return;
    setVerifying(true);
    setError(null);
    setResult(null);
    try {
      const r = await api.verifyTrain({ depPlandTimeHHMI, runDt, depPlaceId, arrPlaceId, carOrdr });
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
      await api.upsertPlace({
        id: result.placeId,
        name: `${result.vehicleKndNm ?? '열차'} ${result.trainNo} · ${result.carOrdr}호차`,
        type: 'train',
        detail: `${result.depPlaceNm}→${result.arrPlaceNm} · ${formatPlanTime(result.depPlandTime)} 출발`,
      });
      router.push(`/p/${encodeURIComponent(result.placeId)}`);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <View style={styles.notice}>
          <Text style={styles.noticeText}>좌석권에 적힌 정보로 차량을 식별합니다. 같은 차량 사용자끼리만 묶여요.</Text>
        </View>

        <Text style={styles.label}>
          출발역 *
          {stationsLoading && <Text style={styles.labelSub}> · 역 정보 로딩 중…</Text>}
        </Text>
        <SimpleSuggestInput
          value={depQuery}
          setValue={handleDepChange}
          placeholder="예: 서울, 용산, 부산"
          suggestions={suggestStations(depQuery)}
        />

        <View style={{ height: 18 }} />
        <Text style={styles.label}>도착역 *</Text>
        <SimpleSuggestInput
          value={arrQuery}
          setValue={handleArrChange}
          placeholder="예: 부산, 광주송정"
          suggestions={suggestStations(arrQuery)}
        />

        <View style={{ height: 18 }} />
        <Text style={styles.label}>출발 시각 * <Text style={styles.labelSub}>(좌석권 상단)</Text></Text>
        <View style={styles.timeRow}>
          <TextInput
            value={depHour}
            onChangeText={(v) => { setDepHour(v.replace(/[^0-9]/g, '').slice(0, 2)); setResult(null); }}
            placeholder="시 (예: 11)"
            placeholderTextColor={TOKEN.text3}
            keyboardType="numeric"
            style={[styles.input, !!depHour && styles.inputFilled]}
          />
          <Text style={styles.timeSep}>:</Text>
          <TextInput
            value={depMin}
            onChangeText={(v) => { setDepMin(v.replace(/[^0-9]/g, '').slice(0, 2)); setResult(null); }}
            placeholder="분 (예: 00)"
            placeholderTextColor={TOKEN.text3}
            keyboardType="numeric"
            style={[styles.input, !!depMin && styles.inputFilled]}
          />
        </View>

        <View style={{ height: 18 }} />
        <Text style={styles.label}>몇 호차예요? *</Text>
        <View style={styles.carGrid}>
          {CAR_OPTIONS.map((n) => {
            const active = carOrdr === n;
            return (
              <Pressable
                key={n}
                onPress={() => { setCarOrdr(active ? null : n); setResult(null); }}
                style={[styles.carCell, active && styles.carCellActive]}
              >
                <Text style={[styles.carText, active && { color: '#fff' }]}>{n}</Text>
              </Pressable>
            );
          })}
        </View>

        {result?.matched && (
          <View style={styles.matchOk}>
            <Text style={styles.matchOkTitle}>✓ {result.vehicleKndNm} {result.trainNo} · {result.carOrdr}호차</Text>
            <Text style={styles.matchOkSub}>
              {result.depPlaceNm} {formatPlanTime(result.depPlandTime)} → {result.arrPlaceNm} {formatPlanTime(result.arrPlandTime)}
            </Text>
          </View>
        )}

        {error && (
          <View style={styles.error}>
            <Text style={styles.errorText}>{TRAIN_VERIFY_ERROR_COPY[error] ?? error}</Text>
          </View>
        )}

        <View style={{ height: 12 }} />
        {result?.matched ? (
          <Pressable onPress={confirm} disabled={submitting} style={[styles.submit, submitting && styles.submitDisabled]}>
            {submitting ? <ActivityIndicator color="#fff" /> : <Text style={styles.submitText}>투표하러 가기</Text>}
          </Pressable>
        ) : (
          <Pressable onPress={verify} disabled={!canVerify} style={[styles.submit, !canVerify && styles.submitDisabled]}>
            {verifying ? <ActivityIndicator color="#fff" /> : <Text style={styles.submitText}>운행 확인하기</Text>}
          </Pressable>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: TOKEN.bg },
  scroll: { padding: 20, paddingBottom: 60 },
  notice: { marginBottom: 14, padding: 12, backgroundColor: '#FEF3C7', borderRadius: TOKEN.r.md },
  noticeText: { fontSize: 12, color: '#92400E', lineHeight: 18 },
  label: { fontSize: 12, fontWeight: '700', color: TOKEN.text2, marginBottom: 8, letterSpacing: 0.3 },
  labelSub: { fontWeight: '400', color: TOKEN.text3 },
  input: { padding: 13, borderWidth: 2, borderColor: TOKEN.border, borderRadius: TOKEN.r.md, fontSize: 14, color: TOKEN.text1, backgroundColor: TOKEN.bg, flex: 1 },
  inputFilled: { borderColor: TOKEN.cold },
  timeRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  timeSep: { color: TOKEN.text3, fontSize: 16 },
  carGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  carCell: {
    width: '18%', paddingVertical: 12, backgroundColor: TOKEN.surface,
    borderWidth: 1.5, borderColor: TOKEN.border, borderRadius: TOKEN.r.md, alignItems: 'center',
  },
  carCellActive: { backgroundColor: TOKEN.cold, borderColor: TOKEN.cold },
  carText: { fontSize: 14, fontWeight: '800', color: TOKEN.text1 },
  matchOk: { marginTop: 16, padding: 14, backgroundColor: TOKEN.coldBg, borderWidth: 1.5, borderColor: TOKEN.cold, borderRadius: TOKEN.r.md },
  matchOkTitle: { fontSize: 13, fontWeight: '800', color: TOKEN.cold, marginBottom: 4 },
  matchOkSub: { fontSize: 12, color: TOKEN.text2 },
  error: { marginTop: 14, padding: 10, backgroundColor: TOKEN.hotBg, borderRadius: TOKEN.r.md },
  errorText: { color: TOKEN.hot, fontSize: 12 },
  submit: { marginTop: 16, padding: 16, backgroundColor: TOKEN.cold, borderRadius: TOKEN.r.lg, alignItems: 'center' },
  submitDisabled: { backgroundColor: TOKEN.border },
  submitText: { fontSize: 15, fontWeight: '700', color: '#fff' },
});
