// Mobile 버스 wizard — 노선 + 정류장 입력 후 차량 매칭 (서버에 호출).

import { useState } from 'react';
import { View, Text, TextInput, Pressable, ScrollView, StyleSheet, ActivityIndicator } from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { TOKEN, buildBusPlace, type BusMatchResult } from '@aircon/core';
import { API_BASE } from '../../src/lib/apiClient';

export default function BusWizard() {
  const [route, setRoute] = useState('');
  const [stop, setStop] = useState('');
  const [match, setMatch] = useState<BusMatchResult | null>(null);
  const [matchLoading, setMatchLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const tryMatch = async () => {
    if (!route.trim() || !stop.trim()) return;
    setMatchLoading(true);
    setMatch(null);
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
      // builder를 @aircon/core에서 import — web과 같은 id schema 보장.
      // 이전엔 mobile이 'bus:vehicle:<vehId>' (routeId 누락) 형식이라 노선 변경
      // 시 bucket 충돌. LLM 리뷰 P2.
      const payload = buildBusPlace({ routeName: route, stopName: stop, match });
      const res = await fetch(`${API_BASE}/api/places/upsert`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Aircon-Intent': 'user-action', Origin: API_BASE },
        body: JSON.stringify(payload),
      });
      // res.ok 체크 없으면 server 400/500이어도 그냥 navigate (잘못된 place 등장).
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
          onChangeText={(v) => { setRoute(v); setMatch(null); }}
          placeholder="예: 272, 5511, M7106"
          placeholderTextColor={TOKEN.text3}
          style={styles.input}
          autoFocus
        />

        <View style={{ height: 12 }} />

        <Text style={styles.label}>지나는 정류장 *</Text>
        <TextInput
          value={stop}
          onChangeText={(v) => { setStop(v); setMatch(null); }}
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
                  <Text style={styles.matchTitle}>{match.routeName}번 · 차량번호 {match.plainNo}</Text>
                  {match.currentStop && <Text style={styles.matchSub}>{match.currentStop} 지나는 중{match.nextStop ? ` · 다음 ${match.nextStop}` : ''}</Text>}
                </>
              : <Text style={styles.matchFail}>
                  {match.reason === 'no_vehicle_at_stop' ? '근처에 차량이 없어요. 노선 단위로 투표할게요.'
                    : match.reason === 'no_api_key' ? 'API 키 활성화 대기 중. 노선 단위로 투표할게요.'
                    : '매칭 실패. 노선 단위로 투표할게요.'}
                </Text>}
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
