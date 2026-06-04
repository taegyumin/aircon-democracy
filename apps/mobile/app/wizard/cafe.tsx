// Mobile 카페 wizard — 1차 sprint는 RN 네이버 지도 SDK 미통합 상태.
// 진짜 지도는 후속 (react-native-naver-map 또는 WebView로 web NaverMapPicker 임베드).
// 임시: 가게 이름 + 도로명 주소 freeform 입력 → coords 없이 venue:freeform:* ID.

import { useState } from 'react';
import { View, Text, TextInput, Pressable, ScrollView, StyleSheet, ActivityIndicator } from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { TOKEN } from '@aircon/core';
import { api } from '../../src/lib/apiClient';

export default function CafeWizard() {
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
      // 임시 ID: 도로명 주소 + 가게 이름 (PLACE_ID_RE 허용 문자만 사용).
      // 추후 지도 SDK 통합 시 venue:gps:{lat4}:{lng4} 로 교체.
      // PLACE_ID_RE: /^[a-z][a-z-]*:[\p{L}\p{N}\s,()/:·.\-]{1,180}$/u — 언더스코어 불허.
      const sanitize = (s: string) => s.trim().replace(/\s+/g, '-').replace(/[^\p{L}\p{N},()/:·.\-]/gu, '').slice(0, 40);
      const addrSlug = sanitize(address);
      const nameSlug = sanitize(name);
      const id = `other:freeform:${addrSlug}:${nameSlug}`;
      await api.upsertPlace({ id, name: name.trim(), type: 'other', district: address.trim() });
      router.push(`/p/${encodeURIComponent(id)}`);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <Text style={styles.title}>카페·음식점 위치</Text>
        <Text style={styles.hint}>지도 픽커는 곧 추가됩니다. 지금은 이름과 주소를 직접 입력해주세요.</Text>

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
  title: { fontSize: 20, fontWeight: '900', color: TOKEN.text1, marginBottom: 6 },
  hint: { fontSize: 13, color: TOKEN.text2, marginBottom: 22, lineHeight: 18 },
  label: { fontSize: 12, fontWeight: '700', color: TOKEN.text2, marginBottom: 8, letterSpacing: 0.3 },
  input: { padding: 13, borderWidth: 2, borderColor: TOKEN.border, borderRadius: TOKEN.r.md, fontSize: 14, color: TOKEN.text1, backgroundColor: TOKEN.bg },
  error: { marginTop: 14, padding: 10, backgroundColor: TOKEN.hotBg, borderRadius: TOKEN.r.md },
  errorText: { color: TOKEN.hot, fontSize: 12 },
  submit: { marginTop: 28, padding: 16, backgroundColor: TOKEN.cold, borderRadius: TOKEN.r.lg, alignItems: 'center' },
  submitDisabled: { backgroundColor: TOKEN.border },
  submitText: { fontSize: 15, fontWeight: '700', color: '#fff' },
});
