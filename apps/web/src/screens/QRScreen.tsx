'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import jsQR from 'jsqr';
import { TOKEN, FONT } from '@aircon/core';
import { BackIcon } from '../components/Icons';
import { extractPlaceId } from '../lib/qrPlaceId';

interface Props {
  onBack: () => void;
  onSuccess: (placeId: string) => void;
}

type Phase = 'idle' | 'starting' | 'scanning' | 'denied' | 'unavailable' | 'found';

export function QRScreen({ onBack, onSuccess }: Props) {
  const [phase, setPhase] = useState<Phase>('idle');
  const [foundLabel, setFoundLabel] = useState('');
  const [errDetail, setErrDetail] = useState<string>('');
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const rafRef = useRef<number | null>(null);
  const stoppedRef = useRef(false);

  const stop = useCallback(() => {
    stoppedRef.current = true;
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = null;
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
  }, []);

  useEffect(() => () => stop(), [stop]);

  const start = useCallback(async () => {
    if (!navigator.mediaDevices?.getUserMedia) {
      setErrDetail('getUserMedia API 없음 (구버전 또는 비HTTPS)');
      setPhase('unavailable');
      return;
    }
    setPhase('starting');
    stoppedRef.current = false;
    setErrDetail('');
    // 일부 Safari는 facingMode constraint에 엄격해 ideal도 무시하고 throw.
    // Mac은 후면 카메라 없어서 더 흔함. 두 단계 시도 — environment 먼저, 실패 시 generic.
    const attempts: MediaStreamConstraints[] = [
      { video: { facingMode: { ideal: 'environment' } }, audio: false },
      { video: true, audio: false },
    ];
    let lastErr: { name?: string; message?: string } | null = null;
    for (const constraints of attempts) {
      try {
        const stream = await navigator.mediaDevices.getUserMedia(constraints);
        streamRef.current = stream;
        const video = videoRef.current!;
        video.srcObject = stream;
        await video.play();
        setPhase('scanning');
        tick();
        return;
      } catch (e) {
        lastErr = e as { name?: string; message?: string };
        // 권한 거부면 즉시 종료 — fallback 시도 의미 없음.
        if (lastErr.name === 'NotAllowedError' || lastErr.name === 'PermissionDeniedError') {
          setPhase('denied');
          return;
        }
        // 그 외 (NotFound/OverConstrained/NotReadable 등)는 다음 constraint 시도.
      }
    }
    setErrDetail(`${lastErr?.name ?? 'error'}: ${lastErr?.message ?? ''}`);
    setPhase('unavailable');
  }, []);

  const tick = useCallback(() => {
    if (stoppedRef.current) return;
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (video && canvas && video.readyState >= 2) {
      const w = video.videoWidth;
      const h = video.videoHeight;
      if (w && h) {
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(video, 0, 0, w, h);
          const img = ctx.getImageData(0, 0, w, h);
          const code = jsQR(img.data, w, h, { inversionAttempts: 'dontInvert' });
          if (code?.data) {
            const placeId = extractPlaceId(code.data);
            if (placeId) {
              setFoundLabel(placeId);
              setPhase('found');
              stop();
              setTimeout(() => onSuccess(placeId), 700);
              return;
            }
            // QR detected but not ours — keep scanning
          }
        }
      }
    }
    rafRef.current = requestAnimationFrame(tick);
  }, [stop, onSuccess]);

  return (
    <div style={{ height: '100%', background: '#0D0D13', display: 'flex', flexDirection: 'column', fontFamily: FONT, color: '#fff' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '68px 20px 16px' }}>
        <button onClick={() => { stop(); onBack(); }} style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center' }} aria-label="뒤로">
          <BackIcon color="rgba(255,255,255,0.75)" />
        </button>
        <span style={{ fontSize: 16, fontWeight: 700, opacity: 0.9 }}>QR 코드 스캔</span>
      </div>

      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', position: 'relative' }}>
        {phase === 'idle' && (
          <div style={{ textAlign: 'center', padding: '0 32px' }}>
            <div style={{ fontSize: 16, marginBottom: 20, opacity: 0.85 }}>
              매장에 부착된 QR을<br />카메라로 비춰주세요
            </div>
            <button onClick={start} style={btn}>카메라 시작</button>
          </div>
        )}
        {phase === 'starting' && <div style={{ opacity: 0.7 }}>카메라 준비 중…</div>}
        {phase === 'denied' && (
          <div style={{ textAlign: 'center', padding: '0 32px' }}>
            <div style={{ fontSize: 14, opacity: 0.85, marginBottom: 16 }}>
              카메라 권한이 차단됐어요.<br />브라우저 설정에서 허용하고 다시 시도해주세요.
            </div>
            <button onClick={onBack} style={btn}>돌아가기</button>
          </div>
        )}
        {phase === 'unavailable' && (
          <div style={{ textAlign: 'center', padding: '0 32px' }}>
            <div style={{ fontSize: 14, opacity: 0.85, marginBottom: 8 }}>
              이 기기/브라우저에서 카메라를 쓸 수 없어요.
            </div>
            {errDetail && (
              <div style={{ fontSize: 11, opacity: 0.5, marginBottom: 16, wordBreak: 'break-word' }}>
                {errDetail}
              </div>
            )}
            <div style={{ display: 'flex', gap: 8, justifyContent: 'center' }}>
              <button onClick={start} style={btn}>다시 시도</button>
              <button onClick={onBack} style={{ ...btn, background: 'rgba(255,255,255,0.1)' }}>돌아가기</button>
            </div>
          </div>
        )}
        {/* video element는 항상 mount — start() 호출 시점에 videoRef.current 채워져 있어야
            srcObject 할당 가능. scanning/found가 아니면 hidden으로 처리. */}
        <div
          style={{
            position: 'relative',
            width: '100%',
            maxWidth: 420,
            aspectRatio: '1',
            margin: '0 auto',
            display: phase === 'scanning' || phase === 'found' ? 'block' : 'none',
          }}
        >
          <video
            ref={videoRef}
            playsInline
            muted
            style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: 16, background: '#000' }}
          />
          {(phase === 'scanning' || phase === 'found') && (
            <ScanOverlay color={phase === 'found' ? TOKEN.ok : TOKEN.cold} />
          )}
        </div>
        {phase === 'scanning' && (
          <div style={{ marginTop: 24, fontSize: 13, opacity: 0.7 }}>QR을 프레임 안에 맞춰주세요</div>
        )}
        {phase === 'found' && (
          <div style={{ marginTop: 18, fontSize: 14, fontWeight: 700, color: TOKEN.ok }}>
            ✓ {foundLabel.slice(0, 28)}{foundLabel.length > 28 ? '…' : ''}
          </div>
        )}
        <canvas ref={canvasRef} style={{ display: 'none' }} />
      </div>
    </div>
  );
}

function ScanOverlay({ color }: { color: string }) {
  return (
    <svg width="100%" height="100%" viewBox="0 0 220 220" preserveAspectRatio="none" style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
      <path d="M45 15 L15 15 L15 45" stroke={color} strokeWidth="4" strokeLinecap="round" fill="none" />
      <path d="M175 15 L205 15 L205 45" stroke={color} strokeWidth="4" strokeLinecap="round" fill="none" />
      <path d="M15 175 L15 205 L45 205" stroke={color} strokeWidth="4" strokeLinecap="round" fill="none" />
      <path d="M205 175 L205 205 L175 205" stroke={color} strokeWidth="4" strokeLinecap="round" fill="none" />
    </svg>
  );
}

const btn: React.CSSProperties = {
  padding: '14px 36px',
  background: TOKEN.cold,
  color: '#fff',
  border: 'none',
  borderRadius: 14,
  fontSize: 15,
  fontWeight: 700,
  cursor: 'pointer',
  fontFamily: FONT,
};
