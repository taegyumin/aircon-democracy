'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { TOKEN, VOTE_CONFIG, FONT, type VoteType } from '@aircon/core';
import { Star } from 'lucide-react';
import { api, ApiError, type PlaceDetail } from '../lib/apiClient';
import { recordVote, removePlace } from '../lib/recentPlaces';
import { isFavorite, toggleFavorite } from '../lib/favorites';
import { useUser } from '../lib/useUser';
import { consumePendingVote, setPendingVote } from '../lib/migration';
import { VoteButton } from '../components/VoteButton';
import { ResultBar } from '../components/ResultBar';
import { BackIcon } from '../components/Icons';
import { PlaceTypeIcon } from '../components/PlaceTypeIcon';

interface Props {
  placeId: string;
  onBack: () => void;
  onLogin: () => void;
  onChangePlace: () => void;
  arrivedViaQR?: boolean;
  onQRConsumed?: () => void;
}

const POLL_INTERVAL_MS = 5000;

function CooldownView({ cooldown, currentVote, prevVote }: { cooldown: number; currentVote: VoteType | null; prevVote: VoteType | null }) {
  const vc = currentVote ? VOTE_CONFIG[currentVote] : null;
  const vp = prevVote ? VOTE_CONFIG[prevVote] : null;
  const R = 36;
  const C = 2 * Math.PI * R;
  const progress = (30 - cooldown) / 30;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 18, padding: '8px 0 4px' }}>
      <div style={{ position: 'relative', width: 96, height: 96 }}>
        <svg width={96} height={96} viewBox="0 0 96 96" style={{ transform: 'rotate(-90deg)' }}>
          <circle cx="48" cy="48" r={R} fill="none" stroke={TOKEN.border} strokeWidth="6" />
          <circle
            cx="48"
            cy="48"
            r={R}
            fill="none"
            stroke={vc?.color || TOKEN.cold}
            strokeWidth="6"
            strokeDasharray={C}
            strokeDashoffset={C * (1 - progress)}
            strokeLinecap="round"
            style={{ transition: 'stroke-dashoffset 0.9s linear' }}
          />
        </svg>
        <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
          <span style={{ fontSize: 26, fontWeight: 900, color: TOKEN.text1, fontVariantNumeric: 'tabular-nums', lineHeight: 1 }}>
            {cooldown}
          </span>
          <span style={{ fontSize: 11, color: TOKEN.text3 }}>초</span>
        </div>
      </div>

      <div style={{ textAlign: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, justifyContent: 'center', marginBottom: 8 }}>
          <span style={{ fontSize: 15, fontWeight: 700, color: vp?.color }}>{vp?.label}</span>
          <svg width={14} height={14} viewBox="0 0 24 24" fill="none">
            <path d="M5 12h14M13 6l6 6-6 6" stroke={TOKEN.text3} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          <span style={{ fontSize: 15, fontWeight: 700, color: vc?.color }}>{vc?.label}</span>
        </div>
        <div style={{ fontSize: 12, color: TOKEN.text3 }}>{cooldown}초 후 다시 변경할 수 있어요</div>
      </div>
    </div>
  );
}

function LoginPromptCard({ onLogin }: { onLogin: () => void }) {
  const [dismissed, setDismissed] = useState(false);
  if (dismissed) return null;
  return (
    <div
      style={{
        background: TOKEN.bg,
        border: `1px solid ${TOKEN.border}`,
        borderRadius: TOKEN.r.lg,
        padding: '12px 14px',
        display: 'flex',
        alignItems: 'center',
        gap: 12,
      }}
    >
      <img src="/icon.png" alt="" style={{ width: 30, height: 30, borderRadius: 8, flexShrink: 0 }} />
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: TOKEN.text1, marginBottom: 2 }}>더 신뢰할 수 있는 참여</div>
        <div style={{ fontSize: 11, color: TOKEN.text2, lineHeight: 1.4 }}>로그인하면 장소 관리와 이력을 볼 수 있어요</div>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 5, flexShrink: 0 }}>
        <button
          onClick={() => setDismissed(true)}
          style={{ fontSize: 11, color: TOKEN.text3, background: 'none', border: 'none', cursor: 'pointer', fontFamily: FONT }}
        >
          나중에
        </button>
        <button
          onClick={onLogin}
          style={{
            fontSize: 12,
            fontWeight: 700,
            color: '#fff',
            background: TOKEN.cold,
            border: 'none',
            borderRadius: TOKEN.r.sm,
            padding: '5px 10px',
            cursor: 'pointer',
            fontFamily: FONT,
          }}
        >
          로그인
        </button>
      </div>
    </div>
  );
}

