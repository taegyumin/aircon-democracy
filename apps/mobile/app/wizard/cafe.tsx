// 카페·음식점 wizard — 검색(등록된 곳) → 없으면 freeform 등록. 디자인 시스템 적용.

import { useEffect, useState } from 'react';
import { View, ScrollView, StyleSheet } from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Plus } from 'lucide-react-native';
import { TOKEN, SPACE } from '@aircon/core';
import { api, type PlaceWithCounts } from '../../src/lib/apiClient';
import { AppText, Field, Button, Card, ListRow, EmptyState } from '../../src/ui';

type Phase = 'search' | 'register';

export default function CafeWizard() {
  const [phase, setPhase] = useState<Phase>('search');
  if (phase === 'register') return <RegisterStep onBack={() => setPhase('search')} />;
  return <SearchStep onGoRegister={() => setPhase('register')} />;
}

function SearchStep({ onGoRegister }: { onGoRegister: () => void }) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<PlaceWithCounts[]>([]);
  const [loading, setLoading] = useState(false);
  const [touched, setTouched] = useState(false);

  useEffect(() => {
    const q = query.trim();
    if (q.length < 1) { setResults([]); setLoading(false); return; }
    setLoading(true);
    const t = setTimeout(async () => {
      try {
        const res = await api.searchPublicPlaces(q);
        setResults((res.places ?? []).filter((p) => p.type === 'cafe' || p.type === 'other'));
      } catch { setResults([]); }
      finally { setLoading(false); setTouched(true); }
    }, 250);
    return () => clearTimeout(t);
  }, [query]);

  return (
    <SafeAreaView style={styles.safe} edges={['bottom']}>
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <AppText variant="title">어느 카페·식당이세요?</AppText>
        <AppText variant="body" color={TOKEN.text2} style={styles.hint}>이미 등록된 곳이 있는지 먼저 찾아봅니다. 없으면 직접 등록할 수 있어요.</AppText>

        <Field placeholder="가게 이름 (예: 스타벅스 강남R점)" value={query} onChangeText={setQuery} autoFocus returnKeyType="search" />

        {loading && <AppText variant="caption" center color={TOKEN.text3} style={{ marginTop: SPACE.s4 }}>검색 중…</AppText>}

        {!loading && results.length > 0 && (
          <View style={{ gap: SPACE.rowGap, marginTop: SPACE.s4 }}>
            {results.map((p) => (
              <ListRow key={p.id} title={p.name} sub={p.district ?? undefined} onPress={() => router.push(`/p/${encodeURIComponent(p.id)}`)} />
            ))}
          </View>
        )}

        {!loading && touched && query.trim() !== '' && results.length === 0 && (
          <View style={{ marginTop: SPACE.s4 }}>
            <EmptyState title={`"${query}" 검색 결과가 없어요`} desc="아직 등록 안 된 곳이면 직접 등록하실 수 있어요." />
          </View>
        )}

        <Card onPress={onGoRegister} accessibilityLabel="처음 등록하기" style={styles.cta}>
          <View style={styles.ctaRow}>
            <View style={styles.ctaIcon}><Plus size={20} color="#FFFFFF" /></View>
            <View style={{ flex: 1 }}>
              <AppText variant="bodyLg" weight="bold" color={TOKEN.cold}>처음 등록하기</AppText>
              <AppText variant="caption" color={TOKEN.text2}>가게 이름과 주소만 입력하면 바로 투표 가능</AppText>
            </View>
          </View>
        </Card>
      </ScrollView>
    </SafeAreaView>
  );
}

function RegisterStep({ onBack }: { onBack: () => void }) {
  const [name, setName] = useState('');
  const [address, setAddress] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canSubmit = name.trim().length > 0 && address.trim().length > 0 && !submitting;

  const submit = async () => {
    if (!canSubmit) return;
    setSubmitting(true); setError(null);
    try {
      const sanitize = (s: string) => s.trim().replace(/\s+/g, '-').replace(/[^\p{L}\p{N},()/:·.\-]/gu, '').slice(0, 40);
      const id = `other:freeform:${sanitize(address)}:${sanitize(name)}`;
      await api.upsertPlace({ id, name: name.trim(), type: 'other', district: address.trim() });
      router.push(`/p/${encodeURIComponent(id)}`);
    } catch (e) {
      setError((e as Error).message || '장소 등록에 실패했어요. 잠시 후 다시 시도해 주세요.');
      setSubmitting(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe} edges={['bottom']}>
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <Button label="← 검색으로" variant="ghost" full={false} onPress={onBack} style={{ alignSelf: 'flex-start', paddingHorizontal: 0, height: 36 }} />
        <AppText variant="title">가게 정보를 입력해 주세요</AppText>
        <AppText variant="body" color={TOKEN.text2} style={styles.hint}>같은 가게 이름 + 주소끼리 의견이 모입니다. 정확하게 입력해 주세요.</AppText>

        <View style={{ gap: SPACE.fieldGap }}>
          <Field label="가게 이름" placeholder="예: 스타벅스 강남R점" value={name} onChangeText={setName} autoFocus />
          <Field label="도로명 주소" placeholder="예: 서울 강남구 강남대로 396" value={address} onChangeText={setAddress}
            helper="같은 가게라도 주소 표기가 다르면 의견이 분리됩니다." errorText={error} />
        </View>

        <View style={{ marginTop: SPACE.s6 }}>
          <Button label="투표하러 가기" onPress={submit} loading={submitting} disabled={!canSubmit} />
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
});
