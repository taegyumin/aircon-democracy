'use client';

import { useEffect, useRef, useState } from 'react';
import { TOKEN, FONT, type PoiResult } from '@aircon/core';
import { api } from '../lib/apiClient';
import { loadNaverMaps, venuePlaceId, type NaverMap, type NaverMarker, type NaverLatLng } from '../lib/naverMaps';

interface Props {
  onConfirm: (input: { placeId: string; name: string; address: string; lat: number; lng: number }) => void;
}

// Default center: 시청역 (서울 중심)
const DEFAULT_CENTER = { lat: 37.5663, lng: 126.9779 };

export function NaverMapPicker({ onConfirm }: Props) {
  const mapDivRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<NaverMap | null>(null);
  const markerRef = useRef<NaverMarker | null>(null);
  const apiRef = useRef<Awaited<ReturnType<typeof loadNaverMaps>> | null>(null);
  // POI 검색 결과 마커들 (별도 set — selected marker와 분리해서 visible/hidden 전환).
  const poiMarkersRef = useRef<NaverMarker[]>([]);

  const [loadError, setLoadError] = useState<string | null>(null);
  const [picked, setPicked] = useState<{ lat: number; lng: number } | null>(null);
  const [address, setAddress] = useState<string>('');
  const [venueName, setVenueName] = useState<string>('');
  const [submitting, setSubmitting] = useState(false);

  // POI 검색 state
  const [query, setQuery] = useState('');
  const [searching, setSearching] = useState(false);
  const [poiResults, setPoiResults] = useState<PoiResult[] | null>(null);
  const [searchError, setSearchError] = useState<string | null>(null);

  // Load script + create map once
  useEffect(() => {
    let disposed = false;
    loadNaverMaps()
      .then((maps) => {
        if (disposed || !mapDivRef.current) return;
        apiRef.current = maps;
        const map = new maps.Map(mapDivRef.current, {
          center: new maps.LatLng(DEFAULT_CENTER.lat, DEFAULT_CENTER.lng),
          zoom: 16,
          scaleControl: false,
          mapDataControl: false,
          logoControlOptions: { position: 3 },
        });
        mapRef.current = map;

        maps.Event.addListener(map, 'click', (e: unknown) => {
          const coord = (e as { coord: NaverLatLng }).coord;
          handlePick(coord.lat(), coord.lng());
        });

        // Try to center on user location (best-effort)
        if ('geolocation' in navigator) {
          navigator.geolocation.getCurrentPosition(
            (pos) => {
              if (disposed || !mapRef.current || !apiRef.current) return;
              const here = new apiRef.current.LatLng(pos.coords.latitude, pos.coords.longitude);
              mapRef.current.setCenter(here);
            },
            () => { /* ignore geo errors */ },
            { timeout: 4000, maximumAge: 60_000 },
          );
        }
      })
      .catch((e) => {
        if (!disposed) setLoadError((e as Error).message);
      });
    return () => {
      disposed = true;
      poiMarkersRef.current.forEach((m) => m.setMap(null));
      poiMarkersRef.current = [];
      mapRef.current?.destroy();
      mapRef.current = null;
    };
  }, []);

  const handlePick = (lat: number, lng: number, prefilledName?: string, prefilledAddress?: string) => {
    setPicked({ lat, lng });
    if (prefilledName) setVenueName(prefilledName);
    if (prefilledAddress) setAddress(prefilledAddress);
    const maps = apiRef.current;
    if (!maps || !mapRef.current) return;
    const pos = new maps.LatLng(lat, lng);
    if (markerRef.current) {
      markerRef.current.setPosition(pos);
    } else {
      markerRef.current = new maps.Marker({ position: pos, map: mapRef.current });
    }
    mapRef.current.panTo(pos);

    // POI 결과로 prefill 된 경우 reverse-geocode skip — 이미 주소 있음.
    if (prefilledAddress) return;

    // Reverse geocode for address label
    if (maps.Service) {
      maps.Service.reverseGeocode(
        { coords: pos, orders: 'roadaddr,addr' },
        (status, response) => {
          if (status === maps.Service?.Status.OK) {
            const addr = response.v2?.address?.roadAddress || response.v2?.address?.jibunAddress || '';
            setAddress(addr);
          }
        },
      );
    }
  };

  // POI 검색 — 현재 지도 중심을 lat/lng로 넘김 (Kakao가 위치 기반 정렬).
  const runSearch = async () => {
    const q = query.trim();
    if (!q || searching) return;
    setSearching(true);
    setSearchError(null);
    const center = mapRef.current?.getCenter();
    const lat = center?.lat();
    const lng = center?.lng();
    try {
      const { results } = await api.searchPoi(q, lat != null && lng != null ? { lat, lng } : undefined);
      setPoiResults(results);
      // 지도에 결과 마커 표시 (기존 결과 마커 제거 후)
      drawPoiMarkers(results);
    } catch (e) {
      setSearchError((e as Error).message);
    } finally {
      setSearching(false);
    }
  };

  const drawPoiMarkers = (results: PoiResult[]) => {
    const maps = apiRef.current;
    if (!maps || !mapRef.current) return;
    poiMarkersRef.current.forEach((m) => m.setMap(null));
    poiMarkersRef.current = [];
    if (results.length === 0) return;
    // 결과에 맞춰 지도 panTo (첫 결과 위치).
    const first = results[0];
    mapRef.current.panTo(new maps.LatLng(first.lat, first.lng));
    for (const r of results) {
      const marker = new maps.Marker({
        position: new maps.LatLng(r.lat, r.lng),
        map: mapRef.current,
      });
      poiMarkersRef.current.push(marker);
    }
  };

  const handlePickPoi = (r: PoiResult) => {
    handlePick(r.lat, r.lng, r.name, r.address);
    setPoiResults(null); // result list 닫고 vote step으로
    // 결과 마커 정리 (선택된 위치에 markerRef가 다시 그려짐)
    poiMarkersRef.current.forEach((m) => m.setMap(null));
    poiMarkersRef.current = [];
  };

  const canConfirm = !!picked && venueName.trim().length > 0 && !submitting;

  const handleConfirm = () => {
    if (!picked || !venueName.trim()) return;
    setSubmitting(true);
    onConfirm({
      placeId: venuePlaceId(picked.lat, picked.lng),
      name: venueName.trim(),
      address,
      lat: picked.lat,
      lng: picked.lng,
    });
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Search bar overlay — 지도 위 상단에 floating */}
      <div style={{ position: 'relative', flex: 1, minHeight: 280, background: TOKEN.bg }}>
        <div ref={mapDivRef} style={{ position: 'absolute', inset: 0 }} />

        {!loadError && (
          <div
            style={{
              position: 'absolute', top: 10, left: 10, right: 10, zIndex: 10,
              display: 'flex', gap: 6, alignItems: 'center',
            }}
          >
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') runSearch(); }}
              placeholder="가게명 검색 (예: 스타벅스 강남R점)"
              style={{
                flex: 1, padding: '11px 14px', borderRadius: TOKEN.r.md,
                border: 'none', fontSize: 14, fontFamily: FONT, color: TOKEN.text1,
                background: TOKEN.surface, boxShadow: '0 2px 8px rgba(0,0,0,0.12)', outline: 'none',
              }}
            />
            <button
              onClick={runSearch}
              disabled={searching || !query.trim()}
              style={{
                padding: '11px 16px', borderRadius: TOKEN.r.md, border: 'none',
                background: searching || !query.trim() ? TOKEN.border : TOKEN.cold,
                color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: FONT,
                boxShadow: '0 2px 8px rgba(0,0,0,0.12)',
              }}
            >
              {searching ? '⋯' : '검색'}
            </button>
          </div>
        )}

        {loadError && (
          <div style={{
            position: 'absolute', inset: 0, display: 'flex',
            alignItems: 'center', justifyContent: 'center',
            padding: 20, textAlign: 'center',
            background: TOKEN.hotBg, color: TOKEN.hot, fontSize: 13, lineHeight: 1.6, fontFamily: FONT,
          }}>
            지도를 못 불러왔어요.<br />
            <span style={{ fontSize: 11, color: TOKEN.text2 }}>{loadError}</span>
          </div>
        )}
        {!picked && !loadError && !poiResults && (
          <div style={{
            position: 'absolute', bottom: 12, left: 10, right: 10,
            background: 'rgba(26,26,31,0.85)', color: '#fff',
            padding: '10px 14px', borderRadius: TOKEN.r.md,
            fontSize: 12, fontWeight: 600, fontFamily: FONT, textAlign: 'center',
            pointerEvents: 'none',
          }}>
            검색하거나 지도를 탭해서 위치를 찍어주세요
          </div>
        )}

        {/* POI 검색 결과 list — 지도 위에 overlay panel (사용자가 result 탭하면 닫힘) */}
        {poiResults !== null && (
          <div
            style={{
              position: 'absolute', top: 60, left: 10, right: 10, bottom: 12,
              background: TOKEN.surface, borderRadius: TOKEN.r.md,
              boxShadow: '0 4px 16px rgba(0,0,0,0.18)', overflowY: 'auto', zIndex: 9,
            }}
          >
            {poiResults.length === 0 ? (
              <div style={{ padding: 24, textAlign: 'center', color: TOKEN.text3, fontSize: 13, fontFamily: FONT }}>
                {searchError ? `검색 실패: ${searchError}` : '결과 없음. 다른 키워드로 검색하거나 지도를 탭해 직접 위치를 찍어보세요.'}
              </div>
            ) : (
              <div>
                <div style={{ padding: '10px 14px', fontSize: 11, color: TOKEN.text3, fontFamily: FONT, borderBottom: `1px solid ${TOKEN.border}` }}>
                  "{query}" 결과 {poiResults.length}개
                </div>
                {poiResults.map((r, i) => (
                  <button
                    key={`${r.source}:${r.externalId ?? i}`}
                    onClick={() => handlePickPoi(r)}
                    style={{
                      width: '100%', textAlign: 'left',
                      padding: '12px 14px', border: 'none', background: 'transparent',
                      borderBottom: `1px solid ${TOKEN.border}`,
                      cursor: 'pointer', fontFamily: FONT,
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, marginBottom: 3 }}>
                      <div style={{ fontSize: 14, fontWeight: 700, color: TOKEN.text1, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {r.name}
                      </div>
                      <span style={{ fontSize: 9, color: TOKEN.text3, letterSpacing: '0.5px', textTransform: 'uppercase' }}>{r.source}</span>
                    </div>
                    {r.category && (
                      <div style={{ fontSize: 11, color: TOKEN.text2, marginBottom: 2 }}>{r.category}</div>
                    )}
                    <div style={{ fontSize: 11, color: TOKEN.text3 }}>{r.address}</div>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      <div style={{ padding: '16px 18px 20px', background: TOKEN.surface, borderTop: `1px solid ${TOKEN.border}` }}>
        {picked && (
          <>
            {address && (
              <div style={{ fontSize: 12, color: TOKEN.text2, marginBottom: 10, lineHeight: 1.5 }}>
                📍 {address}
              </div>
            )}
            <div style={{ fontSize: 12, fontWeight: 700, color: TOKEN.text2, marginBottom: 8, letterSpacing: '0.3px' }}>
              가게 이름
            </div>
            <input
              value={venueName}
              onChange={(e) => setVenueName(e.target.value)}
              placeholder="예: 스타벅스 강남R점, 본죽 양재점"
              autoFocus
              style={{
                width: '100%', padding: '12px 14px',
                border: `2px solid ${venueName ? TOKEN.cold : TOKEN.border}`,
                borderRadius: TOKEN.r.md, fontSize: 14, fontFamily: FONT,
                color: TOKEN.text1, background: TOKEN.bg, outline: 'none', boxSizing: 'border-box',
              }}
            />
          </>
        )}
        <div style={{ height: 12 }} />
        <button
          onClick={handleConfirm}
          disabled={!canConfirm}
          style={{
            width: '100%', padding: '14px',
            background: canConfirm ? TOKEN.cold : TOKEN.border,
            color: '#fff', border: 'none', borderRadius: TOKEN.r.lg,
            fontSize: 15, fontWeight: 700, cursor: canConfirm ? 'pointer' : 'default',
            fontFamily: FONT,
            boxShadow: canConfirm ? `0 6px 20px ${TOKEN.cold}35` : 'none',
          }}
        >
          {submitting ? '이동 중…' : picked ? '투표하러 가기' : '먼저 검색하거나 지도에서 위치를 찍어주세요'}
        </button>
      </div>
    </div>
  );
}
