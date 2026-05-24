import { useCallback, useEffect, useRef, useState } from 'react';
import { TOKEN, VOTE_CONFIG, FONT, type VoteType } from '../lib/tokens';
import { api, ApiError, type PlaceDetail } from '../lib/api';
import { VoteButton } from '../components/VoteButton';
import { ResultBar } from '../components/ResultBar';
import { BackIcon } from '../components/Icons';
import { PlaceTypeIcon } from '../components/PlaceTypeIcon';

interface Props {
  placeId: string;
  onBack: () => void;
  onLogin: () => void;
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

export function VoteScreen({ placeId, onBack, onLogin }: Props) {
  const [detail, setDetail] = useState<PlaceDetail | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [cooldown, setCooldown] = useState(0);
  const [prevVote, setPrevVote] = useState<VoteType | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const cooldownTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const pollTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

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
    };
  }, [load]);

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
        </div>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '18px 16px 80px' }}>
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
