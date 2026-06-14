// '다른 장소 찾기' wizard — 검색 → 등록(로그인 가드) → 성공(link + Share). 디자인 시스템 적용.

import { useCallback, useEffect, useMemo, useState } from 'react';
import { View, ScrollView, StyleSheet, Share, Alert } from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Plus, Lock, Check, Info } from 'lucide-react-native';
import { TOKEN, SPACE, type PlaceType } from '@aircon/core';
import { api, type PlaceWithCounts } from '../../src/lib/apiClient';
import { AppText, Field, Button, Card, ListRow, Chip, EmptyState, Loading } from '../../src/ui';

type Phase = 'search' | 'register' | 'success';

const TYPE_OPTIONS: { value: PlaceType; label: string }[] = [
  { value: 'office', label: '사무실·매장' },
  { value: 'classroom', label: '강의실·회의실' },
  { value: 'cafe', label: '카페·식당' },
  { value: 'library', label: '도서관·자습실' },
  { value: 'other', label: '기타' },
];

export default function CustomPlaceWizard() {
  const [phase, setPhase] = useState<Phase>('search');
  const [created, setCreated] = useState<{ id: string; name: string } | null>(null);
  const onPicked = useCallback((id: string) => router.push(`/p/${encodeURIComponent(id)}`), []);

  if (phase === 'success' && created) return <SuccessScreen placeId={created.id} placeName={created.name} onGoVote={() => onPicked(created.id)} />;
  if (phase === 'register') return <RegisterStep onBack={() => setPhase('search')} onCreated={(c) => { setCreated(c); setPhase('success'); }} />;
  return <SearchStep onPick={onPicked} onGoRegister={() => setPhase('register')} />;
}

function SearchStep({ onPick, onGoRegister }: { onPick: (id: string) => void; onGoRegister: () => void }) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<PlaceWithCounts[]>([]);
  const [loading, setLoading] = useState(false);
  const [touched, setTouched] = useState(false);

  useEffect(() => {
    const q = query.trim();
    if (q.length < 1) { setResults([]); setLoading(false); return; }
    setLoading(true);
    const t = setTimeout(async () => {
      try { const res = await api.searchPublicPlaces(q); setResults(res.places ?? []); }
      catch { setResults([]); }
      finally { setLoading(false); setTouched(true); }
    }, 250);
    return () => clearTimeout(t);
  }, [query]);

  return (
    <SafeAreaView style={styles.safe} edges={['bottom']}>
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <AppText variant="title">어디서 투표할까요?</AppText>
        <AppText variant="body" color={TOKEN.text2} style={styles.hint}>공개된 장소만 보여요. 못 찾으면 아래에서 직접 등록할 수 있어요.</AppText>

        <Field placeholder="장소 이름 검색 (예: 삼성전자, 스타벅스 강남점)" value={query} onChangeText={setQuery} autoFocus returnKeyType="search" />

        {loading && <AppText variant="caption" center color={TOKEN.text3} style={{ marginTop: SPACE.s4 }}>검색 중…</AppText>}

        {!loading && results.length > 0 && (
          <View style={{ gap: SPACE.rowGap, marginTop: SPACE.s4 }}>
            {results.map((p) => <ListRow key={p.id} title={p.name} sub={p.district ?? undefined} onPress={() => onPick(p.id)} />)}
          </View>
        )}

        {!loading && touched && query.trim() !== '' && results.length === 0 && (
          <View style={{ marginTop: SPACE.s4 }}>
            <EmptyState title={`"${query}" 검색 결과가 없어요`} desc="아직 등록 안 된 장소면 직접 만들 수 있어요." />
          </View>
        )}

        <Card onPress={onGoRegister} accessibilityLabel="내 공간 직접 등록" style={styles.cta}>
          <View style={styles.ctaRow}>
            <View style={styles.ctaIcon}><Plus size={20} color="#FFFFFF" /></View>
            <View style={{ flex: 1 }}>
              <AppText variant="bodyLg" weight="bold" color={TOKEN.cold}>내 공간 직접 등록</AppText>
              <AppText variant="caption" color={TOKEN.text2}>사무실·회의실 등 — link로만 공유돼요 (로그인 필요)</AppText>
            </View>
          </View>
        </Card>
      </ScrollView>
    </SafeAreaView>
  );
}

type AuthState = 'unknown' | 'logged-in' | 'logged-out';

function RegisterStep({ onBack, onCreated }: { onBack: () => void; onCreated: (c: { id: string; name: string }) => void }) {
  const [authState, setAuthState] = useState<AuthState>('unknown');
  useEffect(() => { api.me().then((r) => setAuthState(r.user ? 'logged-in' : 'logged-out')).catch(() => setAuthState('logged-out')); }, []);

  if (authState === 'unknown') return <SafeAreaView style={styles.safe}><Loading label="로그인 상태 확인 중…" /></SafeAreaView>;
  if (authState === 'logged-out') {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.gate}>
          <View style={styles.gateIcon}><Lock size={28} color={TOKEN.cold} /></View>
          <AppText variant="title2" center>공간을 등록하려면 로그인이 필요해요</AppText>
          <AppText variant="body" center color={TOKEN.text2}>본인이 등록한 공간만 link로 공유해서 단체 단위 익명 투표를 받을 수 있어요.</AppText>
          <View style={{ marginTop: SPACE.s4, alignSelf: 'stretch' }}>
            <Button label="로그인 페이지로 이동" onPress={() => router.push('/login')} />
          </View>
          <Button label="← 검색으로 돌아가기" variant="ghost" full={false} onPress={onBack} />
        </View>
      </SafeAreaView>
    );
  }
  return <RegisterForm onBack={onBack} onCreated={onCreated} />;
}

