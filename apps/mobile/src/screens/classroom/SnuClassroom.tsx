// 서울대 강의실 — 검색/단과대/건물 3-view state machine + 호실 grid.
// web SNUClassroomWizard.tsx 의 SNU view 부분 RN 포팅.

import { useEffect, useMemo, useState } from 'react';
import {
  View, Text, TextInput, Pressable, ScrollView, StyleSheet, ActivityIndicator,
} from 'react-native';
import { TOKEN, snu } from '@aircon/core';
import { api } from '../../lib/apiClient';
import { loadSnuRooms } from '../../lib/snuRooms';

type SNUBuilding = snu.SNUBuilding;
type SNURoom = snu.SNURoom;

type ViewState =
  | { mode: 'search' }
  | { mode: 'college'; college: string }
  | { mode: 'building'; building: SNUBuilding };

interface Props {
  onPicked: (placeId: string) => void;
  onExit: () => void; // 학교 변경 (UniversityPicker로 돌아가기)
}

const PUBLIC_KINDS: SNURoom['kind'][] = ['classroom', 'lab', 'lounge', 'other'];
const POPULAR_COLLEGES = [
  '공과대학', '인문대학', '사회과학대학', '자연과학대학', '경영대학',
  '사범대학', '농업생명과학대학', '생활과학대학', '법과대학', '의과대학',
];

export function SnuClassroom({ onPicked, onExit }: Props) {
  const [view, setView] = useState<ViewState>({ mode: 'search' });
  const [query, setQuery] = useState('');
  const [rooms, setRooms] = useState<SNURoom[] | null>(null);
  const [roomsErr, setRoomsErr] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState<string | null>(null);
  const [submitErr, setSubmitErr] = useState<string | null>(null);
  const [allKinds, setAllKinds] = useState(false);

  useEffect(() => {
    let alive = true;
    loadSnuRooms()
      .then((r) => { if (alive) setRooms(r); })
      .catch((e) => { if (alive) setRoomsErr((e as Error).message); });
    return () => { alive = false; };
  }, []);

  const hits = useMemo(() => snu.search(query, rooms, 20), [query, rooms]);

  const pickPlace = async (b: SNUBuilding, room?: SNURoom) => {
    const id = snu.snuPlaceId(b, room);
    if (submitting) return;
    setSubmitting(id);
    setSubmitErr(null);
    try {
      await api.upsertPlace({
        id,
        name: snu.snuPlaceName(b, room),
        type: 'classroom',
        district: `서울 관악구 서울대학교 ${b.code}동`,
        detail: snu.snuPlaceDetail(b, room),
      });
      onPicked(id);
    } catch (e) {
      setSubmitErr((e as Error).message || '장소 등록에 실패했어요. 잠시 후 다시 시도해 주세요.');
      setSubmitting(null);
    }
  };

  // 헤더 — view 따라 뒤로가기 동작 변경
  const onBack = () => {
    if (view.mode === 'building' || view.mode === 'college') setView({ mode: 'search' });
    else onExit();
  };
  const headerTitle = view.mode === 'building'
    ? `${view.building.code}동 ${view.building.name}`
    : view.mode === 'college'
      ? view.college
      : '서울대 강의실';

  return (
    <View style={styles.safe}>
      <View style={styles.header}>
        <Pressable onPress={onBack} hitSlop={10}><Text style={styles.backBtn}>← {view.mode === 'search' ? '학교 변경' : '뒤로'}</Text></Pressable>
        <Text style={styles.headerTitle}>{headerTitle}</Text>
      </View>

      {view.mode === 'building'
        ? <BuildingView
            b={view.building}
            rooms={rooms}
            allKinds={allKinds}
            setAllKinds={setAllKinds}
            submittingId={submitting}
            submitErr={submitErr}
            onPick={pickPlace}
          />
        : view.mode === 'college'
          ? <CollegeView
              college={view.college}
              onTapBuilding={(b) => setView({ mode: 'building', building: b })}
            />
          : <SearchView
              query={query}
              setQuery={setQuery}
              hits={hits}
              rooms={rooms}
              roomsErr={roomsErr}
              onTapCollege={(c) => setView({ mode: 'college', college: c })}
              onTapBuilding={(b) => setView({ mode: 'building', building: b })}
            />}
    </View>
  );
}

