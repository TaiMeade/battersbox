import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import * as Haptics from 'expo-haptics';
import { Pressable, StyleSheet, View } from 'react-native';

import { Eyebrow, Mono } from '@/components/typography';
import { radius, spacing } from '@/theme/tokens';
import { useTheme } from '@/theme/useTheme';

/**
 * A scoreboard dial: big − / + targets flanking an amber value. Built to
 * live on the green panel and be worked with a thumb in the bleachers.
 */
export function Stepper({
  label,
  value,
  onDec,
  onInc,
  decDisabled = false,
}: {
  label: string;
  value: number | string;
  onDec: () => void;
  onInc: () => void;
  decDisabled?: boolean;
}) {
  const { colors } = useTheme();

  const button = (kind: 'minus' | 'plus', onPress: () => void, disabled: boolean) => (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${label} ${kind === 'plus' ? 'up' : 'down'}`}
      disabled={disabled}
      onPress={() => {
        void Haptics.selectionAsync();
        onPress();
      }}
      hitSlop={8}
      style={({ pressed }) => [
        styles.button,
        { borderColor: colors.panelEdge, opacity: disabled ? 0.3 : pressed ? 0.6 : 1 },
      ]}
    >
      <MaterialCommunityIcons name={kind} size={22} color={colors.panelText} />
    </Pressable>
  );

  return (
    <View style={styles.wrap}>
      <Eyebrow size={11} color={colors.panelTextSoft}>
        {label}
      </Eyebrow>
      <View style={styles.row}>
        {button('minus', onDec, decDisabled)}
        <Mono size={24} color={colors.accent} style={styles.value} numberOfLines={1}>
          {String(value)}
        </Mono>
        {button('plus', onInc, false)}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignItems: 'center',
    gap: spacing.xs,
    flex: 1,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.s,
  },
  button: {
    width: 40,
    height: 40,
    borderRadius: radius.s,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  value: {
    minWidth: 34,
    textAlign: 'center',
  },
});