function RegisterForm({ onBack, onCreated }: { onBack: () => void; onCreated: (c: { id: string; name: string }) => void }) {
  const [name, setName] = useState('');
  const [type, setType] = useState<PlaceType>('office');
  const [description, setDescription] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const canSubmit = useMemo(() => name.trim().length >= 2 && !submitting, [name, submitting]);

  const submit = async () => {
    if (!canSubmit) return;
    setSubmitting(true); setError(null);
    try {
      const res = await api.createUserPlace({ name: name.trim(), type, description: description.trim() || null });
      onCreated({ id: res.id, name: res.name });
    } catch (e) { setError((e as Error).message || '등록에 실패했어요. 잠시 후 다시 시도해 주세요.'); }
    finally { setSubmitting(false); }
  };

  return (
    <SafeAreaView style={styles.safe} edges={['bottom']}>
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <Button label="← 검색으로" variant="ghost" full={false} onPress={onBack} style={{ alignSelf: 'flex-start', paddingHorizontal: 0, height: 36 }} />
        <AppText variant="title">어떤 공간인가요?</AppText>
        <AppText variant="body" color={TOKEN.text2} style={styles.hint}>내 사무실·회의실·매장 등 자유롭게 등록. link로만 공유되고 검색에는 노출되지 않아요.</AppText>

        <View style={{ gap: SPACE.fieldGap }}>
          <Field label="공간 이름" placeholder="예: 삼성전자 서초사옥 3층 312호" value={name} onChangeText={setName} maxLength={60} autoFocus helper="최대 60자, 2자 이상" />
          <View style={{ gap: SPACE.s2 }}>
            <AppText variant="label" color={TOKEN.text2}>종류</AppText>
            <View style={styles.chips}>
              {TYPE_OPTIONS.map((o) => <Chip key={o.value} label={o.label} active={type === o.value} onPress={() => setType(o.value)} />)}
            </View>
          </View>
          <Field label="짧은 설명 (선택)" placeholder="누구를 위한 공간인지 등 (200자 이내)" value={description} onChangeText={setDescription} maxLength={200} multiline
            style={{ minHeight: 72, textAlignVertical: 'top' }} errorText={error} />
        </View>

        <View style={{ marginTop: SPACE.s6 }}>
          <Button label="공간 등록하기" onPress={submit} loading={submitting} disabled={!canSubmit} />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function SuccessScreen({ placeId, placeName, onGoVote }: { placeId: string; placeName: string; onGoVote: () => void }) {
  const placeUrl = `https://aircondemocracy.com/p/${encodeURIComponent(placeId)}`;
  const share = async () => {
    try { await Share.share({ message: `'${placeName}' 에어컨 온도 투표: ${placeUrl}`, url: placeUrl, title: placeName }); }
    catch (e) { Alert.alert('공유 실패', (e as Error).message); }
  };
  return (
    <SafeAreaView style={styles.safe} edges={['bottom']}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.successTop}>
          <View style={styles.checkBadge}><Check size={28} color={TOKEN.ok} strokeWidth={3} /></View>
          <AppText variant="title" center>등록됐어요</AppText>
          <AppText variant="body" color={TOKEN.text2}>{placeName}</AppText>
        </View>

        <Card style={{ marginTop: SPACE.s4 }}>
          <AppText variant="micro" color={TOKEN.text3}>공유 LINK</AppText>
          <View style={styles.linkBox}><AppText variant="caption" color={TOKEN.text2} numberOfLines={1}>{placeUrl}</AppText></View>
          <View style={{ marginTop: SPACE.s3 }}><Button label="공유하기" onPress={share} /></View>
        </Card>

        <View style={styles.tipRow}>
          <Info size={16} color={TOKEN.text3} />
          <AppText variant="caption" color={TOKEN.text3} style={{ flex: 1 }}>검색에 노출되지 않아요. link로만 접근 가능. 단체 단위 익명 투표를 받을 수 있어요.</AppText>
        </View>

        <View style={{ marginTop: SPACE.s6 }}>
          <Button label="이 공간에서 투표하기" onPress={onGoVote} />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: TOKEN.bg },
  scroll: { padding: SPACE.screenPadding, paddingBottom: SPACE.bottomInset, gap: SPACE.s2 },
  hint: { marginTop: SPACE.s2, marginBottom: SPACE.s4 },
  cta: { marginTop: SPACE.s4, borderStyle: 'dashed', borderColor: TOKEN.cold, borderWidth: 1.5, backgroundColor: TOKEN.coldBg },
  ctaRow: { flexDirection: 'row', alignItems: 'center', gap: SPACE.s3 },
  ctaIcon: { width: 40, height: 40, borderRadius: TOKEN.r.pill, backgroundColor: TOKEN.cold, alignItems: 'center', justifyContent: 'center' },
  gate: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: SPACE.s3, padding: SPACE.s6 },
  gateIcon: { width: 64, height: 64, borderRadius: 32, backgroundColor: TOKEN.coldBg, alignItems: 'center', justifyContent: 'center' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACE.s2 },
  successTop: { alignItems: 'center', gap: SPACE.s2, marginTop: SPACE.s4 },
  checkBadge: { width: 56, height: 56, borderRadius: 28, backgroundColor: TOKEN.okBg, alignItems: 'center', justifyContent: 'center', marginBottom: SPACE.s2 },
  linkBox: { marginTop: SPACE.s2, padding: SPACE.s3, backgroundColor: TOKEN.bg, borderRadius: TOKEN.r.sm },
  tipRow: { flexDirection: 'row', gap: SPACE.s2, marginTop: SPACE.s4, alignItems: 'flex-start' },
});
