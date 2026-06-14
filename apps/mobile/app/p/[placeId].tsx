// 투표 화면 (hero) — 추워요/적당해요/더워요 thermal 투표 + 결과 스펙트럼.
// Anchoring A: counts는 vote 후에만. 디자인 시스템(src/ui) 전면 적용.

import * as React from 'react';
import { View, ScrollView, StyleSheet, Share, Alert } from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ChevronLeft, Share2, Star } from 'lucide-react-native';
import { TOKEN, SPACE, type VoteType, type PlaceDetail } from '@aircon/core';
import { api } from '../../src/lib/apiClient';
import { recordVote } from '../../src/lib/recentPlaces';
import { isFavorite, toggleFavorite } from '../../src/lib/favorites';
import { useUser } from '../../src/lib/useUser';
import { AppText, IconButton, ThermoVote, ResultSpectrum, ErrorState, Loading } from '../../src/ui';

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
      await recordVote({ id: detail.place.id, name: detail.place.name, type: detail.place.type, district: detail.place.district });
      await load();
    } catch {
      // 투표 실패는 조용히 — 다음 폴링/재시도로 회복. 치명적 에러는 load가 처리.
    } finally {
      setSubmitting(false);
    }
  };

  const handleShare = async () => {
    if (!detail) return;
    const placeUrl = `https://aircondemocracy.com/p/${encodeURIComponent(placeId)}`;
    try {
      await Share.share({ message: `'${detail.place.name}' 에어컨 온도 투표: ${placeUrl}`, url: placeUrl, title: detail.place.name });
    } catch (e) {
      Alert.alert('공유 실패', (e as Error).message);
    }
  };

  const handleToggleFav = async () => {
    if (!detail || !user) { router.push('/login'); return; }
    const next = await toggleFavorite({ id: detail.place.id, name: detail.place.name, type: detail.place.type, district: detail.place.district });
    setFaved(next);
  };

  if (loadError) {
    return (
      <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
        <Top onBack={() => router.push('/')} />
        <ErrorState message={loadError} onRetry={load} />
      </SafeAreaView>
    );
  }
  if (!detail) {
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        <Top onBack={() => router.push('/')} />
        <Loading label="불러오는 중…" />
      </SafeAreaView>
    );
  }

  const hasVoted = !!detail.me;

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <Top
        onBack={() => router.push('/')}
        onShare={handleShare}
        onFav={handleToggleFav}
        faved={user ? faved : false}
      />
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.placeBox}>
          <AppText variant="display">{detail.place.name}</AppText>
          {detail.place.district ? <AppText variant="body" color={TOKEN.text3} style={{ marginTop: SPACE.s2 }}>{detail.place.district}</AppText> : null}
        </View>

        <AppText variant="title2" color={TOKEN.text2} style={styles.q}>지금 이 공간, 어때요?</AppText>

        <ThermoVote selected={detail.me?.vote ?? null} onVote={handleVote} disabled={submitting} />

        {hasVoted && (
          <View style={styles.result}>
            <ResultSpectrum votes={detail.votes} />
          </View>
        )}

        {!hasVoted && (
          <AppText variant="caption" center color={TOKEN.text3} style={{ marginTop: SPACE.s5 }}>
            한 표 던지면 같은 공간 사람들의 의견이 보여요
          </AppText>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function Top({ onBack, onShare, onFav, faved }: { onBack: () => void; onShare?: () => void; onFav?: () => void; faved?: boolean }) {
  return (
    <View style={styles.top}>
      <IconButton label="뒤로" onPress={onBack}><ChevronLeft size={24} color={TOKEN.text1} /></IconButton>
      <View style={{ flex: 1 }} />
      {onShare && <IconButton label="공유" onPress={onShare}><Share2 size={22} color={TOKEN.text2} /></IconButton>}
      {onFav && <IconButton label={faved ? '즐겨찾기 해제' : '즐겨찾기'} onPress={onFav}>
        <Star size={22} color={faved ? '#F59E0B' : TOKEN.text3} fill={faved ? '#F59E0B' : 'none'} />
      </IconButton>}
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: TOKEN.bg },
  top: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: SPACE.s3, paddingVertical: SPACE.s2 },
  scroll: { padding: SPACE.screenPadding, paddingBottom: SPACE.bottomInset },
  placeBox: { marginTop: SPACE.s4, marginBottom: SPACE.s6 },
  q: { marginBottom: SPACE.s4 },
  result: { marginTop: SPACE.s7 },
});
