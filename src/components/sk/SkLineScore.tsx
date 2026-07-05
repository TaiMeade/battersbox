import { useRef, type ReactNode } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';

import { Eyebrow, Mono } from '@/components/typography';
import type { LineScore } from '@/domain/skGame';
import { spacing } from '@/theme/tokens';
import { useTheme } from '@/theme/useTheme';

const HEADER_H = 16;
const ROW_H = 26;

/** Fixed-height cell so the gutter labels and digit columns stay in register. */
function Cell({ height, children }: { height: number; children: ReactNode }) {
  return <View style={{ height, justifyContent: 'center' }}>{children}</View>;
}

/**
 * The inning-by-inning board, meant to sit inside a ScoreboardPanel.
 * Innings scroll horizontally; the run totals column stays pinned like
 * the R on a real scoreboard. Untouched innings show a dash, not a zero.
 */
export function SkLineScore({
  lineScore,
  currentInning,
}: {
  lineScore: LineScore;
  currentInning?: number;
}) {
  const { colors } = useTheme();
  const scrollRef = useRef<ScrollView>(null);

  const runs = (value: number | null) => (
    <Cell height={ROW_H}>
      <Mono size={18} color={value === null ? colors.panelTextSoft : colors.accent}>
        {value === null ? '–' : String(value)}
      </Mono>
    </Cell>
  );

  return (
    <View style={styles.wrap}>
      <View style={styles.gutter}>
        <Cell height={HEADER_H}>{null}</Cell>
        <Cell height={ROW_H}>
          <Eyebrow size={11} color={colors.panelText}>
            Us
          </Eyebrow>
        </Cell>
        <Cell height={ROW_H}>
          <Eyebrow size={11} color={colors.panelText}>
            Them
          </Eyebrow>
        </Cell>
      </View>

      <ScrollView
        ref={scrollRef}
        horizontal
        showsHorizontalScrollIndicator={false}
        onContentSizeChange={() => scrollRef.current?.scrollToEnd({ animated: false })}
        style={{ flex: 1 }}
        contentContainerStyle={{ gap: spacing.m }}
      >
        {lineScore.innings.map((inning) => {
          const isCurrent = inning.inning === currentInning;
          return (
            <View key={inning.inning} style={styles.column}>
              <Cell height={HEADER_H}>
                <Eyebrow size={10} color={isCurrent ? colors.accent : colors.panelTextSoft}>
                  {String(inning.inning)}
                </Eyebrow>
              </Cell>
              {runs(inning.us)}
              {runs(inning.them)}
            </View>
          );
        })}
      </ScrollView>

      <View style={[styles.totals, { borderLeftColor: colors.panelEdge }]}>
        <Cell height={HEADER_H}>
          <Eyebrow size={10} color={colors.panelTextSoft}>
            R
          </Eyebrow>
        </Cell>
        <Cell height={ROW_H}>
          <Mono size={18} color={colors.accent}>
            {String(lineScore.usTotal)}
          </Mono>
        </Cell>
        <Cell height={ROW_H}>
          <Mono size={18} color={colors.accent}>
            {String(lineScore.themTotal)}
          </Mono>
        </Cell>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    gap: spacing.m,
  },
  gutter: {
    alignItems: 'flex-start',
  },
  column: {
    alignItems: 'center',
    minWidth: 24,
  },
  totals: {
    alignItems: 'center',
    borderLeftWidth: StyleSheet.hairlineWidth,
    paddingLeft: spacing.m,
    minWidth: 32,
  },
});
