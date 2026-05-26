'use client';

import { useRef } from 'react';
import { QRCodeCanvas } from 'qrcode.react';
import { TOKEN, FONT } from '@aircon/core';

interface Props {
  placeId: string;
  size?: number;
  label?: string;
  showDownload?: boolean;
}

export function placeQRUrl(placeId: string): string {
  return `https://aircondemocracy.com/p/${encodeURIComponent(placeId)}?via=qr`;
}

export function PlaceQR({ placeId, size = 180, label, showDownload = false }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const url = placeQRUrl(placeId);

  const downloadPNG = () => {
    const canvas = ref.current?.querySelector('canvas');
    if (!canvas) return;
    canvas.toBlob((blob) => {
      if (!blob) return;
      const link = document.createElement('a');
      const safeId = placeId.replace(/[^a-z0-9가-힣_-]+/gi, '_').slice(0, 60);
      link.href = URL.createObjectURL(blob);
      link.download = `aircon-${safeId}.png`;
      link.click();
      URL.revokeObjectURL(link.href);
    }, 'image/png');
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
      <div
        ref={ref}
        style={{
          background: '#fff',
          padding: 12,
          borderRadius: TOKEN.r.md,
          border: `1px solid ${TOKEN.border}`,
          display: 'inline-flex',
        }}
      >
        <QRCodeCanvas
          value={url}
          size={size}
          level="M"
          includeMargin={false}
          bgColor="#ffffff"
          fgColor="#1A1A1F"
        />
      </div>
      {label && <div style={{ fontSize: 11, color: TOKEN.text3, fontFamily: FONT }}>{label}</div>}
      {showDownload && (
        <button
          onClick={downloadPNG}
          style={{
            marginTop: 4,
            padding: '6px 14px',
            background: TOKEN.cold,
            color: '#fff',
            border: 'none',
            borderRadius: TOKEN.r.sm,
            fontSize: 12,
            fontWeight: 700,
            cursor: 'pointer',
            fontFamily: FONT,
          }}
        >
          PNG 다운로드
        </button>
      )}
    </div>
  );
}
