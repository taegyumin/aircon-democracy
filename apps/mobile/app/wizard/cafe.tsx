// Mobile 카페·음식점 wizard — 2-step:
//   Step 1: 등록된 카페/식당 검색 (api.searchPublicPlaces) — 일치 결과 있으면 그곳으로 투표.
//   Step 2: 못 찾으면 freeform 등록 (가게 이름 + 도로명 주소). 좌표 없이 ghost 우려 → district 사용.
//
// 웹은 Naver 지도 picker 사용 (좌표 기반). 모바일은 RN naver-map SDK 미통합이라 검색 + freeform.
// 추후 react-native-naver-map 또는 WebView embed로 좌표 기반 pick 추가 (v1.1).

import { useEffect, useState } from 'react';
import {
  View, Text, TextInput, Pressable, ScrollView, StyleSheet, ActivityIndicator,
} from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { TOKEN } from '@aircon/core';
import { api, type PlaceWithCounts } from '../../src/lib/apiClient';

type Phase = 'search' | 'register';

export default function CafeWizard() {
  const [phase, setPhase] = useState<Phase>('search');

  if (phase === 'register') {
    return <RegisterStep onBack={() => setPhase('search')} />;
  }
  return <SearchStep onGoRegister={() => setPhase('register')} />;
}

// ───────────────────────── Search ─────────────────────────

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
        // type='cafe' 또는 'other' 만 (cafe wizard 맥락)
        const filtered = (res.places ?? []).filter((p) => p.type === 'cafe' || p.type === 'other');
        setResults(filtered);
      } catch {
        setResults([]);
      } finally {
        setLoading(false);
        setTouched(true);
      }
    }, 250);
    return () => clearTimeout(t);
  }, [query]);

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <Text style={styles.title}>어느 카페·식당이세요?</Text>
        <Text style={styles.hint}>이미 등록된 곳이 있는지 먼저 찾아봅니다. 없으면 직접 등록할 수 있어요.</Text>

        <View style={styles.searchBox}>
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="가게 이름 (예: 스타벅스 강남R점, 백종원)"
            placeholderTextColor={TOKEN.text3}
            style={styles.searchInput}
            autoFocus
          />
          {query.length > 0 && (
            <Pressable onPress={() => setQuery('')} hitSlop={10}><Text style={styles.clearBtn}>×</Text></Pressable>
          )}
        </View>

        {loading && <Text style={styles.loadingText}>검색 중…</Text>}

        {!loading && results.length > 0 && (
          <View style={{ gap: 8, marginBottom: 18 }}>
            {results.map((p) => (
              <Pressable
                key={p.id}
                onPress={() => router.push(`/p/${encodeURIComponent(p.id)}`)}
                style={styles.resultRow}
              >
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={styles.resultName} numberOfLines={1}>{p.name}</Text>
                  {p.district && <Text style={styles.resultSub} numberOfLines={1}>{p.district}</Text>}
                </View>
                <Text style={styles.chevron}>›</Text>
              </Pressable>
            ))}
          </View>
        )}

        {!loading && touched && query.trim() !== '' && results.length === 0 && (
          <View style={styles.emptyBox}>
            <Text style={styles.emptyText}>"{query}" 검색 결과가 없어요.</Text>
            <Text style={styles.emptySub}>아직 등록 안 된 곳이면 직접 등록하실 수 있어요.</Text>
          </View>
        )}

        <Pressable onPress={onGoRegister} style={styles.registerCta}>
          <View style={styles.registerIcon}><Text style={styles.registerPlus}>+</Text></View>
          <View style={{ flex: 1 }}>
            <Text style={styles.registerTitle}>처음 등록하기</Text>
            <Text style={styles.registerSub}>가게 이름과 주소만 입력하면 바로 투표 가능</Text>
          </View>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

// ───────────────────────── Register (freeform) ─────────────────────────

