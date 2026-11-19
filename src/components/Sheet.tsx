import type { ReactNode } from 'react';
import { Modal, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useIsWide } from '@/hooks/useLayout';
import { radius, spacing } from '@/theme/tokens';
import { useTheme } from '@/theme/useTheme';

/**
 * A modal sheet: slides up from the bottom on a phone, and is a centered
 * dialog on a wide screen (a full-width bottom sheet on a monitor puts the
 * buttons a long way from anything else). Tapping the backdrop closes it.
 */
export function Sheet({
  visible,
  onClose,
  closeLabel = 'Close',
  animationType = 'slide',
  maxHeight = '82%',
  children,
}: {
  visible: boolean;
  onClose: () => void;
  closeLabel?: string;
  animationType?: 'slide' | 'fade';
  maxHeight?: `${number}%`;
  children: ReactNode;
}) {
  const { colors } = useTheme();
  const wide = useIsWide();
  const insets = useSafeAreaInsets();
  const surface = { backgroundColor: colors.bg, borderColor: colors.line };

  if (wide) {
    return (
      <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
        <View style={styles.center}>
          <Pressable
            style={[StyleSheet.absoluteFill, styles.backdrop]}
            onPress={onClose}
            accessibilityLabel={closeLabel}
          />
          <View style={[styles.dialog, surface]}>{children}</View>
        </View>
      </Modal>
    );
  }

  return (
    <Modal visible={visible} transparent animationType={animationType} onRequestClose={onClose}>
      <Pressable style={[styles.fill, styles.backdrop]} onPress={onClose} accessibilityLabel={closeLabel} />
      <View
        style={[
          styles.sheet,
          surface,
          { maxHeight, paddingBottom: spacing.l + insets.bottom, paddingLeft: insets.left, paddingRight: insets.right },
        ]}
      >
        {children}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  backdrop: { backgroundColor: 'rgba(0,0,0,0.45)' },
  sheet: {
    borderTopLeftRadius: radius.l,
    borderTopRightRadius: radius.l,
    borderWidth: 1,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
  },
  dialog: {
    width: '100%',
    maxWidth: 560,
    maxHeight: '90%',
    borderRadius: radius.l,
    borderWidth: 1,
    paddingBottom: spacing.s,
    overflow: 'hidden',
  },
});