export function VoteScreen({ placeId, onBack, onLogin, onChangePlace, arrivedViaQR, onQRConsumed }: Props) {
  const { user } = useUser();
  const [detail, setDetail] = useState<PlaceDetail | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [cooldown, setCooldown] = useState(0);
  const [prevVote, setPrevVote] = useState<VoteType | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [showCorrection, setShowCorrection] = useState(false);
  const [, setFavTick] = useState(0);
  const [shareOpen, setShareOpen] = useState(false);
  const cooldownTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const pollTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const correctionTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const startCooldown = useCallback((seconds: number) => {
    setCooldown(seconds);
    if (cooldownTimerRef.current) clearInterval(cooldownTimerRef.current);
    cooldownTimerRef.current = setInterval(() => {
      setCooldown((c) => {
        if (c <= 1) {
          if (cooldownTimerRef.current) clearInterval(cooldownTimerRef.current);
          return 0;
        }
        return c - 1;
      });
    }, 1000);
  }, []);

  const load = useCallback(async () => {
    try {
      const d = await api.getPlace(placeId);
      setDetail(d);
      setLoadError(null);
      if (d.me && d.me.cooldown_remaining_ms > 0) {
        startCooldown(Math.ceil(d.me.cooldown_remaining_ms / 1000));
      }
    } catch (e) {
      setLoadError((e as Error).message);
    }
  }, [placeId, startCooldown]);

  useEffect(() => {
    load();
    pollTimerRef.current = setInterval(load, POLL_INTERVAL_MS);
    return () => {
      if (pollTimerRef.current) clearInterval(pollTimerRef.current);
      if (cooldownTimerRef.current) clearInterval(cooldownTimerRef.current);
      if (correctionTimerRef.current) clearTimeout(correctionTimerRef.current);
    };
  }, [load]);

  // Pending vote migration — if user just corrected place, auto-cast same vote on new place
  useEffect(() => {
    if (!detail || detail.me) return;
    const pending = consumePendingVote();
    if (pending) {
      // small delay to let UI settle
      setTimeout(() => handleVote(pending), 80);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [detail]);

  const handleCorrectPlace = async () => {
    setShowCorrection(false);
    const currentVote = detail?.me?.vote ?? null;
    try {
      await api.deleteVote(placeId);
    } catch {
      /* tolerate — still navigate */
    }
    removePlace(placeId);
    // Preserve user's intent: same vote, new place
    if (currentVote) setPendingVote(currentVote);
    onChangePlace();
  };

  const handleVote = async (type: VoteType) => {
    if (cooldown > 0 || submitting || !detail) return;
    if (detail.me?.vote === type) return;

    setPrevVote(detail.me?.vote ?? null);
    setSubmitting(true);

    // Optimistic update
    const prev = detail;
    const nextVotes = { ...prev.votes };
    if (prev.me?.vote) nextVotes[prev.me.vote] = Math.max(0, nextVotes[prev.me.vote] - 1);
    nextVotes[type] = nextVotes[type] + 1;
    setDetail({
      ...prev,
      votes: nextVotes,
      me: {
        vote: type,
        voted_at: Date.now(),
        changed_at: prev.me?.vote && prev.me.vote !== type ? Date.now() : (prev.me?.changed_at ?? Date.now()),
        expires_at: Date.now() + 60 * 60 * 1000,
        cooldown_remaining_ms: prev.me?.vote && prev.me.vote !== type ? 30000 : 0,
      },
    });

    try {
      await api.vote(placeId, type);
      if (prev.me?.vote && prev.me.vote !== type) {
        startCooldown(30);
      }
      recordVote({
        id: prev.place.id,
        name: prev.place.name,
        type: prev.place.type,
        district: prev.place.district,
      });
      // Show "이 장소 맞나요?" bar for 10s only on first vote (not on changes)
      if (!prev.me?.vote) {
        setShowCorrection(true);
        if (correctionTimerRef.current) clearTimeout(correctionTimerRef.current);
        correctionTimerRef.current = setTimeout(() => setShowCorrection(false), 10_000);
      }
      // Refresh authoritative state
      await load();
    } catch (e) {
      // Rollback on error
      setDetail(prev);
      if (e instanceof ApiError && e.status === 429) {
        const remaining = (e.body as { remaining_ms?: number } | null)?.remaining_ms ?? 0;
        startCooldown(Math.ceil(remaining / 1000));
      }
    } finally {
      setSubmitting(false);
    }
  };

  if (loadError && !detail) {
    return (
      <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 12, background: TOKEN.bg, fontFamily: FONT, padding: 20 }}>
        <div style={{ fontSize: 14, color: TOKEN.hot, fontWeight: 700 }}>장소를 불러오지 못했어요</div>
        <div style={{ fontSize: 12, color: TOKEN.text3 }}>{loadError}</div>
        <button
          onClick={onBack}
          style={{ padding: '10px 24px', background: TOKEN.cold, color: '#fff', border: 'none', borderRadius: TOKEN.r.lg, fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: FONT, marginTop: 8 }}
        >
          돌아가기
        </button>
      </div>
    );
  }

  if (!detail) {
    return (
      <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: TOKEN.bg, fontFamily: FONT, color: TOKEN.text3, fontSize: 13 }}>
        불러오는 중…
      </div>
    );
  }

  const total = detail.votes.cold + detail.votes.ok + detail.votes.hot;
  const myVote = detail.me?.vote ?? null;
  const dominant: VoteType | null =
    total === 0
      ? null
      : detail.votes.cold >= detail.votes.ok && detail.votes.cold >= detail.votes.hot
        ? 'cold'
        : detail.votes.hot > detail.votes.ok
          ? 'hot'
          : 'ok';

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', background: TOKEN.bg, fontFamily: FONT }}>
      <div style={{ background: TOKEN.surface, paddingTop: 62, borderBottom: `1px solid ${TOKEN.border}`, flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '10px 14px 14px' }}>
          <button onClick={onBack} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '4px 6px', display: 'flex', alignItems: 'center', borderRadius: TOKEN.r.sm }} aria-label="뒤로">
            <BackIcon />
          </button>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 15, fontWeight: 700, color: TOKEN.text1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {detail.place.name}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginTop: 2 }}>
              <PlaceTypeIcon name={detail.place.name} type={detail.place.type} size={11} color={TOKEN.text3} />
              {detail.place.district && <span style={{ fontSize: 11, color: TOKEN.text3 }}>{detail.place.district}</span>}
            </div>
          </div>
          <button
            onClick={() => setShareOpen(true)}
            aria-label="이 장소 공유하기"
            style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '6px 8px', display: 'flex', alignItems: 'center' }}
          >
            <ShareIcon size={20} color={TOKEN.text1} />
          </button>
          <button
            onClick={() => {
              if (!user) {
                onLogin();
                return;
              }
              toggleFavorite({
                id: detail.place.id,
                name: detail.place.name,
                type: detail.place.type,
                district: detail.place.district,
              });
              setFavTick((x) => x + 1);
            }}
            aria-label={!user ? '로그인 후 즐겨찾기' : isFavorite(detail.place.id) ? '즐겨찾기 해제' : '즐겨찾기 추가'}
            style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '6px 8px', display: 'flex', alignItems: 'center' }}
          >
            <Star
              size={22}
              color={user && isFavorite(detail.place.id) ? '#F59E0B' : TOKEN.text3}
              fill={user && isFavorite(detail.place.id) ? '#F59E0B' : 'none'}
              strokeWidth={2}
            />
          </button>
        </div>
      </div>

      {/* ShareSheet bottom sheet — header 공유 아이콘 또는 하단 ShareRow에서 열림. */}
      {shareOpen && (
        <ShareSheet
          placeId={detail.place.id}
          placeName={detail.place.name}
          onClose={() => setShareOpen(false)}
        />
      )}

      <div style={{ flex: 1, overflowY: 'auto', padding: '18px 16px 80px' }}>
        {arrivedViaQR && (
          <div
            onClick={() => onQRConsumed?.()}
            style={{
              background: TOKEN.coldBg,
              border: `1px solid ${TOKEN.cold}33`,
              borderRadius: TOKEN.r.md,
              padding: '10px 14px',
              marginBottom: 14,
              fontSize: 12,
              color: TOKEN.cold,
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              cursor: 'pointer',
            }}
          >
            <span>📷</span>
            <span style={{ flex: 1 }}>QR로 도착! 솔직한 한 표 부탁드려요</span>
            <span style={{ opacity: 0.5 }}>×</span>
          </div>
        )}
        {/* Anchoring guard: vote 전엔 totals 가림 (남 의견 보고 흔들리지 않게) */}
        {myVote ? (
          <div style={{ background: TOKEN.surface, borderRadius: TOKEN.r.xl, padding: '18px 18px 16px', marginBottom: 14, boxShadow: '0 1px 6px rgba(0,0,0,0.06)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
              <span style={{ fontSize: 12, fontWeight: 700, color: TOKEN.text2, letterSpacing: '0.3px' }}>지금 이 공간</span>
              <span style={{ fontSize: 12, color: TOKEN.text3 }}>{total}명 참여 중</span>
            </div>
            <ResultBar votes={detail.votes} myVote={myVote} />
            {dominant && (
              <div style={{ marginTop: 12, display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ fontSize: 12, color: TOKEN.text2 }}>전체 의견</span>
                <span style={{ fontSize: 13, fontWeight: 800, color: VOTE_CONFIG[dominant].color }}>{VOTE_CONFIG[dominant].label}</span>
              </div>
            )}
          </div>
        ) : (
          <div style={{ background: TOKEN.surface, borderRadius: TOKEN.r.xl, padding: '14px 18px', marginBottom: 14, boxShadow: '0 1px 6px rgba(0,0,0,0.06)', fontSize: 12, color: TOKEN.text3, textAlign: 'center', lineHeight: 1.6 }}>
            {total > 0 ? `${total}명이 의견을 남겼어요` : '아직 의견이 없어요'}
            <br />
            <span style={{ color: TOKEN.text2 }}>당신의 솔직한 느낌으로 먼저 한 표 던져보세요</span>
          </div>
        )}

        <div style={{ background: TOKEN.surface, borderRadius: TOKEN.r.xl, padding: '20px 16px', boxShadow: '0 1px 6px rgba(0,0,0,0.06)', marginBottom: 14 }}>
          <div style={{ fontSize: 16, fontWeight: 900, color: TOKEN.text1, marginBottom: 16, textAlign: 'center', letterSpacing: '-0.3px' }}>
            {myVote && cooldown === 0 ? '내 의견' : '지금 어떠세요?'}
          </div>

          {cooldown > 0 ? (
            <CooldownView cooldown={cooldown} currentVote={myVote} prevVote={prevVote} />
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {(['cold', 'ok', 'hot'] as const).map((type) => (
                <VoteButton key={type} type={type} selected={myVote === type} disabled={submitting} onClick={() => handleVote(type)} />
              ))}
            </div>
          )}

          {myVote && cooldown === 0 && (
            <div style={{ textAlign: 'center', marginTop: 14 }}>
              <span style={{ fontSize: 12, color: TOKEN.text3 }}>의견은 1시간 후 자동으로 만료돼요</span>
            </div>
          )}
        </div>

        {showCorrection && (
          <div
            style={{
              background: '#FFFBEB',
              border: '1px solid #FDE68A',
              borderRadius: TOKEN.r.lg,
              padding: '12px 14px',
              marginBottom: 14,
              display: 'flex',
              alignItems: 'center',
              gap: 10,
            }}
          >
            <span style={{ fontSize: 18, lineHeight: 1 }}>📍</span>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: '#92400E' }}>이 장소가 아니었어요?</div>
              <div style={{ fontSize: 11, color: '#B45309', marginTop: 1 }}>지금 한 표 취소하고 다시 고를 수 있어요</div>
            </div>
            <button
              onClick={() => setShowCorrection(false)}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#B45309', fontSize: 12, fontFamily: FONT, padding: '6px 8px' }}
            >
              괜찮아요
            </button>
            <button
              onClick={handleCorrectPlace}
              style={{ background: '#D97706', color: '#fff', border: 'none', borderRadius: TOKEN.r.sm, padding: '6px 12px', fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: FONT }}
            >
              장소 바꾸기
            </button>
          </div>
        )}

        {/* 하단 ShareRow — secondary 공유 진입점 (Vote Share Redesign).
            투표 후 스크롤 다운했을 때 발견. 헤더 ShareIcon은 quick access. */}
        <ShareRow onOpen={() => setShareOpen(true)} />

        <LoginPromptCard onLogin={onLogin} />

        <div style={{ textAlign: 'center', marginTop: 18 }}>
          <button style={{ fontSize: 12, color: TOKEN.text3, background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline', fontFamily: FONT }}>
            장소 정보가 잘못됐나요?
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Share UI 컴포넌트들 (Vote Share Redesign v3 — 2026-05-27) ─────────

function ShareIcon({ size = 20, color = '#1A1A1F' }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="M4 12v8a2 2 0 002 2h12a2 2 0 002-2v-8" stroke={color} strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" />
      <polyline points="16,6 12,2 8,6" stroke={color} strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" />
      <line x1="12" y1="2" x2="12" y2="15" stroke={color} strokeWidth="1.9" strokeLinecap="round" />
    </svg>
  );
}

function ShareRow({ onOpen }: { onOpen: () => void }) {
  return (
    <button
      onClick={onOpen}
      style={{
        width: '100%', display: 'flex', alignItems: 'center', gap: 12,
        background: TOKEN.surface, border: `1px solid ${TOKEN.border}`,
        borderRadius: 14, padding: '14px 16px', marginTop: 14,
        cursor: 'pointer', fontFamily: FONT, textAlign: 'left',
        boxShadow: '0 1px 5px rgba(0,0,0,0.05)',
      }}
    >
      <div
        style={{
          width: 36, height: 36, borderRadius: 10, flexShrink: 0,
          background: TOKEN.coldBg,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}
      >
        <ShareIcon size={18} color={TOKEN.cold} />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: TOKEN.text1, marginBottom: 2 }}>
          이 장소 공유하기
        </div>
        <div style={{ fontSize: 11, color: TOKEN.text3, lineHeight: 1.4 }}>
          QR 코드 · 링크 · A4 인쇄 템플릿
        </div>
      </div>
      <span style={{ fontSize: 14, color: TOKEN.text3 }}>›</span>
    </button>
  );
}

