import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeInDown, FadeOutDown } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { fonts, radius, spacing } from '@/theme/tokens';
import { useTheme } from '@/theme/useTheme';
import { useUndoStore } from '@/store/undo';

/** "Logged: Double — UNDO". Undo instead of confirm, everywhere. */
export function UndoSnackbar() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const toast = useUndoStore((s) => s.toast);
  const undo = useUndoStore((s) => s.undo);

  if (!toast) return null;

  return (
    <Animated.View
      entering={FadeInDown.duration(180)}
      exiting={FadeOutDown.duration(140)}
      pointerEvents="box-none"
      style={[styles.wrap, { bottom: insets.bottom + spacing.l }]}
    >
      <View style={[styles.toast, { backgroundColor: colors.toastBg }]}>
        <Text style={[styles.text, { color: colors.toastText }]} numberOfLines={1}>
          {toast.label}
        </Text>
        <Pressable
          accessibilityRole="button"
          onPress={() => void undo()}
          hitSlop={12}
        >
          <Text style={[styles.action, { color: colors.accent }]}>Undo</Text>
        </Pressable>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    left: spacing.l,
    right: spacing.l,
    alignItems: 'center',
  },
  toast: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.l,
    borderRadius: radius.m,
    paddingVertical: spacing.m,
    paddingHorizontal: spacing.l,
    minWidth: '70%',
    justifyContent: 'space-between',
    shadowColor: '#000',
    shadowOpacity: 0.25,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },
  text: {
    fontFamily: fonts.bodyMedium,
    fontSize: 15,
    flexShrink: 1,
  },
  action: {
    fontFamily: fonts.displayBold,
    fontSize: 16,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
});
