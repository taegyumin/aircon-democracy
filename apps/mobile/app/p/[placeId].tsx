// Mobile VoteScreen — 3개 vote 버튼 + 결과 표시 + anchoring A 가드.
// 가장 핵심 화면. 진입 후 30초 안에 투표 가능해야 함.

import { useCallback, useEffect, useRef, useState } from 'react';
import { View, Text, Pressable, StyleSheet, ActivityIndicator } from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { TOKEN, VOTE_CONFIG, type VoteType, type PlaceDetail } from '@aircon/core';
import { API_BASE } from '../../src/lib/apiClient';

const POLL_MS = 5000;

export default function VoteScreen() {
  const params = useLocalSearchParams<{ placeId: string }>();
  const placeId = decodeURIComponent(params.placeId ?? '');
  const [detail, setDetail] = useState<PlaceDetail | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/api/places/${encodeURIComponent(placeId)}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const body = (await res.json()) as PlaceDetail;
      setDetail(body);
      setLoadError(null);
    } catch (e) {
      setLoadError((e as Error).message);
    }
  }, [placeId]);

  useEffect(() => {
    load();
    pollRef.current = setInterval(load, POLL_MS);
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [load]);

  const handleVote = async (vote: VoteType) => {
    if (!detail || submitting) return;
    setSubmitting(true);
    try {
      await fetch(`${API_BASE}/api/places/${encodeURIComponent(placeId)}/vote`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Aircon-Intent': 'user-action', Origin: API_BASE },
        body: JSON.stringify({ vote }),
      });
      await load();
    } catch (e) {
      setLoadError((e as Error).message);
    } finally {
      setSubmitting(false);
    }
  };

  if (!detail && !loadError) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.center}><ActivityIndicator color={TOKEN.cold} /></View>
      </SafeAreaView>
    );
  }
  if (loadError) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.center}>
          <Text style={styles.errText}>불러오기 실패: {loadError}</Text>
          <Pressable onPress={load} style={styles.retry}><Text style={styles.retryText}>다시 시도</Text></Pressable>
        </View>
      </SafeAreaView>
    );
  }
  if (!detail) return null;

  const total = detail.votes.cold + detail.votes.ok + detail.votes.hot;
  const hasVoted = !!detail.me;

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.body}>
        <View style={styles.placeBox}>
          <Text style={styles.placeName}>{detail.place.name}</Text>
          {detail.place.district && <Text style={styles.placeDistrict}>{detail.place.district}</Text>}
        </View>

        <Text style={styles.q}>지금 이 공간 에어컨, 어때요?</Text>

        <View style={styles.voteRow}>
          {(['cold', 'ok', 'hot'] as const).map((t) => {
            const cfg = VOTE_CONFIG[t];
            const active = detail.me?.vote === t;
            return (
              <Pressable
                key={t}
                onPress={() => handleVote(t)}
                disabled={submitting}
                style={[styles.voteBtn, { backgroundColor: cfg.bg, borderColor: cfg.color }, active && { borderWidth: 3 }]}
              >
                <Text style={[styles.voteText, { color: cfg.color }]}>{cfg.label}</Text>
              </Pressable>
            );
          })}
        </View>

        {/* Anchoring A: counts는 vote 후에만 표시 */}
        {hasVoted && total > 0 && (
          <View style={styles.resultBox}>
            <Text style={styles.resultLabel}>지금까지 {total}명 의견</Text>
            <View style={styles.bars}>
              {(['cold', 'ok', 'hot'] as const).map((t) => {
                const n = detail.votes[t];
                const pct = total > 0 ? Math.round((n / total) * 100) : 0;
                const cfg = VOTE_CONFIG[t];
                return (
                  <View key={t} style={styles.bar}>
                    <View style={styles.barHeader}>
                      <Text style={[styles.barLabel, { color: cfg.color }]}>{cfg.label}</Text>
                      <Text style={styles.barPct}>{pct}%</Text>
                    </View>
                    <View style={styles.barTrack}>
                      <View style={[styles.barFill, { width: `${pct}%`, backgroundColor: cfg.color }]} />
                    </View>
                  </View>
                );
              })}
            </View>
          </View>
        )}

        <Pressable onPress={() => router.push('/')} style={styles.home}><Text style={styles.homeText}>← 홈으로</Text></Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: TOKEN.bg },
  body: { flex: 1, padding: 20 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 20 },
  errText: { color: TOKEN.hot, fontSize: 14, marginBottom: 16 },
  retry: { padding: 12, backgroundColor: TOKEN.cold, borderRadius: TOKEN.r.md },
  retryText: { color: '#fff', fontSize: 14, fontWeight: '700' },
  placeBox: { padding: 16, backgroundColor: TOKEN.surface, borderRadius: TOKEN.r.lg, marginBottom: 24 },
  placeName: { fontSize: 18, fontWeight: '800', color: TOKEN.text1 },
  placeDistrict: { fontSize: 12, color: TOKEN.text3, marginTop: 4 },
  q: { fontSize: 16, fontWeight: '700', color: TOKEN.text1, textAlign: 'center', marginBottom: 18 },
  voteRow: { flexDirection: 'row', gap: 8 },
  voteBtn: { flex: 1, padding: 24, borderRadius: TOKEN.r.lg, borderWidth: 1.5, alignItems: 'center' },
  voteText: { fontSize: 17, fontWeight: '900' },
  resultBox: { marginTop: 28, padding: 16, backgroundColor: TOKEN.surface, borderRadius: TOKEN.r.lg },
  resultLabel: { fontSize: 12, color: TOKEN.text2, marginBottom: 12 },
  bars: { gap: 8 },
  bar: { gap: 4 },
  barHeader: { flexDirection: 'row', justifyContent: 'space-between' },
  barLabel: { fontSize: 12, fontWeight: '700' },
  barPct: { fontSize: 12, color: TOKEN.text3, fontVariant: ['tabular-nums'] },
  barTrack: { height: 6, backgroundColor: TOKEN.bg, borderRadius: 3, overflow: 'hidden' },
  barFill: { height: '100%', borderRadius: 3 },
  home: { marginTop: 'auto', padding: 12, alignItems: 'center' },
  homeText: { fontSize: 13, color: TOKEN.text2 },
});
