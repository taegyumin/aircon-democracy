import { useState } from 'react';
import { TOKEN, VOTE_CONFIG, FONT, type VoteType } from '../lib/tokens';
import { api } from '../lib/api';
import { recordVote, type RecentPlace } from '../lib/recentPlaces';
import { PlaceTypeIcon } from './PlaceTypeIcon';

interface Props {
  place: RecentPlace;
  onVoted: (placeId: string) => void;
  onOpen: (placeId: string) => void;
}

// QuickVoteCard — Anchoring A: NO totals shown, just vote buttons.
// On submit, casts vote then navigates to VoteScreen for confirmation + correction.
export function QuickVoteCard({ place, onVoted, onOpen }: Props) {
  const [submitting, setSubmitting] = useState<VoteType | null>(null);

  const cast = async (v: VoteType, e: React.MouseEvent) => {
    e.stopPropagation();
    if (submitting) return;
    setSubmitting(v);
    try {
      await api.vote(place.id, v);
      recordVote(place.id);
    } catch {
      /* tolerate — VoteScreen will resolve state */
    }
    onVoted(place.id);
  };

  return (
    <div
      onClick={() => onOpen(place.id)}
      style={{
        background: TOKEN.surface,
        borderRadius: TOKEN.r.lg,
        padding: 12,
        boxShadow: '0 1px 6px rgba(0,0,0,0.06)',
        display: 'flex',
        flexDirection: 'column',
        gap: 10,
        cursor: 'pointer',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <div
          style={{
            width: 36,
            height: 36,
            borderRadius: TOKEN.r.md,
            background: TOKEN.bg,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
            overflow: 'hidden',
          }}
        >
          <PlaceTypeIcon name={place.name} type={place.type} size={20} />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            style={{
              fontSize: 14,
              fontWeight: 700,
              color: TOKEN.text1,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {place.name}
          </div>
          <div style={{ fontSize: 11, color: TOKEN.text3, marginTop: 2 }}>
            {place.district || formatRelative(place.lastVisitedAt)}
          </div>
        </div>
      </div>
      <div style={{ display: 'flex', gap: 6 }}>
        {(['cold', 'ok', 'hot'] as const).map((t) => {
          const c = VOTE_CONFIG[t];
          const isSubmitting = submitting === t;
          const dim = !!submitting && !isSubmitting;
          return (
            <button
              key={t}
              onClick={(e) => cast(t, e)}
              disabled={!!submitting}
              style={{
                flex: 1,
                padding: '10px 0',
                background: c.bg,
                color: c.color,
                border: `1.5px solid ${c.color}33`,
                borderRadius: TOKEN.r.sm,
                fontSize: 13,
                fontWeight: 800,
                cursor: submitting ? 'wait' : 'pointer',
                fontFamily: FONT,
                opacity: dim ? 0.35 : 1,
                transition: 'opacity 0.15s',
              }}
            >
              {isSubmitting ? '⌛' : c.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function formatRelative(ts: number): string {
  const sec = Math.floor((Date.now() - ts) / 1000);
  if (sec < 60) return '방금 본 곳';
  if (sec < 3600) return `${Math.floor(sec / 60)}분 전 본 곳`;
  if (sec < 86400) return `${Math.floor(sec / 3600)}시간 전 본 곳`;
  const d = Math.floor(sec / 86400);
  if (d === 1) return '어제 본 곳';
  return `${d}일 전 본 곳`;
}