function RegisterStep({ onBack }: { onBack: () => void }) {
  const [name, setName] = useState('');
  const [address, setAddress] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canSubmit = name.trim().length > 0 && address.trim().length > 0 && !submitting;

  const submit = async () => {
    if (!canSubmit) return;
    setSubmitting(true);
    setError(null);
    try {
      // PLACE_ID_RE: /^[a-z][a-z-]*:[\p{L}\p{N}\s,()/:·.\-]{1,180}$/u
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
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <Pressable onPress={onBack} style={{ marginBottom: 8 }}><Text style={styles.backLink}>← 검색으로</Text></Pressable>
        <Text style={styles.title}>가게 정보를 입력해 주세요</Text>
        <Text style={styles.hint}>같은 가게 이름 + 주소끼리 의견이 모입니다. 정확하게 입력해 주세요.</Text>

        <Text style={styles.label}>가게 이름 *</Text>
        <TextInput
          value={name}
          onChangeText={setName}
          placeholder="예: 스타벅스 강남R점"
          placeholderTextColor={TOKEN.text3}
          style={styles.input}
          autoFocus
        />

        <View style={{ height: 12 }} />

        <Text style={styles.label}>도로명 주소 *</Text>
        <TextInput
          value={address}
          onChangeText={setAddress}
          placeholder="예: 서울 강남구 강남대로 396"
          placeholderTextColor={TOKEN.text3}
          style={styles.input}
        />
        <Text style={styles.helper}>도로명 주소를 정확히 입력해 주세요. 같은 가게라도 주소 표기가 다르면 의견이 분리됩니다.</Text>

        {error && <View style={styles.errBox}><Text style={styles.errText}>{error}</Text></View>}

        <Pressable
          onPress={submit}
          disabled={!canSubmit}
          style={[styles.primaryBtn, !canSubmit && styles.primaryBtnDisabled]}
        >
          {submitting
            ? <ActivityIndicator color="#fff" />
            : <Text style={styles.primaryBtnText}>투표하러 가기</Text>}
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: TOKEN.bg },
  scroll: { padding: 20, paddingBottom: 60 },
  title: { fontSize: 22, fontWeight: '900', color: TOKEN.text1, marginBottom: 8, letterSpacing: -0.5, lineHeight: 30 },
  hint: { fontSize: 13, color: TOKEN.text2, marginBottom: 20, lineHeight: 18 },
  searchBox: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: TOKEN.surface, borderWidth: 1.5, borderColor: TOKEN.border, borderRadius: TOKEN.r.lg, paddingHorizontal: 14, marginBottom: 14 },
  searchInput: { flex: 1, paddingVertical: 12, fontSize: 14, color: TOKEN.text1 },
  clearBtn: { fontSize: 22, color: TOKEN.text3 },
  loadingText: { fontSize: 13, color: TOKEN.text3, textAlign: 'center', paddingVertical: 14 },
  resultRow: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12, backgroundColor: TOKEN.surface, borderRadius: TOKEN.r.md, borderWidth: 1, borderColor: TOKEN.border },
  resultName: { fontSize: 14, fontWeight: '700', color: TOKEN.text1, marginBottom: 2 },
  resultSub: { fontSize: 11, color: TOKEN.text2 },
  chevron: { fontSize: 18, color: TOKEN.text3 },
  emptyBox: { padding: 18, backgroundColor: TOKEN.surface, borderRadius: TOKEN.r.md, borderWidth: 1, borderColor: TOKEN.border, alignItems: 'center', marginBottom: 14 },
  emptyText: { fontSize: 13, color: TOKEN.text2, fontWeight: '600', marginBottom: 4 },
  emptySub: { fontSize: 12, color: TOKEN.text3 },
  registerCta: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 16, backgroundColor: TOKEN.coldBg, borderWidth: 1.5, borderColor: TOKEN.cold, borderStyle: 'dashed', borderRadius: TOKEN.r.md, marginTop: 8 },
  registerIcon: { width: 36, height: 36, borderRadius: 18, backgroundColor: TOKEN.cold, alignItems: 'center', justifyContent: 'center' },
  registerPlus: { color: '#fff', fontSize: 22, fontWeight: '700' },
  registerTitle: { fontSize: 14, fontWeight: '700', color: TOKEN.cold, marginBottom: 2 },
  registerSub: { fontSize: 11, color: TOKEN.text2 },
  backLink: { fontSize: 13, color: TOKEN.text2, fontWeight: '600' },
  label: { fontSize: 12, fontWeight: '700', color: TOKEN.text2, marginBottom: 8, letterSpacing: 0.3 },
  input: { padding: 13, borderWidth: 2, borderColor: TOKEN.border, borderRadius: TOKEN.r.md, fontSize: 14, color: TOKEN.text1, backgroundColor: TOKEN.bg },
  helper: { fontSize: 11, color: TOKEN.text3, marginTop: 6, lineHeight: 16 },
  errBox: { marginTop: 14, padding: 10, backgroundColor: TOKEN.hotBg, borderRadius: TOKEN.r.md },
  errText: { color: TOKEN.hot, fontSize: 12 },
  primaryBtn: { marginTop: 22, padding: 14, backgroundColor: TOKEN.cold, borderRadius: TOKEN.r.lg, alignItems: 'center' },
  primaryBtnDisabled: { backgroundColor: TOKEN.border },
  primaryBtnText: { color: '#fff', fontSize: 15, fontWeight: '700' },
});
