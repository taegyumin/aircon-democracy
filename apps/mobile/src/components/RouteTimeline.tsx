// 시각적 timeline picker (RN) — web RouteTimeline.tsx 포팅.
// 노선 정류장 list (vertical timeline) + 정류장별 vehicle pill.
// 사용자 정책 (2026-05-28): "정류장 이름 외우는 사람 없다. 시각적으로 보여주고 선택"
// GPS 사용자 위치 → 가까운 정류장 자동 scroll center (2km 이내일 때만).

import { useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, Pressable, ScrollView, StyleSheet } from 'react-native';
import Svg, { Rect, Line, Circle } from 'react-native-svg';
import { TOKEN } from '@aircon/core';
import type { BusRouteStation, BusVehiclePosition } from '@aircon/core';

interface Props {
  stations: BusRouteStation[];
  vehicles: BusVehiclePosition[];
  selectedVehId: string | null;
  onPickVehicle: (v: BusVehiclePosition) => void;
  userLatLng?: { lat: number; lng: number } | null;
}

function indexByStop(vehicles: BusVehiclePosition[]): Map<number, BusVehiclePosition[]> {
  const m = new Map<number, BusVehiclePosition[]>();
  for (const v of vehicles) {
    const arr = m.get(v.stOrd) ?? [];
    arr.push(v);
    m.set(v.stOrd, arr);
  }
  return m;
}

function distanceM(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const R = 6371000;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const aa = Math.sin(dLat / 2) ** 2 + Math.cos((a.lat * Math.PI) / 180) * Math.cos((b.lat * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(aa));
}

export function RouteTimeline({ stations, vehicles, selectedVehId, onPickVehicle, userLatLng }: Props) {
  const scrollRef = useRef<ScrollView>(null);
  const stopYRef = useRef<Map<number, number>>(new Map());
  const [scrolled, setScrolled] = useState(false);
  const byStop = useMemo(() => indexByStop(vehicles), [vehicles]);

  const nearestStopSeq = useMemo(() => {
    if (!userLatLng) return null;
    let best: { seq: number; d: number } | null = null;
    for (const s of stations) {
      if (s.x == null || s.y == null) continue;
      const d = distanceM(userLatLng, { lat: s.y, lng: s.x });
      if (!best || d < best.d) best = { seq: s.seq, d };
    }
    return best && best.d < 2000 ? best.seq : null;
  }, [userLatLng, stations]);

  // 한 번만 자동 scroll. 사용자가 직접 스크롤 후 데이터 refetch돼도 위치 유지.
  useEffect(() => {
    if (!nearestStopSeq || scrolled) return;
    const y = stopYRef.current.get(nearestStopSeq);
    if (y != null && scrollRef.current) {
      scrollRef.current.scrollTo({ y: Math.max(0, y - 120), animated: true });
      setScrolled(true);
    }
  }, [nearestStopSeq, scrolled, stations]);

  if (stations.length === 0) {
    return <View style={styles.empty}><Text style={styles.emptyText}>노선 정보 없음</Text></View>;
  }

  return (
    <ScrollView
      ref={scrollRef}
      style={styles.container}
      nestedScrollEnabled
    >
      {stations.map((s, i) => {
        const here = byStop.get(s.seq) ?? [];
        const isNearest = nearestStopSeq === s.seq;
        const isFirst = i === 0;
        const isLast = i === stations.length - 1;
        return (
          <View
            key={s.seq}
            onLayout={(e) => { stopYRef.current.set(s.seq, e.nativeEvent.layout.y); }}
            style={[styles.row, isNearest && styles.rowNear, isLast && styles.rowLast]}
          >
            {/* Left timeline: dot + 라인 */}
            <View style={styles.timeline}>
              <View style={styles.timelineLine} />
              <View style={[styles.dot, (isFirst || isLast) && styles.dotEnd]} />
            </View>
            {/* Mid: 정류장 이름 */}
            <View style={styles.mid}>
              <Text
                style={[styles.stopName, (isFirst || isLast || isNearest) && styles.stopNameBold]}
                numberOfLines={1}
              >
                {s.name}
              </Text>
              {isNearest && <Text style={styles.nearLabel}>📍 내 위치 근처</Text>}
            </View>
            {/* Right: vehicle pills */}
            <View style={styles.right}>
              {here.map((v) => {
                const active = selectedVehId === v.vehId;
                return (
                  <Pressable
                    key={v.vehId}
                    onPress={() => onPickVehicle(v)}
                    style={[styles.pill, active && styles.pillActive]}
                  >
                    <BusIcon active={active} />
                    <Text style={[styles.plainNo, active && styles.plainNoActive]}>{v.plainNo}</Text>
                    {v.stopFlag === '1' && !active && (
                      <Text style={styles.arrived}>도착</Text>
                    )}
                  </Pressable>
                );
              })}
            </View>
          </View>
        );
      })}
    </ScrollView>
  );
}

function BusIcon({ active }: { active: boolean }) {
  const color = active ? '#fff' : TOKEN.text1;
  return (
    <Svg width={16} height={16} viewBox="0 0 24 24">
      <Rect x={5} y={3} width={14} height={14} rx={2.5} stroke={color} strokeWidth={2} fill="none" />
      <Line x1={5} y1={9} x2={19} y2={9} stroke={color} strokeWidth={1.5} />
      <Circle cx={8} cy={19} r={1.5} fill={color} />
      <Circle cx={16} cy={19} r={1.5} fill={color} />
    </Svg>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: TOKEN.surface,
    borderRadius: TOKEN.r.md,
    borderWidth: 1,
    borderColor: TOKEN.border,
    maxHeight: 520,
  },
  empty: { padding: 20 },
  emptyText: { fontSize: 12, color: TOKEN.text3 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 10,
    borderBottomWidth: 1,
    borderBottomColor: TOKEN.border,
    minHeight: 52,
  },
  rowNear: { backgroundColor: '#EFF6FF' },
  rowLast: { borderBottomWidth: 0 },
  timeline: { width: 16, height: '100%', alignItems: 'center', justifyContent: 'flex-start', flexShrink: 0 },
  timelineLine: { position: 'absolute', top: 0, bottom: 0, left: 7, width: 2, backgroundColor: TOKEN.border },
  dot: {
    width: 12, height: 12, borderRadius: 6,
    backgroundColor: '#fff',
    borderWidth: 2.5, borderColor: TOKEN.cold,
    marginTop: 18,
  },
  dotEnd: { backgroundColor: TOKEN.cold },
  mid: { flex: 1, minWidth: 0 },
  stopName: { fontSize: 13.5, fontWeight: '600', color: TOKEN.text1 },
  stopNameBold: { fontWeight: '800' },
  nearLabel: { fontSize: 10.5, color: '#1E40AF', marginTop: 2, fontWeight: '700' },
  right: { flexDirection: 'column', gap: 4, alignItems: 'flex-end', flexShrink: 0 },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 6,
    paddingHorizontal: 10,
    backgroundColor: '#fff',
    borderWidth: 2,
    borderColor: TOKEN.border,
    borderRadius: 999,
  },
  pillActive: { backgroundColor: TOKEN.cold, borderColor: TOKEN.cold },
  plainNo: { fontSize: 11.5, fontWeight: '800', color: TOKEN.text1 },
  plainNoActive: { color: '#fff' },
  arrived: { fontSize: 9.5, color: TOKEN.cold, fontWeight: '700' },
});
