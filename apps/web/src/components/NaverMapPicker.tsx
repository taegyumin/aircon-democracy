'use client';

import { useEffect, useRef, useState } from 'react';
import { TOKEN, FONT } from '@aircon/core';
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

  const [loadError, setLoadError] = useState<string | null>(null);
  const [picked, setPicked] = useState<{ lat: number; lng: number } | null>(null);
  const [address, setAddress] = useState<string>('');
  const [venueName, setVenueName] = useState<string>('');
  const [submitting, setSubmitting] = useState(false);

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
      mapRef.current?.destroy();
      mapRef.current = null;
    };
  }, []);

  const handlePick = (lat: number, lng: number) => {
    setPicked({ lat, lng });
    const maps = apiRef.current;
    if (!maps || !mapRef.current) return;
    const pos = new maps.LatLng(lat, lng);
    if (markerRef.current) {
      markerRef.current.setPosition(pos);
    } else {
      markerRef.current = new maps.Marker({ position: pos, map: mapRef.current });
    }
    mapRef.current.panTo(pos);

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
      <div style={{ position: 'relative', flex: 1, minHeight: 280, background: TOKEN.bg }}>
        <div ref={mapDivRef} style={{ position: 'absolute', inset: 0 }} />
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
        {!picked && !loadError && (
          <div style={{
            position: 'absolute', top: 10, left: 10, right: 10,
            background: 'rgba(26,26,31,0.85)', color: '#fff',
            padding: '10px 14px', borderRadius: TOKEN.r.md,
            fontSize: 12, fontWeight: 600, fontFamily: FONT, textAlign: 'center',
            pointerEvents: 'none',
          }}>
            지도를 탭해서 지금 있는 가게 위치를 찍어주세요
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
          {submitting ? '이동 중…' : picked ? '투표하러 가기' : '먼저 지도에서 위치를 찍어주세요'}
        </button>
      </div>
    </div>
  );
}
