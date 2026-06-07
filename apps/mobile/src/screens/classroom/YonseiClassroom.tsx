// 연세대 강의실 — 건물 검색/picker + 호실 freeform 입력. 호실 dataset 없음.
// web YonseiClassroomWizard.tsx RN 포팅.

import { useMemo, useState } from 'react';
import {
  View, Text, TextInput, Pressable, ScrollView, StyleSheet, ActivityIndicator,
} from 'react-native';
import { TOKEN, yonsei } from '@aircon/core';
import { api } from '../../lib/apiClient';

type YonseiBuilding = yonsei.YonseiBuilding;

interface Props {
  onPicked: (placeId: string) => void;
  onExit: () => void;
}

type ViewState =
  | { mode: 'search' }
  | { mode: 'college'; college: string }
  | { mode: 'building'; building: YonseiBuilding };

export function YonseiClassroom({ onPicked, onExit }: Props) {
  const [view, setView] = useState<ViewState>({ mode: 'search' });
  const [query, setQuery] = useState('');
  const [room, setRoom] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitErr, setSubmitErr] = useState<string | null>(null);

  const hits = useMemo(() => yonsei.search(query, 20), [query]);

  const submit = async (b: YonseiBuilding) => {
    if (submitting) return;
    setSubmitting(true);
    setSubmitErr(null);
    try {
      const r = room.trim() || undefined;
      const id = yonsei.yonseiPlaceId(b, r);
      await api.upsertPlace({
        id,
        name: yonsei.yonseiPlaceName(b, r),
        type: 'classroom',
        district: `서울 서대문구 연세대학교 ${b.code}동`,
        detail: yonsei.yonseiPlaceDetail(b, r),
      });
      onPicked(id);
    } catch (e) {
      setSubmitErr((e as Error).message || '장소 등록에 실패했어요. 잠시 후 다시 시도해 주세요.');
      setSubmitting(false);
    }
  };

  const onBack = () => {
    if (view.mode === 'building' || view.mode === 'college') { setView({ mode: 'search' }); setRoom(''); }
    else onExit();
  };
  const headerTitle = view.mode === 'building'
    ? `${view.building.code}동 ${view.building.name}`
    : view.mode === 'college'
      ? view.college
      : '연세대 강의실';

  return (
    <View style={styles.safe}>
      <View style={styles.header}>
        <Pressable onPress={onBack} hitSlop={10}><Text style={styles.backBtn}>← {view.mode === 'search' ? '학교 변경' : '뒤로'}</Text></Pressable>
        <Text style={styles.headerTitle}>{headerTitle}</Text>
      </View>

      {view.mode === 'building' ? (
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          <View style={styles.bldgInfo}>
            <Text style={styles.bldgInfoTop}>{view.building.college} · 신촌캠퍼스</Text>
            <Text style={styles.bldgInfoTitle}>{view.building.name} <Text style={styles.bldgInfoCode}>· {view.building.code}동</Text></Text>
          </View>

          <Text style={styles.label}>호실 (선택)</Text>
          <TextInput
            value={room}
            onChangeText={setRoom}
            placeholder="예: 407, B106, N311, 강당"
            placeholderTextColor={TOKEN.text3}
            style={styles.input}
            autoFocus
          />
          <Text style={styles.helper}>같은 호실 번호끼리 의견이 모입니다. 모르면 비워둬도 됩니다.</Text>

          <Pressable
            onPress={() => submit(view.building)}
            disabled={submitting}
            style={[styles.primaryBtn, submitting && styles.primaryBtnDisabled]}
          >
            {submitting
              ? <ActivityIndicator color="#fff" />
              : <Text style={styles.primaryBtnText}>{room.trim() ? `${room.trim()}호로 투표` : '건물 전체에서 투표'}</Text>}
          </Pressable>

          {submitErr && (
            <View style={styles.submitErrBox}><Text style={styles.submitErrText}>{submitErr}</Text></View>
          )}
        </ScrollView>
      ) : view.mode === 'college' ? (
        <CollegeView college={view.college} onTapBuilding={(b) => setView({ mode: 'building', building: b })} />
      ) : (
        <SearchView
          query={query}
          setQuery={setQuery}
          hits={hits}
          onTapCollege={(c) => setView({ mode: 'college', college: c })}
          onTapBuilding={(b) => setView({ mode: 'building', building: b })}
        />
      )}
    </View>
  );
}

