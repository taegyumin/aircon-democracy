'use client';

// 카페·음식점 wizard — Naver Map picker wrap + place upsert.

import { TOKEN, FONT } from '@aircon/core';
import { api } from '../../../lib/apiClient';
import { NaverMapPicker } from '../../../components/NaverMapPicker';
import { WizardHeader } from '../WizardHeader';

interface Props {
  onBack: () => void;
  onPicked: (placeId: string) => void;
}

export function CafeWizard({ onBack, onPicked }: Props) {
  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', background: TOKEN.bg, fontFamily: FONT }}>
      <WizardHeader title="카페·음식점 위치" onBack={onBack} />
      <div style={{ flex: 1, minHeight: 0 }}>
        <NaverMapPicker
          onConfirm={async ({ placeId, name, address, lat, lng }) => {
            try {
              await api.upsertPlace({
                id: placeId,
                name,
                type: 'other',
                district: address || undefined,
                detail: `좌표 ${lat.toFixed(4)}, ${lng.toFixed(4)}`,
              });
              onPicked(placeId);
            } catch (e) {
              alert((e as Error).message);
            }
          }}
        />
      </div>
    </div>
  );
}
