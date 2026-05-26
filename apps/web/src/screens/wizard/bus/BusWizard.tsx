'use client';

// 버스 wizard — 노선/정류장 입력 → 차량 식별 → 투표.
// 향후 (data.go.kr 추가 신청 활성화 후) 노선/정류장 자동완성으로 진화 예정.

import { useState } from 'react';
import { TOKEN, FONT } from '@aircon/core';
import { api } from '../../../lib/apiClient';
import { WizardHeader } from '../WizardHeader';
import { Label } from '../Label';
import { fieldStyle, primaryButtonStyle } from '../styles';
import { useBusMatch } from './useBusMatch';
import { buildBusPlace } from './buildBusPlace';

interface Props {
  onBack: () => void;
  onPicked: (placeId: string) => void;
}

export function BusWizard({ onBack, onPicked }: Props) {
  const [routeName, setRouteName] = useState('');
  const [stopName, setStopName] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { match, loading: matchLoading, triggered, tryMatch, reset } = useBusMatch();

  const canMatch = !!routeName.trim() && !!stopName.trim() && !matchLoading;

  const submit = async () => {
    if (!routeName.trim()) return;
    setSubmitting(true);
    setError(null);
    try {
      const payload = buildBusPlace({ routeName, stopName, match });
      await api.upsertPlace(payload);
      onPicked(payload.id);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', background: TOKEN.bg, fontFamily: FONT }}>
      <WizardHeader title="버스" onBack={onBack} />
      <div style={{ flex: 1, overflowY: 'auto', padding: '24px 20px 60px' }}>
        <div style={{ fontSize: 20, fontWeight: 900, color: TOKEN.text1, marginBottom: 6, letterSpacing: '-0.4px' }}>
          어떤 버스 타고 계세요?
        </div>
        <div style={{ fontSize: 13, color: TOKEN.text2, marginBottom: 22, lineHeight: 1.6 }}>
          노선 번호 + 지금 지나는 정류장을 알려주시면 어떤 차량인지 찾아드릴게요.
        </div>

        <Label>노선 번호 *</Label>
        <input
          value={routeName}
          onChange={(e) => { setRouteName(e.target.value); reset(); }}
          placeholder="예: 272, 5511, M7106"
          style={fieldStyle(!!routeName)}
          inputMode="text"
          autoFocus
        />

        <div style={{ height: 14 }} />

        <Label>지나는 정류장 *</Label>
        <input
          value={stopName}
          onChange={(e) => { setStopName(e.target.value); reset(); }}
          placeholder="예: 신촌오거리, 강남역.강남대로"
          style={fieldStyle(!!stopName)}
        />

        <div style={{ height: 18 }} />

        {!triggered && (
          <button
            onClick={() => tryMatch(routeName, stopName)}
            disabled={!canMatch}
            style={{
              width: '100%', padding: '13px',
              background: canMatch ? TOKEN.surface : TOKEN.bg,
              color: canMatch ? TOKEN.cold : TOKEN.text3,
              border: `1.5px solid ${canMatch ? TOKEN.cold : TOKEN.border}`,
              borderRadius: TOKEN.r.md, fontSize: 14, fontWeight: 700,
              cursor: canMatch ? 'pointer' : 'default', fontFamily: FONT,
            }}
          >
            너가 타고 있는 버스 찾기
          </button>
        )}

        {matchLoading && (
          <div style={{ padding: '14px', textAlign: 'center', fontSize: 13, color: TOKEN.text2 }}>
            {routeName}번 차량 위치 조회 중…
          </div>
        )}

        {!matchLoading && match && (
          <div style={{
            padding: '14px 16px',
            background: match.matched ? '#F0FDF4' : TOKEN.surface,
            border: `1.5px solid ${match.matched ? TOKEN.ok : TOKEN.border}`,
            borderRadius: TOKEN.r.md,
          }}>
            {match.matched ? (
              <div>
                <div style={{ fontSize: 11, color: TOKEN.text2, marginBottom: 4 }}>이 버스 맞으시죠?</div>
                <div style={{ fontSize: 16, fontWeight: 900, color: TOKEN.text1, letterSpacing: '-0.3px' }}>
                  {match.routeName}번 · 차량번호 {match.plainNo}
                </div>
                <div style={{ fontSize: 12, color: TOKEN.text2, marginTop: 4 }}>
                  {match.currentStop} 지나는 중{match.nextStop ? ` · 다음 ${match.nextStop}` : ''}
                </div>
              </div>
            ) : (
              <div style={{ fontSize: 12, color: TOKEN.text3, lineHeight: 1.5 }}>
                {match.reason === 'no_vehicle_at_stop'
                  ? `${routeName}번이 지금 ${stopName} 근처에 없어요. 정류장명 확인하거나 그냥 노선 단위로 투표할게요.`
                  : match.reason === 'route_or_stop_not_found'
                  ? '노선 또는 정류장을 못 찾았어요. 정확한 이름을 입력해주세요.'
                  : match.reason === 'no_api_key'
                  ? '아직 API 키 활성화 대기 중이에요. 잠시 후 다시 시도해주세요. (그래도 노선 단위로 투표는 가능)'
                  : '차량을 못 찾았어요. 노선 단위로 투표할게요.'}
              </div>
            )}
          </div>
        )}

        {error && (
          <div style={{ marginTop: 14, padding: 10, background: TOKEN.hotBg, color: TOKEN.hot, borderRadius: TOKEN.r.md, fontSize: 12 }}>{error}</div>
        )}

        <div style={{ height: 28 }} />

        <button
          onClick={submit}
          disabled={!routeName.trim() || submitting}
          style={primaryButtonStyle(!!routeName.trim() && !submitting)}
        >
          {submitting ? '이동 중…' : match?.matched ? '이 차량으로 투표하기' : '투표하러 가기'}
        </button>
      </div>
    </div>
  );
}
