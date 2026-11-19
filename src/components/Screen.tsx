import type { ReactNode } from 'react';
import { ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { CONTENT_MAX, CONTENT_MAX_WIDE } from '@/hooks/useLayout';
import { spacing } from '@/theme/tokens';
import { useTheme } from '@/theme/useTheme';

/**
 * Standard screen chrome: themed background, safe-area insets, side padding,
 * and a centered column so nothing stretches across a wide monitor. Phones
 * are narrower than the column, so they're unaffected. `wide` allows the
 * two-column layouts more room.
 */
export function Screen({
  children,
  scroll = false,
  padded = true,
  topInset = true,
  wide = false,
}: {
  children: ReactNode;
  scroll?: boolean;
  padded?: boolean;
  topInset?: boolean;
  wide?: boolean;
}) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const paddingTop = topInset ? insets.top + spacing.s : 0;
  const side = padded ? spacing.l : 0;
  // Landscape iPhones: keep content clear of the notch / Dynamic Island.
  const paddingLeft = side + insets.left;
  const paddingRight = side + insets.right;
  const column = {
    width: '100%',
    maxWidth: (wide ? CONTENT_MAX_WIDE : CONTENT_MAX) + paddingLeft + paddingRight,
    alignSelf: 'center',
  } as const;

  if (scroll) {
    return (
      <ScrollView
        style={{ flex: 1, backgroundColor: colors.bg }}
        contentContainerStyle={[
          column,
          { paddingTop, paddingLeft, paddingRight, paddingBottom: spacing.xxl, gap: spacing.l },
        ]}
        keyboardShouldPersistTaps="handled"
      >
        {children}
      </ScrollView>
    );
  }
  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <View style={[column, { flex: 1, paddingTop, paddingLeft, paddingRight }]}>{children}</View>
    </View>
  );
}
