// Mobile 기차 wizard (RN) — web TrainTagoVerifyWizard 포팅. 디자인 시스템 적용.
// TAGO TrainInfo로 좌석권 정보(출도착역 + 시/분 + 호차) 검증 → placeId 발급.

import { useEffect, useMemo, useState } from 'react';
import { View, ScrollView, StyleSheet } from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Info, Check } from 'lucide-react-native';
import { TOKEN, SPACE, joinYmdHm, TRAIN_VERIFY_ERROR_COPY, parseStationLabel } from '@aircon/core';
import type { TrainVerifyResult } from '@aircon/core';
import { api } from '../../src/lib/apiClient';
import { SimpleSuggestInput } from '../../src/components/SimpleSuggestInput';
import { AppText, Input, Button, Card, SelectionGrid } from '../../src/ui';

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
    <SafeAreaView style={styles.safe} edges={['bottom']}>
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <Card style={styles.notice}>
          <Info size={16} color={TOKEN.cold} />
          <AppText variant="caption" color={TOKEN.text2} style={styles.noticeText}>
            좌석권에 적힌 정보로 차량을 식별합니다. 같은 차량 사용자끼리만 묶여요.
          </AppText>
        </Card>

        <AppText variant="label" color={TOKEN.text2} style={styles.label}>
          출발역{stationsLoading ? '  · 역 정보 로딩 중…' : ''}
        </AppText>
        <SimpleSuggestInput
          value={depQuery}
          setValue={handleDepChange}
          placeholder="예: 서울, 용산, 부산"
          suggestions={suggestStations(depQuery)}
        />

        <AppText variant="label" color={TOKEN.text2} style={[styles.label, styles.labelGap]}>도착역</AppText>
        <SimpleSuggestInput
          value={arrQuery}
          setValue={handleArrChange}
          placeholder="예: 부산, 광주송정"
          suggestions={suggestStations(arrQuery)}
        />

        <AppText variant="label" color={TOKEN.text2} style={[styles.label, styles.labelGap]}>출발 시각  (좌석권 상단)</AppText>
        <View style={styles.timeRow}>
          <Input
            value={depHour}
            onChangeText={(v) => { setDepHour(v.replace(/[^0-9]/g, '').slice(0, 2)); setResult(null); }}
            placeholder="시 (예: 11)"
            keyboardType="numeric"
            style={styles.timeInput}
          />
          <AppText variant="title2" color={TOKEN.text3}>:</AppText>
          <Input
            value={depMin}
            onChangeText={(v) => { setDepMin(v.replace(/[^0-9]/g, '').slice(0, 2)); setResult(null); }}
            placeholder="분 (예: 00)"
            keyboardType="numeric"
            style={styles.timeInput}
          />
        </View>

        <AppText variant="label" color={TOKEN.text2} style={[styles.label, styles.labelGap]}>몇 호차예요?</AppText>
        <SelectionGrid
          columns={5}
          items={CAR_OPTIONS.map((n) => ({ key: String(n), label: String(n) }))}
          selectedKey={carOrdr ? String(carOrdr) : null}
          onSelect={(k) => { const n = Number(k); setCarOrdr(carOrdr === n ? null : n); setResult(null); }}
        />

        {result?.matched && (
          <Card style={styles.matchOk}>
            <View style={styles.matchHead}>
              <Check size={16} color={TOKEN.ok} />
              <AppText variant="label" weight="bold" color={TOKEN.ok}>{result.vehicleKndNm} {result.trainNo} · {result.carOrdr}호차</AppText>
            </View>
            <AppText variant="caption" color={TOKEN.text2} style={{ marginTop: SPACE.s2 }}>
              {result.depPlaceNm} {formatPlanTime(result.depPlandTime)} → {result.arrPlaceNm} {formatPlanTime(result.arrPlandTime)}
            </AppText>
          </Card>
        )}

        {error && (
          <Card style={styles.errorBox}>
            <AppText variant="caption" color={TOKEN.hot}>{TRAIN_VERIFY_ERROR_COPY[error] ?? error}</AppText>
          </Card>
        )}

        <View style={{ marginTop: SPACE.s6 }}>
          {result?.matched ? (
            <Button label="투표하러 가기" onPress={confirm} loading={submitting} />
          ) : (
            <Button label="운행 확인하기" onPress={verify} loading={verifying} disabled={!canVerify} />
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: TOKEN.bg },
  scroll: { padding: SPACE.screenPadding, paddingBottom: SPACE.bottomInset },
  notice: { flexDirection: 'row', gap: SPACE.s2, alignItems: 'flex-start', backgroundColor: TOKEN.coldBg, borderColor: TOKEN.coldBg, marginBottom: SPACE.s5 },
  noticeText: { flex: 1, lineHeight: 17 },
  label: { marginBottom: SPACE.s2 },
  labelGap: { marginTop: SPACE.s5 },
  timeRow: { flexDirection: 'row', alignItems: 'center', gap: SPACE.s2 },
  timeInput: { flex: 1 },
  matchOk: { marginTop: SPACE.s5, backgroundColor: TOKEN.okBg, borderColor: TOKEN.ok, borderWidth: 1.5 },
  matchHead: { flexDirection: 'row', alignItems: 'center', gap: SPACE.s2 },
  errorBox: { marginTop: SPACE.s4, backgroundColor: TOKEN.hotBg, borderColor: TOKEN.hotBg },
});
