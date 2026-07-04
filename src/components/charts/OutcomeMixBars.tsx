import { View } from 'react-native';

import { Eyebrow, Mono } from '@/components/typography';
import { OUTCOME_GROUPS, type OutcomeCode } from '@/domain/outcomes';
import type { StatLine } from '@/domain/stats';
import { radius, spacing } from '@/theme/tokens';
import { useTheme } from '@/theme/useTheme';

/**
 * Outcome mix as horizontal bars, grouped the same way as the logging grid.
 * Identity is never color-alone: every bar carries its outcome code and count
 * (which is also why the palette's deutan floor-band pair is legal here).
 */
export function OutcomeMixBars({ line }: { line: StatLine }) {
  const { colors } = useTheme();
  const max = Math.max(...Object.values(line.counts).map((n) => n ?? 0), 1);

  const sections = OUTCOME_GROUPS.map((group) => ({
    ...group,
    rows: group.codes
      .map((code) => ({ code, count: line.counts[code] ?? 0 }))
      .filter((r) => r.count > 0),
  })).filter((section) => section.rows.length > 0);

  if (sections.length === 0) return null;

  return (
    <View style={{ gap: spacing.l }}>
      {sections.map((section) => (
        <View key={section.key} style={{ gap: spacing.s }}>
          <Eyebrow size={10}>{section.title}</Eyebrow>
          <View style={{ gap: spacing.s }}>
            {section.rows.map((row) => (
              <Bar
                key={row.code}
                code={row.code}
                count={row.count}
                max={max}
                color={colors.chart.groups[section.key]}
              />
            ))}
          </View>
        </View>
      ))}
    </View>
  );
}

function Bar({
  code,
  count,
  max,
  color,
}: {
  code: OutcomeCode;
  count: number;
  max: number;
  color: string;
}) {
  const { colors } = useTheme();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.s }}>
      <Mono size={12} color={colors.textSoft} style={{ width: 34 }}>
        {code}
      </Mono>
      <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: spacing.s }}>
        <View
          style={{
            height: 14,
            width: `${(count / max) * 100}%`,
            minWidth: 6,
            backgroundColor: color,
            // flat at the baseline, rounded at the data end
            borderTopRightRadius: radius.s / 2,
            borderBottomRightRadius: radius.s / 2,
          }}
        />
        <Mono size={12} color={colors.text}>
          {String(count)}
        </Mono>
      </View>
    </View>
  );
}
