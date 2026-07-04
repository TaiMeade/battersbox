import * as Haptics from 'expo-haptics';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';

import { Eyebrow } from '@/components/typography';
import {
  OUTCOME_GROUPS,
  OUTCOME_SPECS,
  type OutcomeCode,
  type OutcomeGroup,
} from '@/domain/outcomes';
import { fonts, radius, spacing } from '@/theme/tokens';
import { useTheme } from '@/theme/useTheme';

/**
 * The scoreboard-tile grid. Grouped by what the outcome means to the
 * scorer — Hits / On base / Outs / Sacrifice — because that grouping IS
 * the scoring rule (AB or not, OBP or not). Long-press any tricky tile
 * for a plain-language explainer.
 */
export function OutcomeGrid({
  onSelect,
  compact = false,
}: {
  onSelect: (code: OutcomeCode) => void;
  compact?: boolean;
}) {
  return (
    <View style={{ gap: compact ? spacing.m : spacing.l }}>
      {OUTCOME_GROUPS.map((group) => (
        <View key={group.key} style={{ gap: spacing.s }}>
          <Eyebrow size={compact ? 10 : 12}>{group.title}</Eyebrow>
          <View style={styles.wrap}>
            {group.codes.map((code) => (
              <OutcomeTile
                key={code}
                code={code}
                group={group.key}
                perRow={group.codes.length <= 4 ? group.codes.length : 3}
                compact={compact}
                onSelect={onSelect}
              />
            ))}
          </View>
        </View>
      ))}
    </View>
  );
}

function OutcomeTile({
  code,
  group,
  perRow,
  compact,
  onSelect,
}: {
  code: OutcomeCode;
  group: OutcomeGroup;
  perRow: number;
  compact: boolean;
  onSelect: (code: OutcomeCode) => void;
}) {
  const { colors } = useTheme();
  const spec = OUTCOME_SPECS[code];
  const groupColors = colors.group[group];
  // 2 gaps of 8 around 3 tiles etc. — leave ~2% slack for rounding
  const basisPct = `${Math.floor(100 / perRow) - 2}%` as const;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={spec.name}
      onPressIn={() => {
        void Haptics.selectionAsync();
      }}
      onPress={() => onSelect(code)}
      onLongPress={
        spec.hint ? () => Alert.alert(spec.name, spec.hint) : undefined
      }
      style={({ pressed }) => [
        styles.tile,
        {
          flexBasis: basisPct,
          minHeight: compact ? 56 : 72,
          borderRadius: radius.m,
          backgroundColor: pressed ? groupColors.pressedBg : colors.card,
          borderColor: pressed ? groupColors.pressedBg : colors.line,
        },
      ]}
    >
      {({ pressed }) => (
        <>
          <Text
            style={{
              fontFamily: fonts.displayBold,
              fontSize: compact ? 20 : 26,
              color: pressed ? groupColors.pressedFg : groupColors.fg,
            }}
          >
            {code}
          </Text>
          {!compact && (
            <Text
              numberOfLines={1}
              style={{
                fontFamily: fonts.bodyMedium,
                fontSize: 11,
                color: pressed ? groupColors.pressedFg : colors.textSoft,
              }}
            >
              {spec.name}
            </Text>
          )}
        </>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.s,
  },
  tile: {
    flexGrow: 1,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
    paddingHorizontal: spacing.xs,
  },
});
