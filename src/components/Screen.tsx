import type { ReactNode } from 'react';
import { ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { spacing } from '@/theme/tokens';
import { useTheme } from '@/theme/useTheme';

/** Standard screen chrome: themed background, safe top inset, side padding. */
export function Screen({
  children,
  scroll = false,
  padded = true,
  topInset = true,
}: {
  children: ReactNode;
  scroll?: boolean;
  padded?: boolean;
  topInset?: boolean;
}) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const paddingTop = topInset ? insets.top + spacing.s : 0;
  const paddingHorizontal = padded ? spacing.l : 0;

  if (scroll) {
    return (
      <ScrollView
        style={{ flex: 1, backgroundColor: colors.bg }}
        contentContainerStyle={{
          paddingTop,
          paddingHorizontal,
          paddingBottom: spacing.xxl,
          gap: spacing.l,
        }}
        keyboardShouldPersistTaps="handled"
      >
        {children}
      </ScrollView>
    );
  }
  return (
    <View style={{ flex: 1, backgroundColor: colors.bg, paddingTop, paddingHorizontal }}>
      {children}
    </View>
  );
}
