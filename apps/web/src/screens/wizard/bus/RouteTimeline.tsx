'use client';

// 시각적 timeline picker — 노선 정류장 list + vehicle icon overlay.
// 사용자가 자기 탑승 버스를 직접 클릭 (정류장 이름 입력 폐기).
// 사용자 정책: "정류장 이름 외우는 사람 없다 → 시각적으로 보여주고 선택"

import { useEffect, useMemo, useRef } from 'react';
import { TOKEN, FONT } from '@aircon/core';
import type { BusRouteStation, BusVehiclePosition } from '@aircon/core';

interface Props {
  stations: BusRouteStation[];
  vehicles: BusVehiclePosition[];
  selectedVehId: string | null;
  onPickVehicle: (v: BusVehiclePosition) => void;
  // GPS로 사용자 위치 → 가까운 정류장 자동 scroll center용 (Phase D).
  userLatLng?: { lat: number; lng: number } | null;
}

// 정류장당 vehicle index — { [stOrd]: vehicles[] }
function indexByStop(vehicles: BusVehiclePosition[]): Map<number, BusVehiclePosition[]> {
  const m = new Map<number, BusVehiclePosition[]>();
  for (const v of vehicles) {
    const arr = m.get(v.stOrd) ?? [];
    arr.push(v);
    m.set(v.stOrd, arr);
  }
  return m;
}

// Haversine — 두 좌표 거리 (m). GPS 사용자 위치 → 가까운 정류장.
function distanceM(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const R = 6371000;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const aa = Math.sin(dLat / 2) ** 2 + Math.cos((a.lat * Math.PI) / 180) * Math.cos((b.lat * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(aa));
}

export function RouteTimeline({ stations, vehicles, selectedVehId, onPickVehicle, userLatLng }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const byStop = useMemo(() => indexByStop(vehicles), [vehicles]);

  // 가까운 정류장 자동 scroll center.
  const nearestStopSeq = useMemo(() => {
    if (!userLatLng) return null;
    let best: { seq: number; d: number } | null = null;
    for (const s of stations) {
      if (s.x == null || s.y == null) continue;
      const d = distanceM(userLatLng, { lat: s.y, lng: s.x });
      if (!best || d < best.d) best = { seq: s.seq, d };
    }
    return best && best.d < 2000 ? best.seq : null; // 2km 이내일 때만 의미.
  }, [userLatLng, stations]);

  useEffect(() => {
    if (!nearestStopSeq || !containerRef.current) return;
    const target = containerRef.current.querySelector<HTMLElement>(`[data-stop-seq="${nearestStopSeq}"]`);
    if (target) target.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, [nearestStopSeq]);

  if (stations.length === 0) {
    return <div style={{ padding: 20, fontSize: 12, color: TOKEN.text3 }}>노선 정보 없음</div>;
  }

  return (
    <div ref={containerRef} style={{
      fontFamily: FONT,
      background: TOKEN.surface,
      borderRadius: TOKEN.r.md,
      border: `1px solid ${TOKEN.border}`,
      maxHeight: '60vh',
      overflowY: 'auto',
      position: 'relative',
    }}>
      {stations.map((s, i) => {
        const here = byStop.get(s.seq) ?? [];
        const isNearest = nearestStopSeq === s.seq;
        const isFirst = i === 0;
        const isLast = i === stations.length - 1;
        return (
          <div
            key={s.seq}
            data-stop-seq={s.seq}
            style={{
              display: 'flex', alignItems: 'center', gap: 10,
              padding: '10px 14px',
              borderBottom: isLast ? 'none' : `1px solid ${TOKEN.border}`,
              background: isNearest ? '#EFF6FF' : 'transparent',
              position: 'relative',
              minHeight: 52,
            }}
          >
            {/* Left: 정류장 dot + 라인 (timeline 형식) */}
            <div style={{ position: 'relative', width: 16, height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', flexShrink: 0 }}>
              <div style={{ position: 'absolute', top: 0, bottom: 0, left: 7, width: 2, background: TOKEN.border }} />
              <div style={{
                position: 'relative', zIndex: 1,
                width: 12, height: 12, borderRadius: '50%',
                background: isFirst || isLast ? TOKEN.cold : '#fff',
                border: `2.5px solid ${TOKEN.cold}`,
                marginTop: 18,
              }} />
            </div>
            {/* Mid: 정류장 이름 */}
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{
                fontSize: 13.5,
                fontWeight: isFirst || isLast || isNearest ? 800 : 600,
                color: TOKEN.text1,
                whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
              }}>
                {s.name}
              </div>
              {isNearest && (
                <div style={{ fontSize: 10.5, color: '#1E40AF', marginTop: 2, fontWeight: 700 }}>📍 내 위치 근처</div>
              )}
            </div>
            {/* Right: vehicle icons (이 stOrd에 있는 차량들) */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4, alignItems: 'flex-end', flexShrink: 0 }}>
              {here.map((v) => {
                const active = selectedVehId === v.vehId;
                return (
                  <button
                    key={v.vehId}
                    onClick={() => onPickVehicle(v)}
                    style={{
                      display: 'inline-flex', alignItems: 'center', gap: 6,
                      padding: '6px 10px',
                      background: active ? TOKEN.cold : '#fff',
                      border: `2px solid ${active ? TOKEN.cold : TOKEN.border}`,
                      borderRadius: 999,
                      cursor: 'pointer',
                      fontFamily: FONT,
                      transition: 'all 0.15s',
                    }}
                  >
                    <BusIcon active={active} />
                    <span style={{
                      fontSize: 11.5,
                      fontWeight: 800,
                      color: active ? '#fff' : TOKEN.text1,
                      fontVariantNumeric: 'tabular-nums',
                    }}>{v.plainNo}</span>
                    {v.stopFlag === '1' && !active && (
                      <span style={{ fontSize: 9.5, color: TOKEN.cold, fontWeight: 700 }}>도착</span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function BusIcon({ active }: { active: boolean }) {
  const color = active ? '#fff' : TOKEN.text1;
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="5" y="3" width="14" height="14" rx="2.5" stroke={color} strokeWidth="2" />
      <line x1="5" y1="9" x2="19" y2="9" stroke={color} strokeWidth="1.5" />
      <circle cx="8" cy="19" r="1.5" fill={color} />
      <circle cx="16" cy="19" r="1.5" fill={color} />
    </svg>
  );
}
