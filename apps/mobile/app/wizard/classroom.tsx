// Mobile 강의실 wizard 라우터 — 학교 선택 → 학교별 wizard.
// web SNUClassroomWizard.tsx (entry) 동등 흐름:
//   univ === null → UniversityPicker
//   univ === 'snu' → SnuClassroom (호실 1976개 search/college/building)
//   univ === 'yonsei' → YonseiClassroom (건물 picker + 호실 freeform)
//   기타 → GenericClassroom (UNIVERSITIES dataset 기반)

import { useCallback, useMemo, useState } from 'react';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StyleSheet } from 'react-native';
import { TOKEN } from '@aircon/core';
import { UniversityPicker } from '../../src/screens/classroom/UniversityPicker';
import { SnuClassroom } from '../../src/screens/classroom/SnuClassroom';
import { YonseiClassroom } from '../../src/screens/classroom/YonseiClassroom';
import { GenericClassroom } from '../../src/screens/classroom/GenericClassroom';
import { KNOWN_UNIVS } from '../../src/screens/classroom/types';

export default function ClassroomWizard() {
  const [univId, setUnivId] = useState<string | null>(null);
  const reset = useCallback(() => setUnivId(null), []);
  const onPicked = useCallback((placeId: string) => {
    router.push(`/p/${encodeURIComponent(placeId)}`);
  }, []);

  // KNOWN_UNIVS는 import 시점에 고정. invalid id가 들어오는 유일한 경로는 UniversityPicker.onPick.
  // Picker가 KNOWN_UNIVS만 노출하므로 정상 흐름에서는 known !== undefined 보장.
  // 만에 하나 깨지면 picker로 되돌리지 말고 (render 중 setState 금지) UniversityPicker 그대로 보여줘서 사용자 액션 유도.
  const known = useMemo(() => univId ? KNOWN_UNIVS.find((u) => u.id === univId) : null, [univId]);

  if (univId === null || !known) {
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        <UniversityPicker onPick={setUnivId} onBack={() => router.back()} />
      </SafeAreaView>
    );
  }
  if (known.kind === 'snu') {
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        <SnuClassroom onPicked={onPicked} onExit={reset} />
      </SafeAreaView>
    );
  }
  if (known.kind === 'yonsei') {
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        <YonseiClassroom onPicked={onPicked} onExit={reset} />
      </SafeAreaView>
    );
  }
  // kind === 'generic' → university 객체 보장
  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <GenericClassroom univ={known.university!} onPicked={onPicked} onExit={reset} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: TOKEN.bg },
});
