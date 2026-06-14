// Mobile 고속·시외버스 wizard (RN) — web IntercityBusWizard 포팅. 디자인 시스템 적용.
// TAGO ExpBusInfo / SuburbsBusInfo로 좌석권 검증.

import { useEffect, useMemo, useRef, useState } from 'react';
import { View, ScrollView, StyleSheet } from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Info, Check } from 'lucide-react-native';
import { TOKEN, SPACE, joinYmdHm, INTERCITY_BUS_VERIFY_ERROR_COPY } from '@aircon/core';
import type { IntercityBusTerminal, IntercityBusVerifyResult } from '@aircon/core';
import { api } from '../../src/lib/apiClient';
import { SimpleSuggestInput } from '../../src/components/SimpleSuggestInput';
import { AppText, Input, Button, Card, SegmentedControl } from '../../src/ui';

type Kind = 'exp' | 'suburbs';

function todayYmd(): string {
  const d = new Date();
  return `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`;
}

function formatPlanTime(s: string | undefined): string {
  if (!s || s.length < 12) return '';
  return `${s.slice(8, 10)}:${s.slice(10, 12)}`;
}

function labelOf(t: IntercityBusTerminal): string {
  return `${t.terminalNm}${t.cityName ? ` (${t.cityName})` : ''}`;
}

export default function IntercityBusWizard() {
  const [kind, setKind] = useState<Kind>('exp');

  const [depQuery, setDepQuery] = useState('');
  const [depTerminalId, setDepTerminalId] = useState('');
  const [depSugg, setDepSugg] = useState<IntercityBusTerminal[]>([]);
  const [arrQuery, setArrQuery] = useState('');
  const [arrTerminalId, setArrTerminalId] = useState('');
  const [arrSugg, setArrSugg] = useState<IntercityBusTerminal[]>([]);
  const depSeq = useRef(0);
  const arrSeq = useRef(0);

  const runDt = useMemo(() => todayYmd(), []);
  const [depHour, setDepHour] = useState('');
  const [depMin, setDepMin] = useState('');

  const [verifying, setVerifying] = useState(false);
  const [result, setResult] = useState<IntercityBusVerifyResult | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setDepQuery(''); setArrQuery('');
    setDepTerminalId(''); setArrTerminalId('');
    setDepSugg([]); setArrSugg([]);
    setResult(null); setError(null);
  }, [kind]);

  useEffect(() => {
    const q = depQuery.trim();
    if (!q || depTerminalId) { setDepSugg([]); return; }
    const mySeq = ++depSeq.current;
    const t = setTimeout(async () => {
      try {
        const { terminals } = await api.listIntercityBusTerminals(kind, { terminalNm: q });
        if (depSeq.current === mySeq) setDepSugg(terminals.slice(0, 8));
      } catch { /* keep */ }
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
      } catch { /* keep */ }
    }, 200);
    return () => clearTimeout(t);
  }, [arrQuery, kind, arrTerminalId]);

  function handleDepChange(v: string) {
    setDepQuery(v); setResult(null);
    const hit = depSugg.find((t) => labelOf(t) === v);
    setDepTerminalId(hit?.terminalId ?? '');
  }
  function handleArrChange(v: string) {
    setArrQuery(v); setResult(null);
    const hit = arrSugg.find((t) => labelOf(t) === v);
    setArrTerminalId(hit?.terminalId ?? '');
  }

  const depPlandTime = useMemo(() => joinYmdHm(runDt, depHour, depMin), [runDt, depHour, depMin]);

  const canVerify = !!depTerminalId && !!arrTerminalId && depPlandTime.length === 12 && !verifying;

  const verify = async () => {
    if (!canVerify) return;
    setVerifying(true); setError(null); setResult(null);
    try {
      const r = await api.verifyIntercityBus(kind, { depTerminalId, arrTerminalId, depPlandTime });
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
            승차권에 적힌 정보로 차량을 식별합니다. 같은 차량 사용자끼리만 묶여요.
          </AppText>
        </Card>

        <View style={{ marginBottom: SPACE.s5 }}>
          <SegmentedControl<Kind>
            options={[{ key: 'exp', label: '고속버스' }, { key: 'suburbs', label: '시외버스' }]}
            value={kind}
            onChange={setKind}
          />
        </View>

        <AppText variant="label" color={TOKEN.text2} style={styles.label}>출발 터미널</AppText>
        <SimpleSuggestInput
          value={depQuery}
          setValue={handleDepChange}
          placeholder="예: 서울고속, 센트럴, 동서울"
          suggestions={depSugg.map(labelOf)}
        />

        <AppText variant="label" color={TOKEN.text2} style={[styles.label, styles.labelGap]}>도착 터미널</AppText>
        <SimpleSuggestInput
          value={arrQuery}
          setValue={handleArrChange}
          placeholder="예: 부산종합, 대전복합"
          suggestions={arrSugg.map(labelOf)}
        />

        <AppText variant="label" color={TOKEN.text2} style={[styles.label, styles.labelGap]}>출발 시각  (승차권 정확히)</AppText>
        <View style={styles.timeRow}>
          <Input
            value={depHour}
            onChangeText={(v) => { setDepHour(v.replace(/[^0-9]/g, '').slice(0, 2)); setResult(null); }}
            placeholder="시 (예: 14)"
            keyboardType="numeric"
            style={styles.timeInput}
          />
          <AppText variant="title2" color={TOKEN.text3}>:</AppText>
          <Input
            value={depMin}
            onChangeText={(v) => { setDepMin(v.replace(/[^0-9]/g, '').slice(0, 2)); setResult(null); }}
            placeholder="분 (예: 30)"
            keyboardType="numeric"
            style={styles.timeInput}
          />
        </View>

        {result?.matched && (
          <Card style={styles.matchOk}>
            <View style={styles.matchHead}>
              <Check size={16} color={TOKEN.ok} />
              <AppText variant="label" weight="bold" color={TOKEN.ok}>{result.gradeNm} · {result.depPlaceNm}→{result.arrPlaceNm}</AppText>
            </View>
            <AppText variant="caption" color={TOKEN.text2} style={{ marginTop: SPACE.s2 }}>
              {formatPlanTime(result.depPlandTime)} 출발 → {formatPlanTime(result.arrPlandTime)} 도착
            </AppText>
          </Card>
        )}

        {error && (
          <Card style={styles.errorBox}>
            <AppText variant="caption" color={TOKEN.hot}>{INTERCITY_BUS_VERIFY_ERROR_COPY[error] ?? error}</AppText>
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