function SearchView({ query, setQuery, hits, onTapCollege, onTapBuilding }: {
  query: string; setQuery: (s: string) => void; hits: yonsei.YHit[];
  onTapCollege: (c: string) => void; onTapBuilding: (b: YonseiBuilding) => void;
}) {
  // 자주 가는 건물 (alphabet 우선 6개)
  const popular = yonsei.BUILDINGS.slice(0, 6);
  const popularColleges = yonsei.COLLEGE_LIST.slice(0, 6);
  return (
    <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
      <View style={styles.searchBox}>
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder="건물명·코드·단과대 (예: 공학원, 102, 상경)"
          placeholderTextColor={TOKEN.text3}
          style={styles.searchInput}
        />
        {query.length > 0 && (
          <Pressable onPress={() => setQuery('')} hitSlop={10}><Text style={styles.clearBtn}>×</Text></Pressable>
        )}
      </View>
      {query.trim() ? (
        hits.length === 0 ? (
          <Text style={styles.emptyText}>일치하는 결과 없음.</Text>
        ) : (
          <View style={{ gap: 6 }}>
            {hits.map((h, i) => h.type === 'college' ? (
              <Pressable key={`c-${h.college}-${i}`} onPress={() => onTapCollege(h.college)} style={styles.hitRow}>
                <Text style={styles.hitKind}>단과대</Text>
                <View style={{ flex: 1 }}>
                  <Text style={styles.hitTitle}>{h.college}</Text>
                  <Text style={styles.hitSub}>건물 {h.buildings.length}개</Text>
                </View>
                <Text style={styles.chevron}>›</Text>
              </Pressable>
            ) : (
              <Pressable key={`b-${h.building.code}-${i}`} onPress={() => onTapBuilding(h.building)} style={styles.hitRow}>
                <Text style={styles.hitKind}>건물</Text>
                <View style={{ flex: 1 }}>
                  <Text style={styles.hitTitle}>{h.building.code}동 · {h.building.name}</Text>
                  <Text style={styles.hitSub}>{h.building.college}</Text>
                </View>
                <Text style={styles.chevron}>›</Text>
              </Pressable>
            ))}
          </View>
        )
      ) : (
        <View style={{ gap: 18 }}>
          <View>
            <Text style={styles.sectionLabel}>단과대 둘러보기</Text>
            <View style={styles.collegeGrid}>
              {popularColleges.map((c) => (
                <Pressable key={c} onPress={() => onTapCollege(c)} style={styles.collegeTile}>
                  <Text style={styles.collegeTileText}>{c}</Text>
                </Pressable>
              ))}
            </View>
          </View>
          <View>
            <Text style={styles.sectionLabel}>자주 가는 건물</Text>
            <View style={{ gap: 6 }}>
              {popular.map((b) => (
                <Pressable key={b.code} onPress={() => onTapBuilding(b)} style={styles.buildingRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.buildingTitle}>{b.code}동 · {b.name}</Text>
                    <Text style={styles.buildingSub}>{b.college}</Text>
                  </View>
                  <Text style={styles.chevron}>›</Text>
                </Pressable>
              ))}
            </View>
          </View>
        </View>
      )}
    </ScrollView>
  );
}

