'use client';

import { useEffect, useState } from 'react';
import { QRCodeCanvas } from 'qrcode.react';
import { TOKEN, FONT } from '@aircon/core';
import { api, type ApiPlace } from '../lib/apiClient';
import { placeQRUrl } from '../components/PlaceQR';

interface Props {
  placeId: string;
  onBack: () => void;
}

export function PrintQRScreen({ placeId, onBack }: Props) {
  const [place, setPlace] = useState<ApiPlace | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api
      .getPlace(placeId)
      .then((d) => setPlace(d.place))
      .catch((e: Error) => setError(e.message));
  }, [placeId]);

  if (error) {
    return (
      <div style={{ padding: 40, fontFamily: FONT, textAlign: 'center' }}>
        <p style={{ color: TOKEN.hot }}>장소를 불러오지 못했어요: {error}</p>
        <button onClick={onBack} style={btn}>돌아가기</button>
      </div>
    );
  }
  if (!place) {
    return <div style={{ padding: 40, fontFamily: FONT, textAlign: 'center', color: TOKEN.text3 }}>불러오는 중…</div>;
  }

  return (
    // 단일 wrapper로 감싸기 — globals.css의 `body > * { min-height: 100vh }`가 Fragment
    // 풀린 두 형제 각각에 100vh 적용해 header가 100vh 차지 → 본문이 화면 밖으로 밀려나는
    // 회귀 (사용자 보고 2026-05-27). 한 wrapper면 body 자식 1개라 OK.
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
      <style>{`
        @media print {
          .no-print { display: none !important; }
          .print-page { width: 100%; min-height: 100vh; padding: 0 !important; }
          body { background: white !important; }
        }
        @page { size: A4; margin: 18mm; }
      `}</style>

      <div className="no-print" style={{ background: TOKEN.bg, padding: '14px 20px', display: 'flex', alignItems: 'center', gap: 12, borderBottom: `1px solid ${TOKEN.border}`, fontFamily: FONT, flexShrink: 0 }}>
        <button onClick={onBack} style={{ background: 'none', border: 'none', cursor: 'pointer', color: TOKEN.text2, fontSize: 14, fontFamily: FONT }}>← 뒤로</button>
        <div style={{ flex: 1, fontSize: 14, fontWeight: 700, color: TOKEN.text1 }}>{place.name} — 인쇄용 QR</div>
        <button onClick={() => window.print()} style={btnPrimary}>인쇄</button>
      </div>

      <div
        className="print-page"
        style={{
          flex: 1,
          background: '#fff',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          padding: '32px 24px 24px',
          fontFamily: FONT,
          color: '#1A1A1F',
        }}
      >
        {/* 워드마크 — 사용자 명시 (Claude Design Vote Share Redesign A4 template). */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
          <img src="/icon-192.png" alt="" style={{ width: 36, height: 36, borderRadius: 9 }} onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }} />
          <div>
            <div style={{ fontSize: 18, fontWeight: 900, letterSpacing: '-0.4px', lineHeight: 1.1 }}>에어컨 민주주의</div>
            <div style={{ fontSize: 9, color: '#A0A0AE', letterSpacing: '2.2px', marginTop: 2 }}>AIRCON DEMOCRACY</div>
          </div>
        </div>
        <div style={{ width: '100%', height: 1, background: '#E2E2EC', marginBottom: 32 }} />

        {/* 헤드라인 + 안내 문구 (사용자 채택 카피) */}
        <div style={{ textAlign: 'center', marginBottom: 28 }}>
          <div style={{ fontSize: 26, fontWeight: 900, letterSpacing: '-0.6px', lineHeight: 1.35, marginBottom: 12 }}>
            지금 여기,<br />에어컨 온도 어떠세요?
          </div>
          <div style={{ fontSize: 14, color: '#6B6B7A', lineHeight: 1.7 }}>
            QR 코드를 스캔하고
            <br />
            <span style={{ color: '#1B53E5', fontWeight: 700 }}>추워요</span>
            <span> · </span>
            <span style={{ color: '#16A34A', fontWeight: 700 }}>적당해요</span>
            <span> · </span>
            <span style={{ color: '#E52B1E', fontWeight: 700 }}>더워요</span>
            <span> 중 하나를 눌러주세요</span>
          </div>
        </div>

        {/* QR — large + bordered. */}
        <div style={{ padding: 18, background: '#fff', border: `2px solid #E2E2EC`, borderRadius: 16, boxShadow: '0 4px 18px rgba(0,0,0,0.06)' }}>
          <QRCodeCanvas value={placeQRUrl(place.id)} size={300} level="M" includeMargin={false} fgColor="#1A1A1F" bgColor="#ffffff" />
        </div>

        {/* 장소명 + URL */}
        <div style={{ marginTop: 24, textAlign: 'center' }}>
          <div style={{ fontSize: 20, fontWeight: 800, marginBottom: 4 }}>{place.name}</div>
          {place.district && <div style={{ fontSize: 13, color: '#6B6B7A' }}>{place.district}</div>}
          <div style={{ fontSize: 11, color: '#A0A0AE', marginTop: 6 }}>{`aircondemocracy.com/p/${place.id}`}</div>
        </div>

        {/* 사용자 요청: 하단 3개 컬러 타일 제거 + 옛 emoji 안내 row도 제거. */}
      </div>
    </div>
  );
}

const btn: React.CSSProperties = {
  padding: '10px 24px',
  background: TOKEN.cold,
  color: '#fff',
  border: 'none',
  borderRadius: TOKEN.r.lg,
  fontSize: 13,
  fontWeight: 700,
  cursor: 'pointer',
  fontFamily: FONT,
  marginTop: 16,
};

const btnPrimary: React.CSSProperties = {
  padding: '8px 18px',
  background: TOKEN.cold,
  color: '#fff',
  border: 'none',
  borderRadius: TOKEN.r.md,
  fontSize: 13,
  fontWeight: 700,
  cursor: 'pointer',
  fontFamily: FONT,
};
