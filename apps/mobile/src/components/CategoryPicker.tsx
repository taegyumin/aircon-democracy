// 카테고리 picker — 일관 ListRow. 이동 중 / 머무르는 곳 / 다른 장소 찾기.
// 디자인: tint는 아이콘 칩에만(행 자체는 중립 — 2색 primary 경쟁 제거), 위계는 그룹·순서로.

import * as React from 'react';
import { View } from 'react-native';
import { TOKEN, SPACE } from '@aircon/core';
import { ListRow, SectionHeader } from '../ui';
import { CATEGORIES, type Category, type CategoryDef } from '../screens/categories';

interface Props {
  onPick: (k: Category) => void;
}

function CatRow({ c, onPick, muted }: { c: CategoryDef; onPick: () => void; muted?: boolean }) {
  const Icon = c.Icon;
  return (
    <ListRow
      title={c.label}
      onPress={onPick}
      leading={
        <View style={{ width: 44, height: 44, borderRadius: TOKEN.r.md, alignItems: 'center', justifyContent: 'center', backgroundColor: muted ? TOKEN.surface2 : `${c.tint}14` }}>
          <Icon size={22} color={muted ? TOKEN.text3 : c.tint} strokeWidth={2.1} />
        </View>
      }
    />
  );
}

export function CategoryPicker({ onPick }: Props) {
  const move = CATEGORIES.filter((c) => c.group === 'move');
  const stay = CATEGORIES.filter((c) => c.group === 'stay' && c.key !== 'custom');
  const custom = CATEGORIES.find((c) => c.key === 'custom');

  return (
    <View style={{ gap: SPACE.s6 }}>
      <View>
        <SectionHeader>이동 중</SectionHeader>
        <View style={{ gap: SPACE.rowGap }}>
          {move.map((c) => <CatRow key={c.key} c={c} onPick={() => onPick(c.key)} />)}
        </View>
      </View>
      <View>
        <SectionHeader>머무르는 곳</SectionHeader>
        <View style={{ gap: SPACE.rowGap }}>
          {stay.map((c) => <CatRow key={c.key} c={c} onPick={() => onPick(c.key)} />)}
        </View>
      </View>
      {custom && <CatRow c={custom} onPick={() => onPick(custom.key)} muted />}
    </View>
  );
}