// ───────────────────────── Search view ─────────────────────────

function SearchView({
  query, setQuery, hits, rooms, roomsErr, onTapCollege, onTapBuilding,
}: {
  query: string;
  setQuery: (s: string) => void;
  hits: snu.Hit[];
  rooms: SNURoom[] | null;
  roomsErr: string | null;
  onTapCollege: (c: string) => void;
  onTapBuilding: (b: SNUBuilding) => void;
}) {
  return (
    <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
      <View style={styles.searchBox}>
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder="동번호·단과대·건물·호실 (예: 301, 공대, 우민홀)"
          placeholderTextColor={TOKEN.text3}
          style={styles.searchInput}
        />
        {query.length > 0 && (
          <Pressable onPress={() => setQuery('')} hitSlop={10}><Text style={styles.clearBtn}>×</Text></Pressable>
        )}
      </View>

      {roomsErr && (
        <View style={styles.errorBox}>
          <Text style={styles.errorText}>호실 데이터를 못 불러왔어요 ({roomsErr}). 건물·단과대 검색은 계속 사용할 수 있어요.</Text>
        </View>
      )}

      {query.trim()
        ? (hits.length === 0
            ? <Text style={styles.emptyText}>일치하는 결과 없음. 다른 키워드를 입력해 보세요.</Text>
            : <HitList hits={hits} onTapCollege={onTapCollege} onTapBuilding={onTapBuilding} />)
        : <DefaultLanding rooms={rooms} onTapCollege={onTapCollege} onTapBuilding={onTapBuilding} />}
    </ScrollView>
  );
}

