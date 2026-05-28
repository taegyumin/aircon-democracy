'use client';

// 지방 도시철도 (부산·대구·광주·대전·인천2) 역 단위 본문 컴포넌트.
// SubwayWizard에서 mode='regional' 토글 시 본문에 임베드 — header는 부모가 렌더.
// placeId = subway-station:{subwayStationId} 예) subway-station:MTRBS1119
// swopenAPI cover X 노선의 차량 단위 식별 불가 → station-level 투표.

import { useEffect, useState } from 'react';
import { TOKEN, FONT } from '@aircon/core';
import type { RegionalSubwayStation } from '@aircon/core';
import { api } from '../../../lib/apiClient';
import { Label } from '../Label';
import { fieldStyle, primaryButtonStyle } from '../styles';

interface Props {
  onPicked: (placeId: string) => void;
}

const REGIONS = [
  { value: 'all',      label: '전체' },
  { value: 'busan',    label: '부산' },
  { value: 'daegu',    label: '대구' },
  { value: 'gwangju',  label: '광주' },
  { value: 'daejeon',  label: '대전' },
  { value: 'incheon2', label: '인천2호선' },
] as const;

export function RegionalSubwayBody({ onPicked }: Props) {
  const [query, setQuery] = useState('');
  const [region, setRegion] = useState<typeof REGIONS[number]['value']>('all');
  const [stations, setStations] = useState<RegionalSubwayStation[]>([]);
  const [picked, setPicked] = useState<RegionalSubwayStation | null>(null);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 검색어 디바운스 (300ms) — 입력 시 TAGO 호출 과도 방지.
  useEffect(() => {
    const q = query.trim();
    if (q.length < 1) { setStations([]); setPicked(null); return; }
    setLoading(true);
    setError(null);
    const t = setTimeout(() => {
      let cancelled = false;
      api.searchRegionalSubwayStations(q, region).then((d) => {
        if (cancelled) return;
        setStations(d.stations);
        setLoading(false);
      }).catch((e: Error) => {
        if (cancelled) return;
        setError(e.message); setLoading(false);
      });
      return () => { cancelled = true; };
    }, 300);
    return () => clearTimeout(t);
  }, [query, region]);

  const confirm = async () => {
    if (!picked) return;
    setSubmitting(true);
    setError(null);
    try {
      const placeId = `subway-station:${picked.subwayStationId}`;
      await api.upsertPlace({
        id: placeId,
        name: `${picked.subwayStationName} (${picked.subwayRouteName})`,
        type: 'subway',
        detail: `${REGIONS.find((r) => r.value === picked.region)?.label ?? ''} · ${picked.subwayRouteName}`,
      });
      onPicked(placeId);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div style={{ fontFamily: FONT }}>
        <div style={{ marginBottom: 14, padding: 12, background: '#FEF3C7', borderRadius: TOKEN.r.md, fontSize: 12, color: '#92400E', lineHeight: 1.5 }}>
          이 지역은 차량 단위 식별이 어려워 역 단위로 투표합니다.
        </div>

        <Label>지역</Label>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 22 }}>
          {REGIONS.map((r) => {
            const active = region === r.value;
            return (
              <button key={r.value} onClick={() => setRegion(r.value)} style={{
                padding: '8px 14px',
                background: active ? TOKEN.cold : TOKEN.surface,
                color: active ? '#fff' : TOKEN.text1,
                border: `1.5px solid ${active ? TOKEN.cold : TOKEN.border}`,
                borderRadius: 999, fontSize: 13, fontWeight: 700,
                cursor: 'pointer', fontFamily: FONT,
              }}>{r.label}</button>
            );
          })}
        </div>

        <Label>역 이름</Label>
        <input
          value={query}
          onChange={(e) => { setQuery(e.target.value); setPicked(null); }}
          placeholder="예: 서면, 동대구, 문화전당"
          style={{ ...fieldStyle(!!query), marginBottom: 14 }}
        />

        {loading && <div style={{ fontSize: 12, color: TOKEN.text3, padding: '8px 4px' }}>검색 중…</div>}

        {!loading && stations.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 22 }}>
            {stations.map((s) => {
              const active = picked?.subwayStationId === s.subwayStationId;
              return (
                <button key={s.subwayStationId} onClick={() => setPicked(active ? null : s)} style={{
                  textAlign: 'left',
                  padding: '12px 14px',
                  background: active ? TOKEN.coldBg : TOKEN.surface,
                  border: `1.5px solid ${active ? TOKEN.cold : TOKEN.border}`,
                  borderRadius: TOKEN.r.md,
                  cursor: 'pointer', fontFamily: FONT,
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8,
                }}>
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 700, color: TOKEN.text1 }}>{s.subwayStationName}</div>
                    <div style={{ fontSize: 11, color: TOKEN.text3, marginTop: 2 }}>{s.subwayRouteName}</div>
                  </div>
                  <div style={{ fontSize: 11, color: TOKEN.text3 }}>
                    {REGIONS.find((r) => r.value === s.region)?.label}
                  </div>
                </button>
              );
            })}
          </div>
        )}

        {!loading && query.trim() && stations.length === 0 && (
          <div style={{ fontSize: 12, color: TOKEN.text3, padding: '8px 4px', marginBottom: 22 }}>
            검색 결과가 없어요. 다른 키워드로 시도해보세요.
          </div>
        )}

        {error && (
          <div style={{ marginBottom: 14, padding: 10, background: TOKEN.hotBg, color: TOKEN.hot, borderRadius: TOKEN.r.md, fontSize: 12 }}>{error}</div>
        )}

        <button onClick={confirm} disabled={!picked || submitting} style={primaryButtonStyle(!!picked && !submitting)}>
          {submitting ? '이동 중…' : '투표하러 가기'}
        </button>
    </div>
  );
}
