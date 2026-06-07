// Generic university classroom — UNIVERSITIES dataset (서울+전국). 호실 freeform.
// web GenericUniversityWizard.tsx RN 포팅.

import { useMemo, useState } from 'react';
import {
  View, Text, TextInput, Pressable, ScrollView, StyleSheet, ActivityIndicator,
} from 'react-native';
import { TOKEN } from '@aircon/core';
import {
  searchUniversity,
  univPlaceId,
  univPlaceName,
  univPlaceDetail,
  type University,
  type UnivCampus,
  type UnivBuilding,
  type UnivHit,
} from '@aircon/core/universities';
import { api } from '../../lib/apiClient';

interface Props {
  univ: University;
  onPicked: (placeId: string) => void;
  onExit: () => void;
}

type ViewState =
  | { mode: 'campus' }
  | { mode: 'search'; campus: UnivCampus }
  | { mode: 'college'; campus: UnivCampus; college: string }
  | { mode: 'building'; campus: UnivCampus; building: UnivBuilding };

export function GenericClassroom({ univ, onPicked, onExit }: Props) {
  const multiCampus = univ.campuses.length > 1;
  const [view, setView] = useState<ViewState>(
    multiCampus ? { mode: 'campus' } : { mode: 'search', campus: univ.campuses[0] },
  );
  const [query, setQuery] = useState('');
  const [room, setRoom] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitErr, setSubmitErr] = useState<string | null>(null);

  const submit = async (campus: UnivCampus, b: UnivBuilding) => {
    if (submitting) return;
    setSubmitting(true);
    setSubmitErr(null);
    try {
      const r = room.trim() || undefined;
      const id = univPlaceId(univ, campus, b, r);
      await api.upsertPlace({
        id,
        name: univPlaceName(univ, campus, b, r),
        type: 'classroom',
        district: campus.district,
        detail: univPlaceDetail(univ, campus, b, r),
      });
      onPicked(id);
    } catch (e) {
      setSubmitErr((e as Error).message || '장소 등록에 실패했어요. 잠시 후 다시 시도해 주세요.');
      setSubmitting(false);
    }
  };

  const onBack = () => {
    if (view.mode === 'building' || view.mode === 'college') { setView({ mode: 'search', campus: view.campus }); setRoom(''); }
    else if (view.mode === 'search' && multiCampus) setView({ mode: 'campus' });
    else onExit();
  };

  const headerTitle = view.mode === 'campus'
    ? `${univ.shortName} 캠퍼스 선택`
    : view.mode === 'building'
      ? `${view.building.code} ${view.building.name}`
      : view.mode === 'college'
        ? view.college
        : multiCampus
          ? `${univ.shortName} · ${view.campus.name}`
          : `${univ.shortName} 강의실`;

  return (
    <View style={styles.safe}>
      <View style={styles.header}>
        <Pressable onPress={onBack} hitSlop={10}>
          <Text style={styles.backBtn}>← {view.mode === 'campus' || (!multiCampus && view.mode === 'search') ? '학교 변경' : '뒤로'}</Text>
        </Pressable>
        <Text style={styles.headerTitle}>{headerTitle}</Text>
      </View>

      {view.mode === 'campus' ? (
        <ScrollView contentContainerStyle={styles.scroll}>
          <Text style={styles.hint}>{univ.name} · {univ.campuses.length}개 캠퍼스</Text>
          <View style={{ gap: 8 }}>
            {univ.campuses.map((c) => (
              <Pressable key={c.id} onPress={() => setView({ mode: 'search', campus: c })} style={styles.campusCard}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.campusName}>{c.name}</Text>
                  <Text style={styles.campusSub}>{c.district} · 건물 {c.buildings.length}개</Text>
                </View>
                <Text style={styles.chevron}>›</Text>
              </Pressable>
            ))}
          </View>
        </ScrollView>
      ) : view.mode === 'building' ? (
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          <View style={styles.bldgInfo}>
            {view.building.college && <Text style={styles.bldgInfoTop}>{view.building.college} · {view.campus.name}</Text>}
            <Text style={styles.bldgInfoTitle}>
              {view.building.name} <Text style={styles.bldgInfoCode}>· {/^\d/.test(view.building.code) ? `${view.building.code}동` : view.building.code}</Text>
            </Text>
          </View>

          <Text style={styles.label}>호실 (선택)</Text>
          <TextInput
            value={room}
            onChangeText={setRoom}
            placeholder="예: 407, B106, 강당"
            placeholderTextColor={TOKEN.text3}
            style={styles.input}
            autoFocus
          />
          <Text style={styles.helper}>같은 호실 번호끼리 의견이 모입니다. 모르면 비워둬도 됩니다.</Text>

          <Pressable
            onPress={() => submit(view.campus, view.building)}
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
        <CollegeView
          campus={view.campus}
          college={view.college}
          onTapBuilding={(b) => setView({ mode: 'building', campus: view.campus, building: b })}
        />
      ) : (
        <SearchView
          univ={univ}
          campus={view.campus}
          query={query}
          setQuery={setQuery}
          onTapCollege={(c) => setView({ mode: 'college', campus: view.campus, college: c })}
          onTapBuilding={(b) => setView({ mode: 'building', campus: view.campus, building: b })}
        />
      )}
    </View>
  );
}

