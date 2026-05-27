// Mobile VoteScreen — 추워요/적당해요/더워요 + 결과 + 즐겨찾기 + 최근 방문 기록.
// Anchoring A: counts는 vote 후에만 표시.

import * as React from 'react';
import { View, Text, Pressable, StyleSheet, ActivityIndicator } from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg';
import { TOKEN, VOTE_CONFIG, type VoteType, type PlaceDetail } from '@aircon/core';
import { api } from '../../src/lib/apiClient';
import { recordVote } from '../../src/lib/recentPlaces';
import { isFavorite, toggleFavorite } from '../../src/lib/favorites';
import { useUser } from '../../src/lib/useUser';

const POLL_MS = 5000;

export default function VoteScreen() {
  const params = useLocalSearchParams<{ placeId: string }>();
  const placeId = decodeURIComponent(params.placeId ?? '');
  const { user } = useUser();
  const [detail, setDetail] = React.useState<PlaceDetail | null>(null);
  const [loadError, setLoadError] = React.useState<string | null>(null);
  const [submitting, setSubmitting] = React.useState(false);
  const [faved, setFaved] = React.useState(false);
  const pollRef = React.useRef<ReturnType<typeof setInterval> | null>(null);

  const load = React.useCallback(async () => {
    try {
      const body = await api.getPlace(placeId);
      setDetail(body);
      setLoadError(null);
    } catch (e) {
      setLoadError((e as Error).message);
    }
  }, [placeId]);

  React.useEffect(() => {
    load();
    pollRef.current = setInterval(load, POLL_MS);
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [load]);

  React.useEffect(() => { isFavorite(placeId).then(setFaved); }, [placeId]);

  const handleVote = async (vote: VoteType) => {
    if (!detail || submitting) return;
    setSubmitting(true);
    try {
      await api.vote(placeId, vote);
      // 최근 방문 기록 (anonymous, AsyncStorage)
      await recordVote({
        id: detail.place.id,
        name: detail.place.name,
        type: detail.place.type,
        district: detail.place.district,
      });
      await load();
    } catch (e) {
      setLoadError((e as Error).message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleToggleFav = async () => {
    if (!detail || !user) return;
    const next = await toggleFavorite({
      id: detail.place.id,
      name: detail.place.name,
      type: detail.place.type,
      district: detail.place.district,
    });
    setFaved(next);
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
    <SafeAreaView style={styles.safe} edges={['top']}>
      {/* 상단 — 뒤로 + 즐겨찾기 */}
      <View style={styles.topBar}>
        <Pressable onPress={() => router.push('/')} hitSlop={8}>
          <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
            <Path d="M15 18l-6-6 6-6" stroke={TOKEN.text1} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
          </Svg>
        </Pressable>
        <View style={{ flex: 1 }} />
        <Pressable
          onPress={user ? handleToggleFav : () => router.push('/login')}
          hitSlop={8}
          accessibilityLabel={!user ? '로그인 후 즐겨찾기' : faved ? '즐겨찾기 해제' : '즐겨찾기 추가'}
        >
          <Svg width={22} height={22} viewBox="0 0 24 24" fill={user && faved ? '#F59E0B' : 'none'}>
            <Path
              d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"
              stroke={user && faved ? '#F59E0B' : TOKEN.text3}
              strokeWidth={2}
              strokeLinejoin="round"
            />
          </Svg>
        </Pressable>
      </View>

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
                style={[
                  styles.voteBtn,
                  { backgroundColor: cfg.bg, borderColor: cfg.color },
                  active && { borderWidth: 3 },
                ]}
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
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: TOKEN.bg },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: TOKEN.surface,
    borderBottomWidth: 1,
    borderBottomColor: TOKEN.border,
  },
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
});
