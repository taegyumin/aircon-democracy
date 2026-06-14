// ThermoVote — 투표 화면의 hero. 추워요/적당해요/더워요 thermal 버튼.
// 직관·접근성: 선택 전 = neutral surface(색은 아이콘만), 선택 후 = thermal fill + check + "내 선택" + a11yState.
// 색만으로 상태 구분하지 않음 (색약 대응).

import { View, Pressable, StyleSheet } from 'react-native';
import { Snowflake, Check, Flame, Minus, type LucideIcon } from 'lucide-react-native';
import { TOKEN, SPACE, VOTE_CONFIG, SPECTRUM, type VoteType } from '@aircon/core';
import { AppText } from './AppText';

const ICON: Record<VoteType, LucideIcon> = {
  cold: Snowflake, ok: Minus, hot: Flame,
};

export function ThermoVote({ selected, onVote, disabled }: {
  selected?: VoteType | null;
  onVote: (v: VoteType) => void;
  disabled?: boolean;
}) {
  return (
    <View style={styles.row}>
      {SPECTRUM.map((t) => {
        const cfg = VOTE_CONFIG[t];
        const active = selected === t;
        const Icon = ICON[t];
        return (
          <Pressable
            key={t}
            onPress={() => onVote(t)}
            disabled={disabled}
            accessibilityRole="button"
            accessibilityLabel={cfg.label}
            accessibilityState={{ selected: active, disabled }}
            style={({ pressed }) => [
              styles.btn,
              active
                ? { backgroundColor: cfg.color, borderColor: cfg.color }
                : { backgroundColor: TOKEN.surface, borderColor: TOKEN.border },
              pressed && !disabled ? { transform: [{ scale: 0.97 }] } : null,
            ]}
          >
            {active && (
              <View style={styles.checkBadge}>
                <Check size={13} color={cfg.color} strokeWidth={3} />
              </View>
            )}
            <Icon size={30} color={active ? '#FFFFFF' : cfg.color} />
            <AppText variant="bodyLg" weight="bold" color={active ? '#FFFFFF' : TOKEN.text1} center>
              {cfg.label}
            </AppText>
            {active && <AppText variant="micro" color="#FFFFFFDD">내 선택</AppText>}
          </Pressable>
        );
      })}
    </View>
  );
}

// ResultSpectrum — cold|ok|hot 분절 막대 + 라벨 + % + n명 (순수 그라데이션 ❌ → 색약/수치 판독).
export function ResultSpectrum({ votes }: { votes: Record<VoteType, number> }) {
  const total = SPECTRUM.reduce((s, t) => s + (votes[t] ?? 0), 0);
  return (
    <View style={{ gap: SPACE.s3 }}>
      <AppText variant="caption" color={TOKEN.text2}>지금까지 {total}명 의견</AppText>
      {/* 한눈 스펙트럼 바 */}
      <View style={styles.bar} accessibilityElementsHidden>
        {SPECTRUM.map((t) => {
          const pct = total > 0 ? (votes[t] ?? 0) / total : 1 / 3;
          return <View key={t} style={{ flex: pct || 0.001, backgroundColor: VOTE_CONFIG[t].color }} />;
        })}
      </View>
      {/* 정확한 수치 (legend) */}
      <View style={{ gap: SPACE.s2 }}>
        {SPECTRUM.map((t) => {
          const n = votes[t] ?? 0;
          const pct = total > 0 ? Math.round((n / total) * 100) : 0;
          const cfg = VOTE_CONFIG[t];
          return (
            <View key={t} style={styles.legendRow} accessibilityLabel={`${cfg.label} ${pct}퍼센트, ${n}명`}>
              <View style={[styles.dot, { backgroundColor: cfg.color }]} />
              <AppText variant="label" color={TOKEN.text1} style={{ width: 64 }}>{cfg.label}</AppText>
              <View style={styles.trackBg}>
                <View style={[styles.trackFill, { width: `${pct}%`, backgroundColor: cfg.color }]} />
              </View>
              <AppText variant="label" weight="bold" color={cfg.color} style={{ width: 44, textAlign: 'right' }}>{pct}%</AppText>
            </View>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: SPACE.s2 },
  btn: {
    flex: 1,
    minHeight: 116,
    borderRadius: TOKEN.r.lg,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACE.s2,
    paddingVertical: SPACE.s3,
  },
  checkBadge: {
    position: 'absolute', top: 8, right: 8,
    width: 22, height: 22, borderRadius: 11,
    backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center',
  },
  bar: { flexDirection: 'row', height: 12, borderRadius: TOKEN.r.pill, overflow: 'hidden' },
  legendRow: { flexDirection: 'row', alignItems: 'center', gap: SPACE.s2 },
  dot: { width: 10, height: 10, borderRadius: 5 },
  trackBg: { flex: 1, height: 8, backgroundColor: TOKEN.surface2, borderRadius: TOKEN.r.pill, overflow: 'hidden' },
  trackFill: { height: '100%', borderRadius: TOKEN.r.pill },
});
