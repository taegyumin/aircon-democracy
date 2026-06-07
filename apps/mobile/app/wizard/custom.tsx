// Mobile '다른 장소 찾기' wizard — web CustomPlaceWizard RN 포팅.
// 3 phase: search (공개 장소 검색) → register (로그인 가드 + 폼) → success (link + native Share).

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View, Text, TextInput, Pressable, ScrollView, StyleSheet, ActivityIndicator, Share, Alert,
} from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { TOKEN, type PlaceType } from '@aircon/core';
import { api, type PlaceWithCounts } from '../../src/lib/apiClient';

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

  const onPicked = useCallback((placeId: string) => {
    router.push(`/p/${encodeURIComponent(placeId)}`);
  }, []);

  if (phase === 'success' && created) {
    return (
      <SuccessScreen
        placeId={created.id}
        placeName={created.name}
        onGoVote={() => onPicked(created.id)}
      />
    );
  }
  if (phase === 'register') {
    return (
      <RegisterStep
        onBack={() => setPhase('search')}
        onCreated={(c) => { setCreated(c); setPhase('success'); }}
      />
    );
  }
  return (
    <SearchStep
      onPick={onPicked}
      onGoRegister={() => setPhase('register')}
    />
  );
}

// ───────────────────────── Search ─────────────────────────

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
      try {
        const res = await api.searchPublicPlaces(q);
        setResults(res.places ?? []);
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
        <Text style={styles.title}>어디서 투표할까요?</Text>
        <Text style={styles.hint}>공개된 장소만 보여요. 못 찾으면 아래에서 직접 등록할 수 있어요.</Text>

        <View style={styles.searchBox}>
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="장소 이름 검색 (예: 삼성전자, 스타벅스 강남점)"
            placeholderTextColor={TOKEN.text3}
            style={styles.searchInput}
            autoFocus
          />
          {query.length > 0 && (
            <Pressable onPress={() => setQuery('')} hitSlop={10}><Text style={styles.clearBtn}>×</Text></Pressable>
          )}
        </View>

        {loading && <Text style={styles.searchHint}>검색 중…</Text>}

        {!loading && results.length > 0 && (
          <View style={{ gap: 8, marginBottom: 18 }}>
            {results.map((p) => (
              <Pressable key={p.id} onPress={() => onPick(p.id)} style={styles.resultRow}>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={styles.resultName} numberOfLines={1}>{p.name}</Text>
                  {(p.district || p.type) && (
                    <Text style={styles.resultSub} numberOfLines={1}>
                      {p.district ? `${p.district} · ` : ''}{p.type}
                    </Text>
                  )}
                </View>
                <Text style={styles.chevron}>›</Text>
              </Pressable>
            ))}
          </View>
        )}

        {!loading && touched && query.trim() !== '' && results.length === 0 && (
          <View style={styles.emptyBox}>
            <Text style={styles.emptyText}>"{query}" 검색 결과가 없어요.</Text>
            <Text style={styles.emptySub}>아직 등록 안 된 장소면 직접 만들 수 있어요.</Text>
          </View>
        )}

        <Pressable onPress={onGoRegister} style={styles.registerCta}>
          <View style={styles.registerIcon}><Text style={styles.registerPlus}>+</Text></View>
          <View style={{ flex: 1 }}>
            <Text style={styles.registerTitle}>내 공간 직접 등록</Text>
            <Text style={styles.registerSub}>사무실·회의실 등 — link로만 공유돼요 (로그인 필요)</Text>
          </View>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

// ───────────────────────── Register ─────────────────────────

type AuthState = 'unknown' | 'logged-in' | 'logged-out';

function RegisterStep({ onBack, onCreated }: { onBack: () => void; onCreated: (c: { id: string; name: string }) => void }) {
  const [authState, setAuthState] = useState<AuthState>('unknown');

  useEffect(() => {
    api.me()
      .then((res) => setAuthState(res.user ? 'logged-in' : 'logged-out'))
      .catch(() => setAuthState('logged-out'));
  }, []);

  if (authState === 'unknown') {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.centerBox}>
          <ActivityIndicator color={TOKEN.cold} />
          <Text style={styles.centerHint}>로그인 상태 확인 중…</Text>
        </View>
      </SafeAreaView>
    );
  }
  if (authState === 'logged-out') {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.centerBox}>
          <Text style={styles.lockIcon}>🔒</Text>
          <Text style={styles.title}>공간을 등록하려면 로그인이 필요해요</Text>
          <Text style={styles.hint}>
            본인이 등록한 공간만 link로 공유해서 단체 단위 익명 투표를 받을 수 있어요.
          </Text>
          <Pressable onPress={() => router.push('/login')} style={styles.primaryBtn}>
            <Text style={styles.primaryBtnText}>로그인 페이지로 이동</Text>
          </Pressable>
          <Pressable onPress={onBack} style={{ marginTop: 14 }}>
            <Text style={styles.backLink}>← 검색으로 돌아가기</Text>
          </Pressable>
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
    setSubmitting(true);
    setError(null);
    try {
      const res = await api.createUserPlace({
        name: name.trim(),
        type,
        description: description.trim() || null,
      });
      onCreated({ id: res.id, name: res.name });
    } catch (e) {
      setError((e as Error).message || '등록에 실패했어요. 잠시 후 다시 시도해 주세요.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <Pressable onPress={onBack} style={{ marginBottom: 8 }}><Text style={styles.backLink}>← 검색으로</Text></Pressable>
        <Text style={styles.title}>어떤 공간인가요?</Text>
        <Text style={styles.hint}>내 사무실·회의실·매장 등 자유롭게 등록. link로만 공유되고 검색에는 노출되지 않아요.</Text>

        <Text style={styles.label}>공간 이름 *</Text>
        <TextInput
          value={name}
          onChangeText={setName}
          placeholder="예: 삼성전자 서초사옥 3층 312호"
          placeholderTextColor={TOKEN.text3}
          maxLength={60}
          style={styles.input}
          autoFocus
        />
        <Text style={styles.helper}>최대 60자, 2자 이상</Text>

        <View style={{ height: 14 }} />
        <Text style={styles.label}>종류 *</Text>
        <View style={styles.typeGrid}>
          {TYPE_OPTIONS.map((opt) => (
            <Pressable
              key={opt.value}
              onPress={() => setType(opt.value)}
              style={[styles.typeChip, type === opt.value && styles.typeChipActive]}
            >
              <Text style={[styles.typeChipText, type === opt.value && styles.typeChipTextActive]}>{opt.label}</Text>
            </Pressable>
          ))}
        </View>

        <View style={{ height: 14 }} />
        <Text style={styles.label}>짧은 설명 (선택)</Text>
        <TextInput
          value={description}
          onChangeText={setDescription}
          placeholder="누구를 위한 공간인지, 어디인지 등 (200자 이내)"
          placeholderTextColor={TOKEN.text3}
          maxLength={200}
          multiline
          numberOfLines={3}
          style={[styles.input, styles.inputMultiline]}
        />
        <Text style={styles.helper}>{description.length}/200</Text>

        {error && <View style={styles.errBox}><Text style={styles.errText}>{error}</Text></View>}

        <Pressable
          onPress={submit}
          disabled={!canSubmit}
          style={[styles.primaryBtn, !canSubmit && styles.primaryBtnDisabled]}
        >
          {submitting
            ? <ActivityIndicator color="#fff" />
            : <Text style={styles.primaryBtnText}>공간 등록하기</Text>}
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

// ───────────────────────── Success ─────────────────────────

function SuccessScreen({ placeId, placeName, onGoVote }: { placeId: string; placeName: string; onGoVote: () => void }) {
  const placeUrl = `https://aircondemocracy.com/p/${encodeURIComponent(placeId)}`;

  const share = async () => {
    try {
      await Share.share({
        message: `'${placeName}' 에어컨 온도 투표: ${placeUrl}`,
        url: placeUrl,
        title: placeName,
      });
    } catch (e) {
      Alert.alert('공유 실패', (e as Error).message);
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <View style={styles.successCenter}>
          <View style={styles.checkBadge}><Text style={styles.checkText}>✓</Text></View>
          <Text style={styles.successTitle}>등록됐어요</Text>
          <Text style={styles.successName}>{placeName}</Text>
        </View>

        <View style={styles.linkBox}>
          <Text style={styles.linkLabel}>공유 LINK</Text>
          <View style={styles.linkValueBox}>
            <Text style={styles.linkValue} numberOfLines={1}>{placeUrl}</Text>
          </View>
          <Pressable onPress={share} style={styles.primaryBtn}>
            <Text style={styles.primaryBtnText}>공유하기</Text>
          </Pressable>
        </View>

        <Text style={styles.tip}>
          📌 검색에 노출되지 않아요. link로만 접근 가능.{'\n'}
          📌 단체 단위 익명 투표를 받을 수 있어요.
        </Text>

        <Pressable onPress={onGoVote} style={[styles.primaryBtn, { marginTop: 24 }]}>
          <Text style={styles.primaryBtnText}>이 공간에서 투표하기</Text>
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
  searchHint: { fontSize: 13, color: TOKEN.text3, textAlign: 'center', paddingVertical: 14 },
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
  centerBox: { flex: 1, padding: 24, alignItems: 'center', justifyContent: 'center', gap: 12 },
  centerHint: { fontSize: 12, color: TOKEN.text3 },
  lockIcon: { fontSize: 40, marginBottom: 6 },
  backLink: { fontSize: 13, color: TOKEN.text2, fontWeight: '600' },
  label: { fontSize: 12, fontWeight: '700', color: TOKEN.text2, marginBottom: 8, letterSpacing: 0.3 },
  input: { padding: 13, borderWidth: 2, borderColor: TOKEN.border, borderRadius: TOKEN.r.md, fontSize: 14, color: TOKEN.text1, backgroundColor: TOKEN.bg },
  inputMultiline: { minHeight: 72, textAlignVertical: 'top' },
  helper: { fontSize: 11, color: TOKEN.text3, marginTop: 6 },
  typeGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  typeChip: { paddingHorizontal: 14, paddingVertical: 10, backgroundColor: TOKEN.surface, borderWidth: 1.5, borderColor: TOKEN.border, borderRadius: TOKEN.r.md },
  typeChipActive: { backgroundColor: TOKEN.cold, borderColor: TOKEN.cold },
  typeChipText: { fontSize: 13, fontWeight: '700', color: TOKEN.text1 },
  typeChipTextActive: { color: '#fff' },
  errBox: { marginTop: 14, padding: 10, backgroundColor: TOKEN.hotBg, borderRadius: TOKEN.r.md },
  errText: { color: TOKEN.hot, fontSize: 12 },
  primaryBtn: { marginTop: 22, padding: 14, backgroundColor: TOKEN.cold, borderRadius: TOKEN.r.lg, alignItems: 'center' },
  primaryBtnDisabled: { backgroundColor: TOKEN.border },
  primaryBtnText: { color: '#fff', fontSize: 15, fontWeight: '700' },
  successCenter: { alignItems: 'center', marginBottom: 22, gap: 8 },
  checkBadge: { width: 56, height: 56, borderRadius: 28, backgroundColor: '#F0FDF4', alignItems: 'center', justifyContent: 'center', marginBottom: 4 },
  checkText: { fontSize: 28, color: TOKEN.ok },
  successTitle: { fontSize: 19, fontWeight: '900', color: TOKEN.text1, letterSpacing: -0.4 },
  successName: { fontSize: 13, color: TOKEN.text2 },
  linkBox: { padding: 18, backgroundColor: TOKEN.surface, borderRadius: TOKEN.r.lg, borderWidth: 1, borderColor: TOKEN.border },
  linkLabel: { fontSize: 11, fontWeight: '700', color: TOKEN.text3, letterSpacing: 1, marginBottom: 10 },
  linkValueBox: { padding: 10, backgroundColor: TOKEN.bg, borderRadius: TOKEN.r.sm },
  linkValue: { fontSize: 12, color: TOKEN.text2, fontFamily: 'Menlo' },
  tip: { fontSize: 12, color: TOKEN.text3, lineHeight: 18, marginTop: 14, paddingHorizontal: 4 },
});
