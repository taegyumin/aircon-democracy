import { useEffect, useRef, useState } from 'react';
import { TOKEN, VOTE_CONFIG, FONT, type VoteType } from '../lib/tokens';
import type { Place } from '../lib/places';
import { VoteButton } from '../components/VoteButton';
import { ResultBar } from '../components/ResultBar';
import { PlaceIcon, BackIcon } from '../components/Icons';

interface Props {
  place: Place;
  onBack: () => void;
  onLogin: () => void;
}

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
        <div
          style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
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
          style={{
            fontSize: 11,
            color: TOKEN.text3,
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            fontFamily: FONT,
          }}
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

export function VoteScreen({ place, onBack, onLogin }: Props) {
  const [vote, setVote] = useState<VoteType | null>(null);
  const [prevVote, setPrevVote] = useState<VoteType | null>(null);
  const [cooldown, setCooldown] = useState(0);
  const [expired, setExpired] = useState(false);
  const [votes, setVotes] = useState({ ...place.votes });
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const total = (votes.cold || 0) + (votes.ok || 0) + (votes.hot || 0);

  const handleVote = (type: VoteType) => {
    if (cooldown > 0 || type === vote) return;
    const next = { ...votes };
    if (vote) next[vote] = Math.max(0, (next[vote] || 0) - 1);
    next[type] = (next[type] || 0) + 1;
    if (vote !== null) {
      setPrevVote(vote);
      setCooldown(30);
      if (timerRef.current) clearInterval(timerRef.current);
      timerRef.current = setInterval(() => {
        setCooldown((c) => {
          if (c <= 1) {
            if (timerRef.current) clearInterval(timerRef.current);
            return 0;
          }
          return c - 1;
        });
      }, 1000);
    }
    setVote(type);
    setVotes(next);
    setExpired(false);
  };

  const simulateExpiry = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    setCooldown(0);
    setExpired(true);
    setVote(null);
    setVotes({ ...place.votes });
  };

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  const dominant: VoteType | null =
    total === 0
      ? null
      : votes.cold >= votes.ok && votes.cold >= votes.hot
        ? 'cold'
        : votes.hot > votes.ok
          ? 'hot'
          : 'ok';

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', background: TOKEN.bg, fontFamily: FONT }}>
      <div style={{ background: TOKEN.surface, paddingTop: 62, borderBottom: `1px solid ${TOKEN.border}`, flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '10px 14px 14px' }}>
          <button
            onClick={onBack}
            style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '4px 6px', display: 'flex', alignItems: 'center', borderRadius: TOKEN.r.sm }}
            aria-label="뒤로"
          >
            <BackIcon />
          </button>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div
              style={{
                fontSize: 15,
                fontWeight: 700,
                color: TOKEN.text1,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {place.name}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginTop: 2 }}>
              <PlaceIcon type={place.type} size={11} color={TOKEN.text3} />
              <span style={{ fontSize: 11, color: TOKEN.text3 }}>{place.district}</span>
            </div>
          </div>
          <button
            onClick={simulateExpiry}
            title="만료 상태 시뮬레이션"
            style={{
              fontSize: 10,
              color: TOKEN.text3,
              background: TOKEN.bg,
              border: `1px solid ${TOKEN.border}`,
              borderRadius: 999,
              padding: '4px 10px',
              cursor: 'pointer',
              flexShrink: 0,
              fontFamily: FONT,
            }}
          >
            1시간 후
          </button>
        </div>
      </div>

      {expired && (
        <div
          style={{
            background: '#FFFBEB',
            borderBottom: '1px solid #FDE68A',
            padding: '10px 16px',
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            flexShrink: 0,
          }}
        >
          <svg width={16} height={16} viewBox="0 0 24 24" fill="none">
            <circle cx="12" cy="12" r="9" stroke="#D97706" strokeWidth="2" />
            <path d="M12 7v5l3 3" stroke="#D97706" strokeWidth="2" strokeLinecap="round" />
          </svg>
          <div>
            <div style={{ fontSize: 13, fontWeight: 700, color: '#92400E' }}>한 시간이 지났어요</div>
            <div style={{ fontSize: 12, color: '#B45309' }}>지금은 어떠세요? 다시 알려주세요</div>
          </div>
        </div>
      )}

      <div style={{ flex: 1, overflowY: 'auto', padding: '18px 16px 80px' }}>
        <div
          style={{
            background: TOKEN.surface,
            borderRadius: TOKEN.r.xl,
            padding: '18px 18px 16px',
            marginBottom: 14,
            boxShadow: '0 1px 6px rgba(0,0,0,0.06)',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
            <span style={{ fontSize: 12, fontWeight: 700, color: TOKEN.text2, letterSpacing: '0.3px' }}>지금 이 공간</span>
            <span style={{ fontSize: 12, color: TOKEN.text3 }}>{total}명 참여 중</span>
          </div>
          <ResultBar votes={votes} myVote={vote} />
          {dominant && (
            <div style={{ marginTop: 12, display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ fontSize: 12, color: TOKEN.text2 }}>전체 의견</span>
              <span style={{ fontSize: 13, fontWeight: 800, color: VOTE_CONFIG[dominant].color }}>
                {VOTE_CONFIG[dominant].label}
              </span>
            </div>
          )}
        </div>

        <div
          style={{
            background: TOKEN.surface,
            borderRadius: TOKEN.r.xl,
            padding: '20px 16px',
            boxShadow: '0 1px 6px rgba(0,0,0,0.06)',
            marginBottom: 14,
          }}
        >
          <div
            style={{
              fontSize: 16,
              fontWeight: 900,
              color: TOKEN.text1,
              marginBottom: 16,
              textAlign: 'center',
              letterSpacing: '-0.3px',
            }}
          >
            {vote && cooldown === 0 ? '내 의견' : '지금 어떠세요?'}
          </div>

          {cooldown > 0 ? (
            <CooldownView cooldown={cooldown} currentVote={vote} prevVote={prevVote} />
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {(['cold', 'ok', 'hot'] as const).map((type) => (
                <VoteButton key={type} type={type} selected={vote === type} onClick={() => handleVote(type)} />
              ))}
            </div>
          )}

          {vote && cooldown === 0 && (
            <div style={{ textAlign: 'center', marginTop: 14 }}>
              <span style={{ fontSize: 12, color: TOKEN.text3 }}>의견은 1시간 후 자동으로 만료돼요</span>
            </div>
          )}
        </div>

        <LoginPromptCard onLogin={onLogin} />

        <div style={{ textAlign: 'center', marginTop: 18 }}>
          <button
            style={{
              fontSize: 12,
              color: TOKEN.text3,
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              textDecoration: 'underline',
              fontFamily: FONT,
            }}
          >
            장소 정보가 잘못됐나요?
          </button>
        </div>
      </div>
    </div>
  );
}
