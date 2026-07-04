import { Pressable, StyleSheet, Text, type ViewStyle } from 'react-native';

import { fonts, radius, spacing } from '@/theme/tokens';
import { useTheme } from '@/theme/useTheme';

/**
 * Thumb-zone action button. Primary is a lit scoreboard bulb:
 * amber with ink lettering, big enough for a batting glove.
 */
export function BigButton({
  label,
  onPress,
  variant = 'primary',
  disabled = false,
  style,
}: {
  label: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'danger';
  disabled?: boolean;
  style?: ViewStyle;
}) {
  const { colors } = useTheme();

  const background =
    variant === 'primary' ? colors.primary : 'transparent';
  const borderColor =
    variant === 'primary'
      ? colors.primary
      : variant === 'danger'
        ? colors.danger
        : colors.line;
  const textColor =
    variant === 'primary'
      ? colors.primaryText
      : variant === 'danger'
        ? colors.danger
        : colors.text;

  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        {
          backgroundColor: background,
          borderColor,
          opacity: disabled ? 0.4 : pressed ? 0.82 : 1,
          transform: [{ scale: pressed ? 0.985 : 1 }],
        },
        style,
      ]}
    >
      <Text style={[styles.label, { color: textColor }]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    minHeight: 58,
    borderRadius: radius.l,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xl,
  },
  label: {
    fontFamily: fonts.displayBold,
    fontSize: 20,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
});
