// Mobile 고속·시외버스 wizard (RN) — web IntercityBusWizard 포팅.
// TAGO ExpBusInfo / SuburbsBusInfo로 좌석권 검증.

import { useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, TextInput, Pressable, ScrollView, StyleSheet, ActivityIndicator } from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { TOKEN, joinYmdHm, INTERCITY_BUS_VERIFY_ERROR_COPY } from '@aircon/core';
import type { IntercityBusTerminal, IntercityBusVerifyResult } from '@aircon/core';
import { api } from '../../src/lib/apiClient';
import { SimpleSuggestInput } from '../../src/components/SimpleSuggestInput';

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
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <View style={styles.notice}>
          <Text style={styles.noticeText}>승차권에 적힌 정보로 차량을 식별합니다. 같은 차량 사용자끼리만 묶여요.</Text>
        </View>

        <View style={styles.toggleRow}>
          {([
            { v: 'exp', label: '고속버스' },
            { v: 'suburbs', label: '시외버스' },
          ] as const).map(({ v, label }) => {
            const active = kind === v;
            return (
              <Pressable
                key={v}
                onPress={() => setKind(v)}
                style={[styles.toggleBtn, active && styles.toggleBtnActive]}
              >
                <Text style={[styles.toggleText, active && styles.toggleTextActive]}>{label}</Text>
              </Pressable>
            );
          })}
        </View>

        <Text style={styles.label}>출발 터미널 *</Text>
        <SimpleSuggestInput
          value={depQuery}
          setValue={handleDepChange}
          placeholder="예: 서울고속, 센트럴, 동서울"
          suggestions={depSugg.map(labelOf)}
        />

        <View style={{ height: 18 }} />
        <Text style={styles.label}>도착 터미널 *</Text>
        <SimpleSuggestInput
          value={arrQuery}
          setValue={handleArrChange}
          placeholder="예: 부산종합, 대전복합"
          suggestions={arrSugg.map(labelOf)}
        />

        <View style={{ height: 18 }} />
        <Text style={styles.label}>출발 시각 * <Text style={styles.labelSub}>(승차권 정확히)</Text></Text>
        <View style={styles.timeRow}>
          <TextInput
            value={depHour}
            onChangeText={(v) => { setDepHour(v.replace(/[^0-9]/g, '').slice(0, 2)); setResult(null); }}
            placeholder="시 (예: 14)"
            placeholderTextColor={TOKEN.text3}
            keyboardType="numeric"
            style={[styles.input, !!depHour && styles.inputFilled]}
          />
          <Text style={styles.timeSep}>:</Text>
          <TextInput
            value={depMin}
            onChangeText={(v) => { setDepMin(v.replace(/[^0-9]/g, '').slice(0, 2)); setResult(null); }}
            placeholder="분 (예: 30)"
            placeholderTextColor={TOKEN.text3}
            keyboardType="numeric"
            style={[styles.input, !!depMin && styles.inputFilled]}
          />
        </View>

        {result?.matched && (
          <View style={styles.matchOk}>
            <Text style={styles.matchOkTitle}>✓ {result.gradeNm} · {result.depPlaceNm}→{result.arrPlaceNm}</Text>
            <Text style={styles.matchOkSub}>{formatPlanTime(result.depPlandTime)} 출발 → {formatPlanTime(result.arrPlandTime)} 도착</Text>
          </View>
        )}

        {error && (
          <View style={styles.error}>
            <Text style={styles.errorText}>{INTERCITY_BUS_VERIFY_ERROR_COPY[error] ?? error}</Text>
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
  toggleRow: { flexDirection: 'row', backgroundColor: TOKEN.bg, borderWidth: 1, borderColor: TOKEN.border, borderRadius: TOKEN.r.lg, padding: 4, marginBottom: 22 },
  toggleBtn: { flex: 1, paddingVertical: 10, borderRadius: TOKEN.r.md, alignItems: 'center' },
  toggleBtnActive: { backgroundColor: TOKEN.surface },
  toggleText: { fontSize: 13, fontWeight: '700', color: TOKEN.text3 },
  toggleTextActive: { color: TOKEN.text1 },
  label: { fontSize: 12, fontWeight: '700', color: TOKEN.text2, marginBottom: 8, letterSpacing: 0.3 },
  labelSub: { fontWeight: '400', color: TOKEN.text3 },
  input: { padding: 13, borderWidth: 2, borderColor: TOKEN.border, borderRadius: TOKEN.r.md, fontSize: 14, color: TOKEN.text1, backgroundColor: TOKEN.bg, flex: 1 },
  inputFilled: { borderColor: TOKEN.cold },
  timeRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  timeSep: { color: TOKEN.text3, fontSize: 16 },
  matchOk: { marginTop: 16, padding: 14, backgroundColor: TOKEN.coldBg, borderWidth: 1.5, borderColor: TOKEN.cold, borderRadius: TOKEN.r.md },
  matchOkTitle: { fontSize: 13, fontWeight: '800', color: TOKEN.cold, marginBottom: 4 },
  matchOkSub: { fontSize: 12, color: TOKEN.text2 },
  error: { marginTop: 14, padding: 10, backgroundColor: TOKEN.hotBg, borderRadius: TOKEN.r.md },
  errorText: { color: TOKEN.hot, fontSize: 12 },
  submit: { marginTop: 16, padding: 16, backgroundColor: TOKEN.cold, borderRadius: TOKEN.r.lg, alignItems: 'center' },
  submitDisabled: { backgroundColor: TOKEN.border },
  submitText: { fontSize: 15, fontWeight: '700', color: '#fff' },
});
