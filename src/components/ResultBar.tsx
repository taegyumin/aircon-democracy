import { TOKEN, VOTE_CONFIG, type VoteType } from '../lib/tokens';

interface Props {
  votes: { cold: number; ok: number; hot: number };
  myVote: VoteType | null;
}

export function ResultBar({ votes, myVote }: Props) {
  const total = (votes.cold || 0) + (votes.ok || 0) + (votes.hot || 0);
  if (total === 0) {
    return (
      <div style={{ fontSize: 13, color: TOKEN.text3, textAlign: 'center', padding: '8px 0' }}>
        아직 투표한 사람이 없어요
      </div>
    );
  }
  const pCold = Math.round((votes.cold / total) * 100);
  const pOk = Math.round((votes.ok / total) * 100);
  const pHot = 100 - pCold - pOk;
  const segs = [
    { key: 'cold' as const, pct: pCold, color: TOKEN.cold, label: '추워요' },
    { key: 'ok' as const, pct: pOk, color: TOKEN.ok, label: '적당해요' },
    { key: 'hot' as const, pct: pHot, color: TOKEN.hot, label: '더워요' },
  ];
  return (
    <div>
      <div style={{ display: 'flex', height: 9, borderRadius: 999, overflow: 'hidden', gap: 2 }}>
        {segs.map(
          (s) =>
            s.pct > 0 && (
              <div
                key={s.key}
                style={{
                  width: `${s.pct}%`,
                  background: s.color,
                  opacity: myVote && myVote !== s.key ? 0.35 : 1,
                  transition: 'width 0.8s cubic-bezier(0.4,0,0.2,1), opacity 0.3s',
                }}
              />
            )
        )}
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 12 }}>
        {segs.map((s) => (
          <div key={s.key} style={{ textAlign: 'center', minWidth: 0 }}>
            <div
              style={{
                fontSize: 17,
                fontWeight: myVote === s.key ? 900 : 600,
                color: s.color,
                opacity: myVote && myVote !== s.key ? 0.4 : 1,
                transition: 'all 0.35s',
                fontVariantNumeric: 'tabular-nums',
              }}
            >
              {s.pct}%
            </div>
            <div
              style={{
                fontSize: 11,
                marginTop: 2,
                color: myVote === s.key ? VOTE_CONFIG[s.key].color : TOKEN.text3,
                fontWeight: myVote === s.key ? 700 : 400,
              }}
            >
              {s.label}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