function ShareSheet({
  placeId, placeName, onClose,
}: {
  placeId: string;
  placeName: string;
  onClose: () => void;
}) {
  const [copied, setCopied] = useState(false);
  const [QRMod, setQRMod] = useState<typeof import('qrcode.react') | null>(null);
  const origin = typeof window !== 'undefined' ? window.location.origin : 'https://aircondemocracy.com';
  const placeUrl = `${origin}/p/${encodeURIComponent(placeId)}`;
  const printUrl = `${origin}/print/${encodeURIComponent(placeId)}`;

  useEffect(() => {
    import('qrcode.react').then(setQRMod).catch(() => { /* skip */ });
  }, []);

  const copyLink = async () => {
    try {
      if (navigator.clipboard) await navigator.clipboard.writeText(placeUrl);
      else {
        const ta = document.createElement('textarea');
        ta.value = placeUrl; document.body.appendChild(ta); ta.select();
        document.execCommand('copy'); document.body.removeChild(ta);
      }
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch { /* ignore */ }
  };

  const downloadPNG = () => {
    const svg = document.querySelector('#vote-share-qr svg') as SVGElement | null;
    if (!svg) return;
    const xml = new XMLSerializer().serializeToString(svg);
    const svg64 = btoa(unescape(encodeURIComponent(xml)));
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = 512; canvas.height = 512;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, 512, 512);
      ctx.drawImage(img, 0, 0, 512, 512);
      const a = document.createElement('a');
      a.href = canvas.toDataURL('image/png');
      a.download = `aircon-${placeId.replace(/:/g, '-')}.png`;
      a.click();
    };
    img.src = `data:image/svg+xml;base64,${svg64}`;
  };

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 50,
        display: 'flex', flexDirection: 'column', justifyContent: 'flex-end',
      }}
    >
      {/* dimmed backdrop */}
      <div
        onClick={onClose}
        style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.42)', cursor: 'pointer' }}
        aria-label="닫기"
      />
      {/* sheet */}
      <div
        style={{
          position: 'relative', background: TOKEN.surface,
          borderRadius: '24px 24px 0 0',
          boxShadow: '0 -4px 32px rgba(0,0,0,0.16)',
          maxHeight: '88vh', overflowY: 'auto',
        }}
      >
        {/* handle */}
        <div style={{ display: 'flex', justifyContent: 'center', padding: '12px 0 6px' }}>
          <div style={{ width: 36, height: 4, borderRadius: 999, background: TOKEN.border }} />
        </div>

        {/* title + close */}
        <div style={{ padding: '4px 20px 18px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ minWidth: 0, flex: 1 }}>
            <div style={{ fontSize: 17, fontWeight: 900, color: TOKEN.text1, letterSpacing: '-0.4px' }}>
              이 장소 공유하기
            </div>
            <div style={{ fontSize: 12, color: TOKEN.text2, marginTop: 3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {placeName}
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="닫기"
            style={{
              background: TOKEN.bg, border: 'none', borderRadius: '50%',
              width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center',
              cursor: 'pointer', fontSize: 18, color: TOKEN.text2, flexShrink: 0,
              fontFamily: FONT,
            }}
          >
            ×
          </button>
        </div>

        {/* QR + URL */}
        <div style={{ padding: '0 20px 20px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14 }}>
          <div
            id="vote-share-qr"
            style={{
              background: '#fff', borderRadius: 16, padding: 16,
              border: `1px solid ${TOKEN.border}`,
              boxShadow: '0 2px 10px rgba(0,0,0,0.07)',
            }}
          >
            {QRMod ? <QRMod.QRCodeSVG value={placeUrl} size={148} level="M" includeMargin={false} /> : <div style={{ width: 148, height: 148, background: TOKEN.bg }} />}
          </div>
          <div style={{ fontSize: 12, color: TOKEN.text3, textAlign: 'center', lineHeight: 1.6 }}>
            스캔하면 바로 투표 화면으로 이동해요<br />
            <span style={{ color: TOKEN.cold, fontWeight: 600, wordBreak: 'break-all' }}>{placeUrl.replace(/^https?:\/\//, '')}</span>
          </div>
        </div>

        {/* action rows */}
        <div style={{ borderTop: `1px solid ${TOKEN.border}`, padding: '8px 0 32px' }}>
          <ShareActionRow
            iconBg={TOKEN.coldBg}
            icon={<DownloadIcon size={19} color={TOKEN.cold} />}
            label={copied ? '복사됨 ✓' : 'PNG 저장'}
            sub="QR 이미지를 사진첩에 저장"
            onClick={downloadPNG}
          />
          <ShareActionRow
            iconBg={TOKEN.bg}
            icon={<PrintIcon size={19} color={TOKEN.text1} />}
            label="A4 인쇄 페이지 열기"
            sub="카페·사무실 부착용 포스터"
            onClick={() => window.open(printUrl, '_blank', 'noopener')}
          />
          <ShareActionRow
            iconBg={TOKEN.bg}
            icon={<LinkIcon size={19} color={TOKEN.text1} />}
            label={copied ? '복사됨 ✓' : '링크 복사'}
            sub={placeUrl.replace(/^https?:\/\//, '')}
            onClick={copyLink}
            isLast
          />
        </div>
      </div>
    </div>
  );
}

function ShareActionRow({
  icon, iconBg, label, sub, onClick, isLast,
}: {
  icon: React.ReactNode;
  iconBg: string;
  label: string;
  sub: string;
  onClick: () => void;
  isLast?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      style={{
        width: '100%', display: 'flex', alignItems: 'center', gap: 14,
        padding: '13px 20px',
        borderBottom: isLast ? 'none' : `1px solid ${TOKEN.border}`,
        background: 'none', border: 'none', cursor: 'pointer',
        textAlign: 'left', fontFamily: FONT,
      }}
    >
      <div
        style={{
          width: 38, height: 38, borderRadius: 10, background: iconBg, flexShrink: 0,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}
      >
        {icon}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 15, fontWeight: 700, color: TOKEN.text1, letterSpacing: '-0.2px' }}>{label}</div>
        <div style={{ fontSize: 11, color: TOKEN.text3, marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{sub}</div>
      </div>
      <svg width={15} height={15} viewBox="0 0 24 24" fill="none" aria-hidden>
        <path d="M5 12h14M13 6l6 6-6 6" stroke={TOKEN.text3} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </button>
  );
}

function DownloadIcon({ size = 20, color = '#1A1A1F' }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" stroke={color} strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" />
      <polyline points="7,10 12,15 17,10" stroke={color} strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" />
      <line x1="12" y1="15" x2="12" y2="3" stroke={color} strokeWidth="1.9" strokeLinecap="round" />
    </svg>
  );
}

function PrintIcon({ size = 20, color = '#1A1A1F' }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden>
      <polyline points="6,9 6,2 18,2 18,9" stroke={color} strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M6 18H4a2 2 0 01-2-2v-5a2 2 0 012-2h16a2 2 0 012 2v5a2 2 0 01-2 2h-2" stroke={color} strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" />
      <rect x="6" y="14" width="12" height="8" rx="1" stroke={color} strokeWidth="1.9" />
    </svg>
  );
}

function LinkIcon({ size = 20, color = '#1A1A1F' }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="M10 13a5 5 0 007.54.54l3-3a5 5 0 00-7.07-7.07l-1.72 1.71" stroke={color} strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M14 11a5 5 0 00-7.54-.54l-3 3a5 5 0 007.07 7.07l1.71-1.71" stroke={color} strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
