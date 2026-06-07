// Mobile CategoryPicker — web CategoryPicker (RN port).
// Place Select Redesign + Home Redesign v2: 지하철 primary row, 버스/기차 split,
// 머무르는 곳 split (강의실 / 카페·음식점), 다른 장소 찾기 footer row.

import * as React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { TOKEN } from '@aircon/core';
import {
  CATEGORIES,
  type Category,
  type CategoryDef,
  ArrowRightIcon,
  SearchIcon,
} from '../screens/categories';

interface Props {
  onPick: (k: Category) => void;
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return <Text style={styles.sectionLabel}>{children}</Text>;
}

function PrimaryRow({ c, onPick }: { c: CategoryDef; onPick: () => void }) {
  const Icon = c.Icon;
  return (
    <Pressable
      onPress={onPick}
      style={[
        styles.primaryRow,
        {
          borderColor: `${c.tint}22`,
          shadowColor: c.tint,
        },
      ]}
    >
      <View style={[styles.primaryIconBg, { backgroundColor: `${c.tint}15` }]}>
        <Icon size={22} color={c.tint} strokeWidth={2.1} />
      </View>
      <View style={styles.primaryTextWrap}>
        <View style={styles.primaryTitleRow}>
          <Text style={styles.primaryLabel}>{c.label}</Text>
          <View style={[styles.primaryBadge, { backgroundColor: `${c.tint}15` }]}>
            <Text style={[styles.primaryBadgeText, { color: c.tint }]}>자주 선택</Text>
          </View>
        </View>
        <Text style={styles.primarySub}>{c.sub}</Text>
      </View>
      <ArrowRightIcon size={17} color={c.tint} />
    </Pressable>
  );
}

function SecondaryTile({ c, onPick, muted }: { c: CategoryDef; onPick: () => void; muted?: boolean }) {
  const Icon = c.Icon;
  return (
    <Pressable onPress={onPick} style={[styles.tile, { opacity: muted ? 0.85 : 1 }]}>
      <View
        style={[
          styles.tileIconBg,
          { backgroundColor: muted ? TOKEN.bg : `${c.tint}12` },
        ]}
      >
        <Icon size={20} color={muted ? TOKEN.text2 : c.tint} strokeWidth={2.1} />
      </View>
      <View style={styles.tileTextWrap}>
        <Text style={[styles.tileLabel, { color: muted ? TOKEN.text2 : TOKEN.text1 }]}>{c.label}</Text>
        <Text style={styles.tileSub} numberOfLines={1}>
          {c.sub}
        </Text>
      </View>
    </Pressable>
  );
}

function FindOtherRow({ c, onPick }: { c: CategoryDef; onPick: () => void }) {
  return (
    <Pressable onPress={onPick} style={styles.findOtherRow}>
      <View style={styles.findOtherIconBg}>
        <SearchIcon size={18} color={TOKEN.text2} />
      </View>
      <View style={styles.findOtherTextWrap}>
        <Text style={styles.findOtherLabel}>다른 장소 찾기</Text>
        <Text style={styles.findOtherSub}>{c.sub}</Text>
      </View>
      <ArrowRightIcon size={17} color={TOKEN.text3} />
    </Pressable>
  );
}

export function CategoryPicker({ onPick }: Props) {
  const moveCats = CATEGORIES.filter((c) => c.group === 'move');
  const stayCats = CATEGORIES.filter((c) => c.group === 'stay' && c.key !== 'custom');
  // mobile: 'custom' (다른 장소 찾기 = CustomPlaceSearch)는 RN 포팅 안 됨 → hide.
  // 별도 sprint에서 mobile에 CustomPlaceSearch 포팅 후 노출.
  const customCat = null;
  const primaryMoves = moveCats.filter((c) => c.rank === 'primary');
  const secondaryMove = moveCats.filter((c) => c.rank !== 'primary');

  return (
    <View style={{ gap: 22 }}>
      <View>
        <SectionLabel>이동 중</SectionLabel>
        {primaryMoves.map((c) => (
          <PrimaryRow key={c.key} c={c} onPick={() => onPick(c.key)} />
        ))}
        {secondaryMove.length > 0 && (
          <View style={styles.row}>
            {secondaryMove.map((c) => (
              <SecondaryTile key={c.key} c={c} onPick={() => onPick(c.key)} muted={c.rank === 'muted'} />
            ))}
          </View>
        )}
      </View>
      <View>
        <SectionLabel>머무르는 곳</SectionLabel>
        <View style={styles.row}>
          {stayCats.map((c) => (
            <SecondaryTile key={c.key} c={c} onPick={() => onPick(c.key)} />
          ))}
        </View>
      </View>
      {customCat && <FindOtherRow c={customCat} onPick={() => onPick(customCat.key)} />}
    </View>
  );
}

const styles = StyleSheet.create({
  sectionLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: TOKEN.text3,
    letterSpacing: 1,
    textTransform: 'uppercase',
    marginBottom: 10,
  },
  primaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 13,
    backgroundColor: TOKEN.surface,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1.5,
    marginBottom: 8,
    shadowOpacity: 0.08,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  primaryIconBg: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryTextWrap: { flex: 1, minWidth: 0 },
  primaryTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 3 },
  primaryLabel: { fontSize: 16, fontWeight: '700', color: TOKEN.text1, letterSpacing: -0.3 },
  primaryBadge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 999 },
  primaryBadgeText: { fontSize: 10, fontWeight: '700' },
  primarySub: { fontSize: 12, color: TOKEN.text2 },
  row: { flexDirection: 'row', gap: 8 },
  tile: {
    flex: 1,
    flexDirection: 'column',
    gap: 12,
    backgroundColor: TOKEN.surface,
    borderRadius: 16,
    paddingVertical: 16,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: TOKEN.border,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 5,
    shadowOffset: { width: 0, height: 1 },
    elevation: 1,
  },
  tileIconBg: {
    width: 40,
    height: 40,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tileTextWrap: { minWidth: 0 },
  tileLabel: { fontSize: 14, fontWeight: '700', marginBottom: 3, letterSpacing: -0.2 },
  tileSub: { fontSize: 11, color: TOKEN.text3, lineHeight: 15 },
  findOtherRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: TOKEN.surface,
    borderRadius: 16,
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: TOKEN.border,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 5,
    shadowOffset: { width: 0, height: 1 },
    elevation: 1,
  },
  findOtherIconBg: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: TOKEN.bg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  findOtherTextWrap: { flex: 1, minWidth: 0 },
  findOtherLabel: { fontSize: 14, fontWeight: '700', color: TOKEN.text1, letterSpacing: -0.2, marginBottom: 2 },
  findOtherSub: { fontSize: 11, color: TOKEN.text3, lineHeight: 15 },
});