function CollegeView({ college, onTapBuilding }: { college: string; onTapBuilding: (b: YonseiBuilding) => void }) {
  const list = useMemo(() => yonsei.BUILDINGS.filter((b) => b.college === college), [college]);
  return (
    <ScrollView contentContainerStyle={styles.scroll}>
      <Text style={styles.hint}>{list.length}개 건물</Text>
      <View style={{ gap: 6 }}>
        {list.map((b) => (
          <Pressable key={b.code} onPress={() => onTapBuilding(b)} style={styles.buildingRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.buildingTitle}>{b.code}동 · {b.name}</Text>
              <Text style={styles.buildingSub}>{b.college}</Text>
            </View>
            <Text style={styles.chevron}>›</Text>
          </Pressable>
        ))}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: TOKEN.bg },
  header: {
    backgroundColor: TOKEN.surface,
    paddingHorizontal: 14,
    paddingTop: 8,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: TOKEN.border,
    gap: 6,
  },
  backBtn: { fontSize: 13, color: TOKEN.text2, fontWeight: '600' },
  headerTitle: { fontSize: 16, fontWeight: '800', color: TOKEN.text1 },
  scroll: { padding: 20, paddingBottom: 80 },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: TOKEN.surface,
    borderWidth: 1.5,
    borderColor: TOKEN.border,
    borderRadius: TOKEN.r.lg,
    paddingHorizontal: 14,
    marginBottom: 14,
  },
  searchInput: { flex: 1, paddingVertical: 12, fontSize: 14, color: TOKEN.text1 },
  clearBtn: { fontSize: 22, color: TOKEN.text3 },
  hint: { fontSize: 12, color: TOKEN.text3, marginVertical: 6 },
  emptyText: { fontSize: 13, color: TOKEN.text3, textAlign: 'center', padding: 20 },
  sectionLabel: { fontSize: 11, fontWeight: '700', color: TOKEN.text3, letterSpacing: 1, textTransform: 'uppercase', marginBottom: 10 },
  collegeGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  collegeTile: { width: '47%', padding: 14, backgroundColor: TOKEN.surface, borderRadius: TOKEN.r.md, borderWidth: 1, borderColor: TOKEN.border },
  collegeTileText: { fontSize: 13, fontWeight: '700', color: TOKEN.text1 },
  buildingRow: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12, backgroundColor: TOKEN.surface, borderRadius: TOKEN.r.md, borderWidth: 1, borderColor: TOKEN.border },
  buildingTitle: { fontSize: 14, fontWeight: '700', color: TOKEN.text1, marginBottom: 2 },
  buildingSub: { fontSize: 11, color: TOKEN.text2 },
  hitRow: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12, backgroundColor: TOKEN.surface, borderRadius: TOKEN.r.md, borderWidth: 1, borderColor: TOKEN.border },
  hitKind: { fontSize: 9, fontWeight: '700', color: TOKEN.cold, backgroundColor: TOKEN.coldBg, paddingHorizontal: 6, paddingVertical: 3, borderRadius: 4, overflow: 'hidden', letterSpacing: 0.5 },
  hitTitle: { fontSize: 14, fontWeight: '700', color: TOKEN.text1, marginBottom: 2 },
  hitSub: { fontSize: 11, color: TOKEN.text2 },
  chevron: { fontSize: 18, color: TOKEN.text3 },
  bldgInfo: { padding: 14, backgroundColor: TOKEN.coldBg, borderRadius: TOKEN.r.md, marginBottom: 14 },
  bldgInfoTop: { fontSize: 11, color: TOKEN.text2, marginBottom: 4 },
  bldgInfoTitle: { fontSize: 15, fontWeight: '800', color: TOKEN.text1 },
  bldgInfoCode: { color: TOKEN.text3, fontWeight: '600' },
  label: { fontSize: 12, fontWeight: '700', color: TOKEN.text2, marginBottom: 8, letterSpacing: 0.3 },
  input: { padding: 13, borderWidth: 2, borderColor: TOKEN.border, borderRadius: TOKEN.r.md, fontSize: 14, color: TOKEN.text1, backgroundColor: TOKEN.bg },
  helper: { fontSize: 11, color: TOKEN.text3, marginTop: 6, lineHeight: 16 },
  primaryBtn: { marginTop: 22, padding: 14, backgroundColor: TOKEN.cold, borderRadius: TOKEN.r.lg, alignItems: 'center' },
  primaryBtnDisabled: { backgroundColor: TOKEN.border },
  primaryBtnText: { color: '#fff', fontSize: 14, fontWeight: '700' },
  submitErrBox: { marginTop: 10, padding: 10, backgroundColor: TOKEN.hotBg, borderRadius: TOKEN.r.md },
  submitErrText: { fontSize: 12, color: TOKEN.hot },
});
