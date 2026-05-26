'use client';

// Wizard 첫 화면 — 카테고리 grid + (옵션) 가까운 역 빠른 진입.
// 검색창 제거됨 (2026-05-26 사용자 결정): 카테고리별 흐름이 달라 통합 검색 의미 없음.

import { useEffect, useMemo, useState } from 'react';
import { LocateFixed } from 'lucide-react';
import { TOKEN, FONT, STATIONS, distanceM, type Coords, type Station } from '@aircon/core';
import { requestCoords } from '@/lib/geoClient';
import { api } from '@/lib/apiClient';
import { CATEGORIES, type Category } from './categories';
import { StationRow } from './StationRow';
import { WizardHeader } from './WizardHeader';

interface Props {
  onPickCategory: (k: Category) => void;
  onPickPlaceId: (id: string) => void;
  onBack: () => void;
}

interface NearbyHit { station: Station; dist: number }

export function WizardLanding({ onPickCategory, onPickPlaceId, onBack }: Props) {
  const [coords, setCoords] = useState<Coords | null>(null);
  const [geoLoading, setGeoLoading] = useState(false);
  const [geoError, setGeoError] = useState<string | null>(null);
  const [showGeoSheet, setShowGeoSheet] = useState(false);
  const [submitting, setSubmitting] = useState<string | null>(null);

  const nearby: NearbyHit[] = useMemo(() => {
    if (!coords) return [];
    return STATIONS
      .filter((s) => typeof s.lat === 'number' && typeof s.lng === 'number')
      .map((s) => ({ station: s, dist: distanceM(coords, { lat: s.lat as number, lng: s.lng as number }) }))
      .filter((x) => x.dist < 1500)
      .sort((a, b) => a.dist - b.dist)
      .slice(0, 6);
  }, [coords]);

  useEffect(() => {
    if (!showGeoSheet) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setShowGeoSheet(false); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [showGeoSheet]);

  const runGeo = async () => {
    setShowGeoSheet(false);
    setGeoLoading(true);
    setGeoError(null);
    try {
      setCoords(await requestCoords());
    } catch (e) {
      const code = (e as Error).message;
      setGeoError(
        code === 'denied' ? '위치 권한이 차단됐어요'
          : code === 'timeout' ? '위치를 못 찾았어요'
          : '위치를 사용할 수 없어요'
      );
    } finally {
      setGeoLoading(false);
    }
  };

  const pickStation = async (s: Station) => {
    if (submitting) return;
    setSubmitting(s.id);
    try {
      // Fast lane: station-level place. Granular subway:line:station:car는 subway wizard.
      const id = `subway:${s.name}:${s.lines.join(',')}`;
      await api.upsertPlace({
        id,
        name: s.name,
        type: 'subway',
        district: s.city + (s.areas[0] ? ' ' + s.areas[0] : ''),
        detail: s.lines.join(' · '),
      });
      onPickPlaceId(id);
    } catch {
      setSubmitting(null);
    }
  };

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', background: TOKEN.bg, fontFamily: FONT }}>
      <WizardHeader title="지금 어디 계세요?" onBack={onBack} />
      <div style={{ flex: 1, overflowY: 'auto', padding: '20px 20px 60px' }}>
        {!coords && !geoLoading && !geoError && (
          <button
            onClick={() => setShowGeoSheet(true)}
            style={{
              display: 'flex', alignItems: 'center', gap: 12,
              width: '100%', padding: '14px 16px',
              background: TOKEN.coldBg,
              border: `1.5px dashed ${TOKEN.cold}55`,
              borderRadius: TOKEN.r.lg, cursor: 'pointer', fontFamily: FONT,
              marginBottom: 18, textAlign: 'left',
            }}
          >
            <div style={{ width: 36, height: 36, borderRadius: 10, background: TOKEN.cold, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <LocateFixed size={18} color="#fff" strokeWidth={2.2} />
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: TOKEN.cold }}>근처 역 찾기</div>
              <div style={{ fontSize: 11, color: TOKEN.text2, marginTop: 2 }}>위치는 저장하지 않아요</div>
            </div>
          </button>
        )}
        {geoLoading && (
          <div style={{ padding: '14px', textAlign: 'center', fontSize: 12, color: TOKEN.text3, marginBottom: 18 }}>
            위치 찾는 중…
          </div>
        )}
        {geoError && (
          <div style={{ padding: '12px 14px', background: TOKEN.hotBg, color: TOKEN.hot, borderRadius: TOKEN.r.md, fontSize: 12, marginBottom: 18 }}>
            {geoError} — 아래서 직접 선택하세요
          </div>
        )}
        {coords && nearby.length > 0 && (
          <div style={{ marginBottom: 18 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: TOKEN.text2, marginBottom: 8, letterSpacing: '0.3px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span>📍 가까운 역</span>
              <button onClick={() => { setCoords(null); setGeoError(null); }} style={{ background: 'none', border: 'none', color: TOKEN.text3, fontSize: 11, cursor: 'pointer', fontFamily: FONT }}>숨기기</button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {nearby.map((h) => (
                <StationRow
                  key={h.station.id}
                  station={h.station}
                  distance={h.dist}
                  loading={submitting === `subway:${h.station.name}:${h.station.lines.join(',')}`}
                  onTap={() => pickStation(h.station)}
                />
              ))}
            </div>
          </div>
        )}
        {coords && nearby.length === 0 && (
          <div style={{ padding: '12px', fontSize: 12, color: TOKEN.text3, textAlign: 'center', marginBottom: 18 }}>
            1.5km 안에 등록된 역이 없어요
          </div>
        )}

        <div style={{ fontSize: 12, fontWeight: 700, color: TOKEN.text2, marginBottom: 10, letterSpacing: '0.3px' }}>
          유형으로 찾기
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
          {CATEGORIES.map((c) => {
            const Icon = c.Icon;
            return (
              <button
                key={c.key}
                onClick={() => onPickCategory(c.key)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 10,
                  padding: '14px 12px',
                  borderRadius: TOKEN.r.lg,
                  border: `1.5px solid ${TOKEN.border}`,
                  background: TOKEN.surface,
                  cursor: 'pointer', fontFamily: FONT, textAlign: 'left',
                }}
              >
                <div style={{ width: 32, height: 32, borderRadius: 9, background: c.tint + '15', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <Icon size={18} color={c.tint} strokeWidth={2.1} />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 800, color: TOKEN.text1, letterSpacing: '-0.2px' }}>{c.label}</div>
                  <div style={{ fontSize: 10, color: TOKEN.text3, marginTop: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.sub}</div>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {showGeoSheet && (
        <div
          onClick={() => setShowGeoSheet(false)}
          style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 100, display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{ background: TOKEN.surface, borderTopLeftRadius: TOKEN.r.xl, borderTopRightRadius: TOKEN.r.xl, padding: '22px 22px 30px', maxWidth: 420, width: '100%' }}
          >
            <div style={{ fontSize: 17, fontWeight: 900, color: TOKEN.text1, marginBottom: 8, letterSpacing: '-0.3px' }}>
              근처 역 찾기
            </div>
            <div style={{ fontSize: 13, color: TOKEN.text2, lineHeight: 1.6, marginBottom: 22 }}>
              가까운 지하철역을 보여드릴게요.<br />
              <b>위치 정보는 서버에 저장되지 않고</b>, 추천에만 잠깐 사용해요.
            </div>
            <button onClick={runGeo} style={{ width: '100%', padding: '14px', background: TOKEN.cold, color: '#fff', border: 'none', borderRadius: TOKEN.r.lg, fontSize: 15, fontWeight: 700, cursor: 'pointer', fontFamily: FONT, marginBottom: 8 }}>
              위치 허용하기
            </button>
            <button onClick={() => setShowGeoSheet(false)} style={{ width: '100%', padding: '14px', background: 'none', color: TOKEN.text2, border: 'none', fontSize: 14, cursor: 'pointer', fontFamily: FONT }}>
              취소
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