function HitList({ hits, onTapCollege, onTapBuilding }: {
  hits: snu.Hit[];
  onTapCollege: (c: string) => void;
  onTapBuilding: (b: SNUBuilding) => void;
}) {
  return (
    <View style={{ gap: 6 }}>
      {hits.map((h, i) => {
        if (h.type === 'college') {
          return (
            <Pressable key={`c-${h.college}-${i}`} onPress={() => onTapCollege(h.college)} style={styles.hitRow}>
              <Text style={styles.hitKind}>단과대</Text>
              <View style={{ flex: 1 }}>
                <Text style={styles.hitTitle}>{h.college}</Text>
                <Text style={styles.hitSub}>건물 {h.buildings.length}개</Text>
              </View>
              <Text style={styles.chevron}>›</Text>
            </Pressable>
          );
        }
        if (h.type === 'building') {
          return (
            <Pressable key={`b-${h.building.code}-${i}`} onPress={() => onTapBuilding(h.building)} style={styles.hitRow}>
              <Text style={styles.hitKind}>건물</Text>
              <View style={{ flex: 1 }}>
                <Text style={styles.hitTitle}>{h.building.code}동 · {h.building.name}</Text>
                <Text style={styles.hitSub}>{h.building.college} · 호실 {h.building.roomCount}개</Text>
              </View>
              <Text style={styles.chevron}>›</Text>
            </Pressable>
          );
        }
        // room
        return (
          <Pressable key={`r-${h.building.code}-${h.room.room}-${i}`} onPress={() => onTapBuilding(h.building)} style={styles.hitRow}>
            <Text style={styles.hitKind}>호실</Text>
            <View style={{ flex: 1 }}>
              <Text style={styles.hitTitle}>{h.building.code}-{h.room.room} · {h.room.label}</Text>
              <Text style={styles.hitSub}>{h.building.name}</Text>
            </View>
            <Text style={styles.chevron}>›</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

function DefaultLanding({ rooms, onTapCollege, onTapBuilding }: {
  rooms: SNURoom[] | null;
  onTapCollege: (c: string) => void;
  onTapBuilding: (b: SNUBuilding) => void;
}) {
  // 인기 단과대 (탭하면 단과대 view) + 호실 많은 건물 top 6 (찾기 쉬운 진입점)
  const popular = POPULAR_COLLEGES.filter((c) => snu.BUILDINGS.some((b) => b.college === c));
  const topBuildings = [...snu.BUILDINGS]
    .filter((b) => b.roomCount > 0)
    .sort((a, b) => b.roomCount - a.roomCount)
    .slice(0, 6);
  return (
    <View style={{ gap: 18 }}>
      <View>
        <Text style={styles.sectionLabel}>단과대 둘러보기</Text>
        <View style={styles.collegeGrid}>
          {popular.map((c) => (
            <Pressable key={c} onPress={() => onTapCollege(c)} style={styles.collegeTile}>
              <Text style={styles.collegeTileText}>{c}</Text>
            </Pressable>
          ))}
        </View>
      </View>
      <View>
        <Text style={styles.sectionLabel}>자주 가는 건물</Text>
        {!rooms && <Text style={styles.hint}>호실 데이터 불러오는 중…</Text>}
        <View style={{ gap: 6 }}>
          {topBuildings.map((b) => (
            <Pressable key={b.code} onPress={() => onTapBuilding(b)} style={styles.buildingRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.buildingTitle}>{b.code}동 · {b.name}</Text>
                <Text style={styles.buildingSub}>{b.college} · 호실 {b.roomCount}개</Text>
              </View>
              <Text style={styles.chevron}>›</Text>
            </Pressable>
          ))}
        </View>
      </View>
    </View>
  );
}

// ───────────────────────── College view ─────────────────────────

function CollegeView({ college, onTapBuilding }: { college: string; onTapBuilding: (b: SNUBuilding) => void }) {
  const list = useMemo(() => snu.BUILDINGS.filter((b) => b.college === college), [college]);
  return (
    <ScrollView contentContainerStyle={styles.scroll}>
      <Text style={styles.hint}>{list.length}개 건물</Text>
      <View style={{ gap: 6 }}>
        {list.map((b) => (
          <Pressable key={b.code} onPress={() => onTapBuilding(b)} style={styles.buildingRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.buildingTitle}>{b.code}동 · {b.name}</Text>
              <Text style={styles.buildingSub}>호실 {b.roomCount}개</Text>
            </View>
            <Text style={styles.chevron}>›</Text>
          </Pressable>
        ))}
      </View>
    </ScrollView>
  );
}

// ───────────────────────── Building view ─────────────────────────

function BuildingView({
  b, rooms, allKinds, setAllKinds, submittingId, submitErr, onPick,
}: {
  b: SNUBuilding;
  rooms: SNURoom[] | null;
  allKinds: boolean;
  setAllKinds: (v: boolean) => void;
  submittingId: string | null;
  submitErr: string | null;
  onPick: (b: SNUBuilding, room?: SNURoom) => void;
}) {
  const allRooms = useMemo(
    () => rooms ? snu.roomsForBuilding(b.code, rooms) : [],
    [b.code, rooms],
  );
  const filtered = useMemo(
    () => allKinds ? allRooms : allRooms.filter((r) => PUBLIC_KINDS.includes(r.kind)),
    [allRooms, allKinds],
  );
  const wholeId = snu.snuPlaceId(b);

  return (
    <ScrollView contentContainerStyle={styles.scroll}>
      <View style={styles.bldgInfo}>
        <Text style={styles.bldgInfoTop}>{b.college} · {b.campus}캠퍼스</Text>
        <Text style={styles.bldgInfoTitle}>{b.name} <Text style={styles.bldgInfoCode}>· {b.code}동</Text></Text>
      </View>

      <Pressable
        onPress={() => onPick(b)}
        disabled={submittingId === wholeId}
        style={[styles.primaryBtn, submittingId === wholeId && styles.primaryBtnDisabled]}
      >
        {submittingId === wholeId
          ? <ActivityIndicator color="#fff" />
          : <Text style={styles.primaryBtnText}>이 건물 전체에서 투표 (호실 모름)</Text>}
      </Pressable>

      {submitErr && (
        <View style={styles.submitErrBox}><Text style={styles.submitErrText}>{submitErr}</Text></View>
      )}

      <View style={styles.roomHeader}>
        <Text style={styles.sectionLabel}>호실 선택 ({filtered.length}개)</Text>
        {allRooms.length > filtered.length && (
          <Pressable onPress={() => setAllKinds(!allKinds)}>
            <Text style={styles.toggleText}>{allKinds ? '공용 공간만' : `전체 (${allRooms.length})`}</Text>
          </Pressable>
        )}
      </View>

      {!rooms && <Text style={styles.hint}>호실 정보 불러오는 중…</Text>}
      {rooms && filtered.length === 0 && (
        <Text style={styles.hint}>등록된 호실이 없어요. 위 버튼으로 건물 단위 투표가 가능합니다.</Text>
      )}

      <RoomGrid b={b} rooms={filtered} submittingId={submittingId} onPick={onPick} />
    </ScrollView>
  );
}

function RoomGrid({
  b, rooms, submittingId, onPick,
}: {
  b: SNUBuilding;
  rooms: SNURoom[];
  submittingId: string | null;
  onPick: (b: SNUBuilding, room?: SNURoom) => void;
}) {
  // 층별 그룹화 + 정렬 (지하 B → 1 → 2 → … → 옥상 R)
  const groups = useMemo(() => groupByFloor(rooms), [rooms]);
  return (
    <View style={{ gap: 14 }}>
      {groups.map(([floor, list]) => (
        <View key={floor}>
          <Text style={styles.floorLabel}>{floor}</Text>
          <View style={styles.roomGrid}>
            {list.map((r) => {
              const id = snu.snuPlaceId(b, r);
              const submitting = submittingId === id;
              return (
                <Pressable
                  key={r.room + r.label}
                  onPress={() => onPick(b, r)}
                  disabled={submitting}
                  style={[styles.roomBtn, kindStyle(r.kind), submitting && styles.roomBtnDisabled]}
                >
                  <Text style={styles.roomNum}>{r.room}</Text>
                  <Text style={styles.roomLabel} numberOfLines={1}>{r.label}</Text>
                </Pressable>
              );
            })}
          </View>
        </View>
      ))}
    </View>
  );
}

function groupByFloor(rooms: SNURoom[]): [string, SNURoom[]][] {
  const map = new Map<string, SNURoom[]>();
  for (const r of rooms) {
    const floor = floorOf(r.room);
    const list = map.get(floor) ?? [];
    list.push(r);
    map.set(floor, list);
  }
  const order = (f: string) => {
    if (f === 'BF') return -10; // 지하 unspecified
    if (f.startsWith('B')) return -Number(f.slice(1));
    if (f === 'R') return 1000;
    const n = Number(f);
    return isNaN(n) ? 500 : n;
  };
  return Array.from(map.entries()).sort((a, b) => order(a[0]) - order(b[0]));
}

function floorOf(room: string): string {
  const m = room.match(/^([Bb])?(\d)/);
  if (!m) return 'BF';
  if (m[1]) return 'B' + m[2];
  return m[2];
}

function kindStyle(kind: SNURoom['kind']) {
  switch (kind) {
    case 'classroom': return { backgroundColor: TOKEN.coldBg, borderColor: TOKEN.cold };
    case 'lab': return { backgroundColor: '#FEF3C7', borderColor: '#D97706' };
    case 'lounge': return { backgroundColor: '#ECFCCB', borderColor: '#65A30D' };
    case 'office': return { backgroundColor: '#FCE7F3', borderColor: '#BE185D' };
    default: return { backgroundColor: TOKEN.bg, borderColor: TOKEN.border };
  }
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
  errorBox: {
    padding: 12, backgroundColor: TOKEN.hotBg, borderRadius: TOKEN.r.md, marginBottom: 12,
  },
  errorText: { fontSize: 12, color: TOKEN.hot },
  sectionLabel: { fontSize: 11, fontWeight: '700', color: TOKEN.text3, letterSpacing: 1, textTransform: 'uppercase', marginBottom: 10 },
  collegeGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  collegeTile: {
    width: '47%',
    padding: 14,
    backgroundColor: TOKEN.surface,
    borderRadius: TOKEN.r.md,
    borderWidth: 1,
    borderColor: TOKEN.border,
  },
  collegeTileText: { fontSize: 13, fontWeight: '700', color: TOKEN.text1 },
  buildingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 12,
    backgroundColor: TOKEN.surface,
    borderRadius: TOKEN.r.md,
    borderWidth: 1,
    borderColor: TOKEN.border,
  },
  buildingTitle: { fontSize: 14, fontWeight: '700', color: TOKEN.text1, marginBottom: 2 },
  buildingSub: { fontSize: 11, color: TOKEN.text2 },
  hitRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 12,
    backgroundColor: TOKEN.surface,
    borderRadius: TOKEN.r.md,
    borderWidth: 1,
    borderColor: TOKEN.border,
  },
  hitKind: {
    fontSize: 9,
    fontWeight: '700',
    color: TOKEN.cold,
    backgroundColor: TOKEN.coldBg,
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 4,
    overflow: 'hidden',
    letterSpacing: 0.5,
  },
  hitTitle: { fontSize: 14, fontWeight: '700', color: TOKEN.text1, marginBottom: 2 },
  hitSub: { fontSize: 11, color: TOKEN.text2 },
  chevron: { fontSize: 18, color: TOKEN.text3 },
  bldgInfo: {
    padding: 14,
    backgroundColor: TOKEN.coldBg,
    borderRadius: TOKEN.r.md,
    marginBottom: 14,
  },
  bldgInfoTop: { fontSize: 11, color: TOKEN.text2, marginBottom: 4 },
  bldgInfoTitle: { fontSize: 15, fontWeight: '800', color: TOKEN.text1 },
  bldgInfoCode: { color: TOKEN.text3, fontWeight: '600' },
  primaryBtn: {
    padding: 14,
    backgroundColor: TOKEN.cold,
    borderRadius: TOKEN.r.lg,
    alignItems: 'center',
    marginBottom: 18,
  },
  primaryBtnDisabled: { backgroundColor: TOKEN.border },
  primaryBtnText: { color: '#fff', fontSize: 14, fontWeight: '700' },
  submitErrBox: { marginTop: 10, padding: 10, backgroundColor: TOKEN.hotBg, borderRadius: TOKEN.r.md },
  submitErrText: { fontSize: 12, color: TOKEN.hot },
  roomHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  toggleText: { fontSize: 11, color: TOKEN.cold, fontWeight: '700' },
  floorLabel: { fontSize: 11, fontWeight: '700', color: TOKEN.text2, marginBottom: 6 },
  roomGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  roomBtn: {
    minWidth: 64,
    padding: 8,
    borderRadius: TOKEN.r.sm,
    borderWidth: 1,
    alignItems: 'center',
  },
  roomBtnDisabled: { opacity: 0.5 },
  roomNum: { fontSize: 13, fontWeight: '800', color: TOKEN.text1 },
  roomLabel: { fontSize: 10, color: TOKEN.text2, marginTop: 2, maxWidth: 80 },
});
