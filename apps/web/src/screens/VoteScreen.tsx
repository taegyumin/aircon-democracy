'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { TOKEN, VOTE_CONFIG, FONT, type VoteType } from '@aircon/core';
import { Star } from 'lucide-react';
import { api, ApiError, type PlaceDetail } from '../lib/apiClient';
import { recordVote, removePlace } from '../lib/recentPlaces';
import type * as QRCodeModule from 'qrcode.react';
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
        marginTop: 12,
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
  const [reportOpen, setReportOpen] = useState(false);
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
      <div style={{ background: TOKEN.surface, paddingTop: 'var(--header-top-pad)', borderBottom: `1px solid ${TOKEN.border}`, flexShrink: 0 }}>
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
          <button
            onClick={() => setReportOpen(true)}
            style={{ fontSize: 12, color: TOKEN.text3, background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline', fontFamily: FONT }}
          >
            오류가 있나요?
          </button>
        </div>
      </div>

      {reportOpen && (
        <ReportSheet
          placeId={detail.place.id}
          placeName={detail.place.name}
          placeDistrict={detail.place.district}
          placeType={detail.place.type}
          onClose={() => setReportOpen(false)}
          onChangePlace={onChangePlace}
        />
      )}
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
  const [QRMod, setQRMod] = useState<typeof QRCodeModule | null>(null);
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

        {/* QR — URL 제거(긴 문자열, 아래 '링크 복사'로 대체). 스캔 안내만. */}
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
            스캔하면 바로 투표 화면으로 이동해요
          </div>
        </div>

        {/* action rows — PNG 저장은 copied 상태와 무관 (link copy 전용). */}
        <div style={{ borderTop: `1px solid ${TOKEN.border}`, padding: '8px 0 32px' }}>
          <ShareActionRow
            iconBg={TOKEN.coldBg}
            icon={<DownloadIcon size={19} color={TOKEN.cold} />}
            label="PNG 저장"
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

// ── ReportSheet — 4-step 신고 흐름 (Vote Share Redesign v4, 2026-05-27) ─────
//
// Step 1 entry: 4가지 reason 선택 (primary 'not-here'는 inline CTA로 즉시 장소 다시).
// Step 2 edit:  wrong-name 선택 시 → 수정 제안 input + note + submit.
// Step 3 delete: duplicate 선택 시 → warning + 이유 select + 두 버튼 (delete/cancel).
// Step 4 done:  submit 성공 후 success 화면.

type ReportReasonId = 'not-here' | 'wrong-name' | 'duplicate' | 'delete' | 'other';
type ReportPhase = 'entry' | 'edit' | 'delete' | 'done';

function ReportSheet({
  placeId, placeName, placeDistrict, placeType, onClose, onChangePlace,
}: {
  placeId: string;
  placeName: string;
  placeDistrict?: string | null;
  placeType: string;
  onClose: () => void;
  onChangePlace?: () => void;
}) {
  const [phase, setPhase] = useState<ReportPhase>('entry');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (reason: ReportReasonId, note?: string) => {
    setSubmitting(true); setError(null);
    try {
      await api.reportPlace(placeId, { reason, note: note ?? null });
      setPhase('done');
    } catch (e) {
      const msg = (e as Error).message;
      if (msg.includes('duplicate_report')) {
        setError('이미 같은 신고가 접수됐어요.');
      } else {
        setError(msg);
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 60, display: 'flex', flexDirection: 'column' }}>
      {/* dim backdrop */}
      <div onClick={onClose} style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.5)', cursor: 'pointer' }} aria-label="닫기" />
      {/* sheet — full screen modal */}
      <div
        style={{
          position: 'relative', flex: 1, background: TOKEN.bg,
          marginTop: 50, // 상단 backdrop 살짝
          borderRadius: '20px 20px 0 0',
          display: 'flex', flexDirection: 'column', overflow: 'hidden',
          fontFamily: FONT,
        }}
      >
        {/* sticky header */}
        <div style={{ background: TOKEN.surface, borderBottom: `1px solid ${TOKEN.border}`, flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '14px 16px 12px' }}>
            <button
              onClick={() => (phase === 'entry' ? onClose() : setPhase('entry'))}
              aria-label="뒤로"
              style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '4px 8px', display: 'flex' }}
            >
              <BackArrowIcon />
            </button>
            <span style={{ fontSize: 16, fontWeight: 700, color: TOKEN.text1, letterSpacing: '-0.3px', flex: 1 }}>
              {phase === 'edit' ? '정보 수정 제안' : phase === 'delete' ? '장소 삭제 요청' : phase === 'done' ? '신고 완료' : '오류 신고'}
            </span>
            <button onClick={onClose} aria-label="닫기" style={{ background: TOKEN.bg, border: 'none', borderRadius: '50%', width: 30, height: 30, cursor: 'pointer', fontSize: 17, color: TOKEN.text2, fontFamily: FONT }}>
              ×
            </button>
          </div>
          {phase !== 'done' && (
            <div style={{ padding: '0 16px 13px', display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{ width: 6, height: 6, borderRadius: '50%', background: TOKEN.border }} aria-hidden />
              <span style={{ fontSize: 12, color: TOKEN.text3 }}>{placeName}</span>
            </div>
          )}
        </div>

        {/* body */}
        <div style={{ flex: 1, overflowY: 'auto' }}>
          {phase === 'entry' && (
            <ReportEntry
              onPick={(id) => {
                if (id === 'not-here') {
                  // primary CTA — 신고 + 장소 다시 선택. note 없이.
                  void submit('not-here').then(() => {
                    setTimeout(() => { onClose(); onChangePlace?.(); }, 300);
                  });
                } else if (id === 'wrong-name') {
                  setPhase('edit');
                } else if (id === 'duplicate') {
                  setPhase('delete');
                } else if (id === 'other') {
                  setPhase('edit'); // 'other'도 free-form note input
                }
              }}
              disabled={submitting}
            />
          )}
          {phase === 'edit' && (
            <ReportEdit
              placeName={placeName}
              placeType={placeType}
              placeDistrict={placeDistrict}
              onSubmit={(note) => submit('wrong-name', note)}
              submitting={submitting}
            />
          )}
          {phase === 'delete' && (
            <ReportDelete
              placeName={placeName}
              placeDistrict={placeDistrict}
              placeType={placeType}
              onSubmit={(noteOption) => submit('delete', noteOption)}
              onCancel={() => setPhase('entry')}
              submitting={submitting}
            />
          )}
          {phase === 'done' && <ReportDone onClose={onClose} />}

          {error && phase !== 'done' && (
            <div style={{ margin: '14px 16px', padding: 10, background: TOKEN.hotBg, color: TOKEN.hot, borderRadius: 8, fontSize: 12 }}>
              {error}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function BackArrowIcon() {
  return (
    <svg width={20} height={20} viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="M15 18l-6-6 6-6" stroke={TOKEN.text1} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function ReportEntry({ onPick, disabled }: { onPick: (id: ReportReasonId) => void; disabled: boolean }) {
  const reasons: { id: ReportReasonId; label: string; sub: string; accent: string; iconBg: string; primary?: boolean; cta?: string }[] = [
    { id: 'not-here', label: '저 여기 없어요', sub: '잘못된 QR 또는 GPS 오류 — 장소를 다시 선택할게요', accent: TOKEN.hot, iconBg: TOKEN.hotBg, primary: true, cta: '장소 다시 선택' },
    { id: 'wrong-name', label: '이름 또는 정보가 틀렸어요', sub: '장소 이름, 위치, 유형 등이 잘못됐어요', accent: TOKEN.cold, iconBg: TOKEN.coldBg },
    { id: 'duplicate', label: '같은 장소가 이미 있어요', sub: '중복 등록된 것 같아요', accent: TOKEN.text2, iconBg: TOKEN.bg },
    { id: 'other', label: '기타', sub: '직접 설명할게요', accent: TOKEN.text3, iconBg: TOKEN.bg },
  ];
  return (
    <div style={{ padding: '24px 16px 48px', display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div style={{ fontSize: 15, fontWeight: 700, color: TOKEN.text1, marginBottom: 4 }}>어떤 문제가 있나요?</div>
      <div style={{ fontSize: 13, color: TOKEN.text2, marginBottom: 10, lineHeight: 1.6 }}>가장 가까운 상황을 골라주세요</div>
      {reasons.map((r) => (
        <div
          key={r.id}
          style={{
            background: TOKEN.surface, borderRadius: 16,
            border: `1.5px solid ${r.primary ? r.accent + '30' : TOKEN.border}`,
            boxShadow: r.primary ? `0 4px 18px ${r.accent}12` : '0 1px 5px rgba(0,0,0,0.05)',
            overflow: 'hidden',
          }}
        >
          <button
            onClick={() => !disabled && onPick(r.id)}
            disabled={disabled}
            style={{
              width: '100%', display: 'flex', alignItems: 'center', gap: 13,
              padding: '15px 16px', background: 'none', border: 'none', cursor: disabled ? 'default' : 'pointer',
              textAlign: 'left', fontFamily: FONT,
            }}
          >
            <div style={{ width: 44, height: 44, borderRadius: 12, background: r.iconBg, flexShrink: 0 }} aria-hidden />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 15, fontWeight: 700, color: r.primary ? r.accent : TOKEN.text1, letterSpacing: '-0.2px', marginBottom: 3 }}>
                {r.label}
              </div>
              <div style={{ fontSize: 12, color: TOKEN.text3, lineHeight: 1.4 }}>{r.sub}</div>
            </div>
            <span style={{ fontSize: 14, color: r.primary ? r.accent : TOKEN.text3, fontWeight: 600 }}>›</span>
          </button>
          {r.primary && r.cta && (
            <div style={{ padding: '0 16px 14px' }}>
              <button
                onClick={() => !disabled && onPick(r.id)}
                disabled={disabled}
                style={{
                  width: '100%', padding: '12px 0', background: r.accent, color: '#fff',
                  border: 'none', borderRadius: 12, fontSize: 14, fontWeight: 700,
                  cursor: disabled ? 'default' : 'pointer', fontFamily: FONT,
                  boxShadow: `0 4px 14px ${r.accent}35`,
                }}
              >
                {r.cta} →
              </button>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

function ReportEdit({
  placeName, placeType, placeDistrict, onSubmit, submitting,
}: {
  placeName: string; placeType: string; placeDistrict?: string | null;
  onSubmit: (note: string) => void; submitting: boolean;
}) {
  const [note, setNote] = useState('');
  const typeKo: Record<string, string> = {
    subway: '지하철', bus: '버스', train: '기차', classroom: '강의실',
    cafe: '카페·음식점', office: '사무실', library: '도서관', other: '기타',
  };
  const canSubmit = note.trim().length >= 2 && !submitting;
  return (
    <div style={{ padding: '24px 16px 24px', display: 'flex', flexDirection: 'column', gap: 18 }}>
      <div>
        <div style={{ fontSize: 15, fontWeight: 700, color: TOKEN.text1, marginBottom: 4 }}>무엇이 잘못됐나요?</div>
        <div style={{ fontSize: 13, color: TOKEN.text2 }}>수정될 내용을 자유롭게 적어주세요</div>
      </div>
      <div style={{ background: TOKEN.surface, borderRadius: 14, padding: '14px 16px', border: `1px solid ${TOKEN.border}` }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: TOKEN.text3, letterSpacing: '0.5px', marginBottom: 10 }}>현재 등록된 정보</div>
        {[
          { label: '장소 이름', val: placeName },
          { label: '유형', val: typeKo[placeType] ?? placeType },
          ...(placeDistrict ? [{ label: '위치', val: placeDistrict }] : []),
        ].map((row, i) => (
          <div key={i} style={{ display: 'flex', gap: 10, padding: '6px 0', borderTop: i > 0 ? `1px solid ${TOKEN.border}` : 'none' }}>
            <span style={{ fontSize: 12, color: TOKEN.text3, width: 68, flexShrink: 0 }}>{row.label}</span>
            <span style={{ fontSize: 12, color: TOKEN.text1, fontWeight: 600 }}>{row.val}</span>
          </div>
        ))}
      </div>
      <div>
        <label style={{ fontSize: 12, fontWeight: 700, color: TOKEN.text2, display: 'block', marginBottom: 7 }}>수정 제안 *</label>
        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="어떻게 수정되면 좋을지 알려주세요 (예: '서울대입구역 4번 출구'로 수정 부탁)"
          maxLength={300}
          rows={4}
          style={{
            width: '100%', background: TOKEN.surface, borderRadius: 12, padding: '12px 14px',
            border: `1.5px solid ${TOKEN.border}`, fontSize: 14, color: TOKEN.text1,
            fontFamily: FONT, outline: 'none', resize: 'vertical', minHeight: 90,
          }}
        />
        <div style={{ fontSize: 11, color: TOKEN.text3, marginTop: 4 }}>{note.length}/300</div>
      </div>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, padding: '12px 14px', background: TOKEN.surface, borderRadius: 12 }}>
        <span style={{ fontSize: 12, color: TOKEN.text3, lineHeight: 1.6 }}>제안은 익명으로 전달되고, 검토 후 반영돼요.</span>
      </div>
      <button
        onClick={() => canSubmit && onSubmit(note.trim())}
        disabled={!canSubmit}
        style={{
          width: '100%', padding: '15px 0',
          background: canSubmit ? TOKEN.cold : '#CDD2DA',
          color: canSubmit ? '#fff' : '#A0A8B3',
          border: 'none', borderRadius: 14, fontSize: 15, fontWeight: 700,
          cursor: canSubmit ? 'pointer' : 'default', fontFamily: FONT,
          boxShadow: canSubmit ? `0 6px 20px ${TOKEN.cold}38` : 'none',
        }}
      >
        {submitting ? '보내는 중…' : '수정 제안 보내기'}
      </button>
    </div>
  );
}

function ReportDelete({
  placeName, placeDistrict, placeType, onSubmit, onCancel, submitting,
}: {
  placeName: string; placeDistrict?: string | null; placeType: string;
  onSubmit: (reasonOption: string) => void; onCancel: () => void; submitting: boolean;
}) {
  const options = [
    '같은 장소가 이미 있어요',
    '실제로 존재하지 않는 장소예요',
    '이름이 너무 잘못 등록됐어요',
    '기타',
  ];
  const [picked, setPicked] = useState(options[0]);
  const typeKo: Record<string, string> = {
    subway: '지하철', bus: '버스', train: '기차', classroom: '강의실',
    cafe: '카페·음식점', office: '사무실', library: '도서관', other: '기타',
  };
  return (
    <div style={{ padding: '24px 16px 24px', display: 'flex', flexDirection: 'column', gap: 18 }}>
      {/* warning */}
      <div style={{ background: '#FFFBEB', border: '1px solid #FDE68A', borderRadius: 16, padding: '16px 18px' }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: '#92400E', marginBottom: 6 }}>삭제 요청 전에 확인해주세요</div>
        <div style={{ fontSize: 12, color: '#B45309', lineHeight: 1.6 }}>
          삭제는 즉시 처리되지 않고 관리자 검토 후 반영돼요. 기존 투표 기록은 보존돼요.
        </div>
      </div>
      <div style={{ background: TOKEN.surface, borderRadius: 14, padding: '14px 16px', border: `1px solid ${TOKEN.border}` }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: TOKEN.text3, letterSpacing: '0.5px', marginBottom: 8 }}>삭제 요청 대상</div>
        <div style={{ fontSize: 15, fontWeight: 700, color: TOKEN.text1 }}>{placeName}</div>
        <div style={{ fontSize: 12, color: TOKEN.text3, marginTop: 3 }}>
          {[placeDistrict, typeKo[placeType] ?? placeType].filter(Boolean).join(' · ')}
        </div>
      </div>
      <div>
        <label style={{ fontSize: 12, fontWeight: 700, color: TOKEN.text2, display: 'block', marginBottom: 8 }}>삭제 이유</label>
        <div style={{ background: TOKEN.surface, borderRadius: 12, overflow: 'hidden', border: `1px solid ${TOKEN.border}` }}>
          {options.map((opt, i) => {
            const sel = picked === opt;
            return (
              <button
                key={opt}
                onClick={() => setPicked(opt)}
                style={{
                  width: '100%', display: 'flex', alignItems: 'center', gap: 12, padding: '13px 16px',
                  borderTop: i > 0 ? `1px solid ${TOKEN.border}` : 'none',
                  background: sel ? TOKEN.hotBg : 'transparent', border: 'none', cursor: 'pointer',
                  textAlign: 'left', fontFamily: FONT,
                }}
              >
                <div
                  style={{
                    width: 20, height: 20, borderRadius: '50%', flexShrink: 0,
                    border: `2px solid ${sel ? TOKEN.hot : TOKEN.border}`,
                    background: sel ? TOKEN.hot : 'transparent',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}
                  aria-hidden
                >
                  {sel && <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#fff' }} />}
                </div>
                <span style={{ fontSize: 14, color: sel ? TOKEN.hot : TOKEN.text1, fontWeight: sel ? 700 : 400 }}>{opt}</span>
              </button>
            );
          })}
        </div>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <button
          onClick={() => onSubmit(picked)}
          disabled={submitting}
          style={{
            width: '100%', padding: '14px 0', background: TOKEN.hot, color: '#fff',
            border: 'none', borderRadius: 14, fontSize: 15, fontWeight: 700,
            cursor: submitting ? 'default' : 'pointer', fontFamily: FONT,
            boxShadow: `0 6px 20px ${TOKEN.hot}35`,
          }}
        >
          {submitting ? '보내는 중…' : '삭제 요청 보내기'}
        </button>
        <button
          onClick={onCancel}
          style={{
            width: '100%', padding: '13px 0', background: 'none', color: TOKEN.text2,
            border: `1px solid ${TOKEN.border}`, borderRadius: 14, fontSize: 14,
            cursor: 'pointer', fontFamily: FONT,
          }}
        >
          취소
        </button>
      </div>
    </div>
  );
}

function ReportDone({ onClose }: { onClose: () => void }) {
  return (
    <div style={{ padding: '60px 32px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 18 }}>
      <div
        style={{
          width: 64, height: 64, borderRadius: '50%', background: TOKEN.okBg ?? '#F0FDF4',
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 30,
        }}
        aria-hidden
      >✓</div>
      <div style={{ textAlign: 'center' }}>
        <div style={{ fontSize: 20, fontWeight: 900, color: TOKEN.text1, letterSpacing: '-0.4px', marginBottom: 8 }}>
          제안을 보냈어요
        </div>
        <div style={{ fontSize: 13, color: TOKEN.text2, lineHeight: 1.6 }}>
          관리자가 검토 후 반영해드릴게요.<br />
          익명으로 전달되어 본인 정보는 남지 않아요.
        </div>
      </div>
      <button
        onClick={onClose}
        style={{
          marginTop: 12, padding: '14px 32px', background: TOKEN.cold, color: '#fff',
          border: 'none', borderRadius: 14, fontSize: 14, fontWeight: 700,
          cursor: 'pointer', fontFamily: FONT,
          boxShadow: `0 6px 20px ${TOKEN.cold}38`,
        }}
      >
        투표 페이지로 돌아가기
      </button>
    </div>
  );
}
