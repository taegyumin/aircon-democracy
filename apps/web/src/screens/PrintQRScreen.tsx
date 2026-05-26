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
    <>
      <style>{`
        @media print {
          .no-print { display: none !important; }
          .print-page { width: 100%; min-height: 100vh; padding: 0 !important; }
          body { background: white !important; }
        }
        @page { size: A4; margin: 18mm; }
      `}</style>

      <div className="no-print" style={{ background: TOKEN.bg, padding: '14px 20px', display: 'flex', alignItems: 'center', gap: 12, borderBottom: `1px solid ${TOKEN.border}`, fontFamily: FONT }}>
        <button onClick={onBack} style={{ background: 'none', border: 'none', cursor: 'pointer', color: TOKEN.text2, fontSize: 14, fontFamily: FONT }}>← 뒤로</button>
        <div style={{ flex: 1, fontSize: 14, fontWeight: 700, color: TOKEN.text1 }}>{place.name} — 인쇄용 QR</div>
        <button onClick={() => window.print()} style={btnPrimary}>인쇄</button>
      </div>

      <div
        className="print-page"
        style={{
          minHeight: 'calc(100vh - 60px)',
          background: '#fff',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '40px 20px',
          fontFamily: FONT,
          color: '#1A1A1F',
        }}
      >
        <div style={{ fontSize: 28, fontWeight: 900, letterSpacing: '-0.5px', marginBottom: 6, textAlign: 'center' }}>
          여기 에어컨, 어떠세요?
        </div>
        <div style={{ fontSize: 14, color: '#6B6B7A', marginBottom: 28 }}>익명으로 30초면 끝나요</div>

        <div style={{ padding: 16, background: '#fff', border: `2px solid #E2E2EC`, borderRadius: 16 }}>
          <QRCodeCanvas value={placeQRUrl(place.id)} size={320} level="M" includeMargin={false} fgColor="#1A1A1F" bgColor="#ffffff" />
        </div>

        <div style={{ marginTop: 24, textAlign: 'center' }}>
          <div style={{ fontSize: 22, fontWeight: 800, marginBottom: 4 }}>{place.name}</div>
          {place.district && <div style={{ fontSize: 13, color: '#6B6B7A' }}>{place.district}</div>}
        </div>

        <div style={{ marginTop: 32, display: 'flex', alignItems: 'center', gap: 32, color: '#6B6B7A', fontSize: 13 }}>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 28, marginBottom: 4 }}>📷</div>
            <div>휴대폰 카메라로<br />QR을 비추세요</div>
          </div>
          <div style={{ fontSize: 24, color: '#A0A0AE' }}>→</div>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 28, marginBottom: 4 }}>🌡️</div>
            <div>추워요 / 적당해요 /<br />더워요 중 하나 탭</div>
          </div>
          <div style={{ fontSize: 24, color: '#A0A0AE' }}>→</div>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 28, marginBottom: 4 }}>✅</div>
            <div>지금 분위기를<br />함께 만들어주세요</div>
          </div>
        </div>

        <div style={{ marginTop: 40, fontSize: 11, color: '#A0A0AE' }}>aircondemocracy.com</div>
      </div>
    </>
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
