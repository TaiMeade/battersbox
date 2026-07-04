import type { ReactNode } from 'react';
import { StyleSheet, View, type ViewStyle } from 'react-native';

import { Eyebrow, Mono } from '@/components/typography';
import { radius, spacing } from '@/theme/tokens';
import { useTheme } from '@/theme/useTheme';

/**
 * The signature element: a hand-operated scoreboard panel.
 * Always monster green with amber numerals, in light and dark mode alike.
 */
export function ScoreboardPanel({
  title,
  right,
  children,
  style,
}: {
  title?: string;
  right?: ReactNode;
  children: ReactNode;
  style?: ViewStyle;
}) {
  const { colors } = useTheme();
  return (
    <View
      style={[
        styles.panel,
        { backgroundColor: colors.panel, borderColor: colors.panelEdge },
        style,
      ]}
    >
      {(title || right) && (
        <View style={[styles.header, { borderBottomColor: colors.panelEdge }]}>
          {title ? <Eyebrow color={colors.panelTextSoft}>{title}</Eyebrow> : <View />}
          {right}
        </View>
      )}
      {children}
    </View>
  );
}

/** One scoreboard cell: small chalk label over big amber digits. */
export function ScoreStat({
  label,
  value,
  size = 34,
  flex = 1,
}: {
  label: string;
  value: string;
  size?: number;
  flex?: number;
}) {
  const { colors } = useTheme();
  return (
    <View style={{ flex, alignItems: 'center', gap: spacing.xs }}>
      <Eyebrow size={11} color={colors.panelTextSoft}>
        {label}
      </Eyebrow>
      <Mono
        size={size}
        color={colors.accent}
        numberOfLines={1}
        adjustsFontSizeToFit
        minimumFontScale={0.6}
      >
        {value}
      </Mono>
    </View>
  );
}

export function ScoreStatRow({ children, style }: { children: ReactNode; style?: ViewStyle }) {
  return <View style={[styles.row, style]}>{children}</View>;
}

const styles = StyleSheet.create({
  panel: {
    borderRadius: radius.l,
    borderWidth: 1,
    padding: spacing.l,
    gap: spacing.l,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottomWidth: StyleSheet.hairlineWidth,
    paddingBottom: spacing.s,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: spacing.s,
  },
});
