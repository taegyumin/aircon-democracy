// Mobile 강의실 wizard — university picker (서울대 / 연세대).
// 각 대학 detail은 후속 sprint에서 추가 (현재는 단순 학교 단위 vote).

import { useState } from 'react';
import { View, Text, Pressable, ScrollView, StyleSheet, TextInput, ActivityIndicator } from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { TOKEN, snu, yonsei } from '@aircon/core';
import { api } from '../../src/lib/apiClient';

type Univ = 'snu' | 'yonsei' | null;

export default function ClassroomWizard() {
  const [univ, setUniv] = useState<Univ>(null);
  const [building, setBuilding] = useState('');
  const [room, setRoom] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (univ === null) {
    return (
      <SafeAreaView style={styles.safe}>
        <ScrollView contentContainerStyle={styles.scroll}>
          <Text style={styles.title}>어느 대학교?</Text>
          <Text style={styles.hint}>두 학교 데이터가 있어요. 다른 대학은 곧 추가됩니다.</Text>

          <Pressable onPress={() => setUniv('snu')} style={styles.uniCard}>
            <Text style={styles.uniName}>서울대학교</Text>
            <Text style={styles.uniSub}>관악·연건 · 건물 {snu.BUILDINGS.length}개</Text>
          </Pressable>

          <Pressable onPress={() => setUniv('yonsei')} style={styles.uniCard}>
            <Text style={styles.uniName}>연세대학교</Text>
            <Text style={styles.uniSub}>신촌 · 건물 {yonsei.BUILDINGS.length}개 · 호실 직접 입력</Text>
          </Pressable>
        </ScrollView>
      </SafeAreaView>
    );
  }

  const submit = async () => {
    if (!building.trim() || !room.trim()) return;
    setSubmitting(true);
    setError(null);
    try {
      const b = building.trim();
      const r = room.trim();
      const id = `classroom:${univ}:${b}:${r}`;
      const name = univ === 'snu' ? `서울대 ${b} ${r}` : `연세대 ${b} ${r}`;
      await api.upsertPlace({ id, name, type: 'classroom', district: univ === 'snu' ? '서울 관악구 서울대학교' : '서울 서대문구 연세대학교' });
      router.push(`/p/${encodeURIComponent(id)}`);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSubmitting(false);
    }
  };

  const canSubmit = building.trim().length > 0 && room.trim().length > 0 && !submitting;

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <Pressable onPress={() => setUniv(null)} style={styles.back}><Text style={styles.backText}>← 학교 변경</Text></Pressable>
        <Text style={styles.title}>{univ === 'snu' ? '서울대학교' : '연세대학교'}</Text>
        <Text style={styles.hint}>건물명과 호실을 입력해주세요. 같은 입력값끼리 의견 집계됩니다.</Text>

        <Text style={styles.label}>건물명 *</Text>
        <TextInput
          value={building}
          onChangeText={setBuilding}
          placeholder={univ === 'snu' ? '예: 301동, 우민홀' : '예: 신공학관, 학생회관'}
          placeholderTextColor={TOKEN.text3}
          style={styles.input}
          autoFocus
        />

        <View style={{ height: 12 }} />

        <Text style={styles.label}>호실 *</Text>
        <TextInput
          value={room}
          onChangeText={setRoom}
          placeholder="예: 302호, 1층 라운지"
          placeholderTextColor={TOKEN.text3}
          style={styles.input}
        />

        {error && <View style={styles.error}><Text style={styles.errorText}>{error}</Text></View>}

        <Pressable onPress={submit} disabled={!canSubmit} style={[styles.submit, !canSubmit && styles.submitDisabled]}>
          {submitting ? <ActivityIndicator color="#fff" /> : <Text style={styles.submitText}>투표하러 가기</Text>}
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: TOKEN.bg },
  scroll: { padding: 20, paddingBottom: 60 },
  back: { marginBottom: 12 },
  backText: { fontSize: 13, color: TOKEN.text2 },
  title: { fontSize: 22, fontWeight: '900', color: TOKEN.text1, marginBottom: 6, letterSpacing: -0.5 },
  hint: { fontSize: 13, color: TOKEN.text2, marginBottom: 22, lineHeight: 18 },
  uniCard: {
    padding: 18, backgroundColor: TOKEN.surface, borderRadius: TOKEN.r.lg,
    borderWidth: 1, borderColor: TOKEN.border, marginBottom: 10,
  },
  uniName: { fontSize: 16, fontWeight: '800', color: TOKEN.text1 },
  uniSub: { fontSize: 12, color: TOKEN.text2, marginTop: 4 },
  label: { fontSize: 12, fontWeight: '700', color: TOKEN.text2, marginBottom: 8, letterSpacing: 0.3 },
  input: { padding: 13, borderWidth: 2, borderColor: TOKEN.border, borderRadius: TOKEN.r.md, fontSize: 14, color: TOKEN.text1, backgroundColor: TOKEN.bg },
  error: { marginTop: 14, padding: 10, backgroundColor: TOKEN.hotBg, borderRadius: TOKEN.r.md },
  errorText: { color: TOKEN.hot, fontSize: 12 },
  submit: { marginTop: 28, padding: 16, backgroundColor: TOKEN.cold, borderRadius: TOKEN.r.lg, alignItems: 'center' },
  submitDisabled: { backgroundColor: TOKEN.border },
  submitText: { fontSize: 15, fontWeight: '700', color: '#fff' },
});