function SearchView({
  univ, campus, query, setQuery, onTapCollege, onTapBuilding,
}: {
  univ: University;
  campus: UnivCampus;
  query: string;
  setQuery: (s: string) => void;
  onTapCollege: (c: string) => void;
  onTapBuilding: (b: UnivBuilding) => void;
}) {
  const hits: UnivHit[] = useMemo(() => searchUniversity(univ, query, 20), [univ, query]);
  const collegesInCampus = useMemo(
    () => Array.from(new Set(campus.buildings.map((b) => b.college).filter(Boolean) as string[])).sort(),
    [campus],
  );
  const popularBuildings = useMemo(() => campus.buildings.slice(0, 6), [campus]);

  return (
    <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
      <View style={styles.searchBox}>
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder="건물명·코드·단과대"
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
                  <Text style={styles.hitSub}>건물 {h.matches.length}개</Text>
                </View>
                <Text style={styles.chevron}>›</Text>
              </Pressable>
            ) : (
              <Pressable key={`b-${h.campus.id}-${h.building.code}-${i}`} onPress={() => onTapBuilding(h.building)} style={styles.hitRow}>
                <Text style={styles.hitKind}>건물</Text>
                <View style={{ flex: 1 }}>
                  <Text style={styles.hitTitle}>{h.building.code} · {h.building.name}</Text>
                  {h.building.college && <Text style={styles.hitSub}>{h.building.college}</Text>}
                </View>
                <Text style={styles.chevron}>›</Text>
              </Pressable>
            ))}
          </View>
        )
      ) : (
        <View style={{ gap: 18 }}>
          {collegesInCampus.length > 0 && (
            <View>
              <Text style={styles.sectionLabel}>단과대 둘러보기</Text>
              <View style={styles.collegeGrid}>
                {collegesInCampus.slice(0, 8).map((c) => (
                  <Pressable key={c} onPress={() => onTapCollege(c)} style={styles.collegeTile}>
                    <Text style={styles.collegeTileText}>{c}</Text>
                  </Pressable>
                ))}
              </View>
            </View>
          )}
          <View>
            <Text style={styles.sectionLabel}>건물 목록 ({campus.buildings.length}개)</Text>
            <View style={{ gap: 6 }}>
              {popularBuildings.map((b) => (
                <Pressable key={b.code} onPress={() => onTapBuilding(b)} style={styles.buildingRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.buildingTitle}>{b.code} · {b.name}</Text>
                    {b.college && <Text style={styles.buildingSub}>{b.college}</Text>}
                  </View>
                  <Text style={styles.chevron}>›</Text>
                </Pressable>
              ))}
              {campus.buildings.length > popularBuildings.length && (
                <Text style={styles.hint}>· 검색창에서 더 찾을 수 있어요</Text>
              )}
            </View>
          </View>
        </View>
      )}
    </ScrollView>
  );
}

function CollegeView({ campus, college, onTapBuilding }: {
  campus: UnivCampus;
  college: string;
  onTapBuilding: (b: UnivBuilding) => void;
}) {
  const list = useMemo(() => campus.buildings.filter((b) => b.college === college), [campus, college]);
  return (
    <ScrollView contentContainerStyle={styles.scroll}>
      <Text style={styles.hint}>{list.length}개 건물</Text>
      <View style={{ gap: 6 }}>
        {list.map((b) => (
          <Pressable key={b.code} onPress={() => onTapBuilding(b)} style={styles.buildingRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.buildingTitle}>{b.code} · {b.name}</Text>
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
  header: { backgroundColor: TOKEN.surface, paddingHorizontal: 14, paddingTop: 8, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: TOKEN.border, gap: 6 },
  backBtn: { fontSize: 13, color: TOKEN.text2, fontWeight: '600' },
  headerTitle: { fontSize: 16, fontWeight: '800', color: TOKEN.text1 },
  scroll: { padding: 20, paddingBottom: 80 },
  searchBox: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: TOKEN.surface, borderWidth: 1.5, borderColor: TOKEN.border, borderRadius: TOKEN.r.lg, paddingHorizontal: 14, marginBottom: 14 },
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
  campusCard: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 16, backgroundColor: TOKEN.surface, borderRadius: TOKEN.r.lg, borderWidth: 1, borderColor: TOKEN.border },
  campusName: { fontSize: 15, fontWeight: '800', color: TOKEN.text1, marginBottom: 2 },
  campusSub: { fontSize: 12, color: TOKEN.text2 },
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
