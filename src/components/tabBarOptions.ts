import type { BottomTabNavigationOptions } from '@react-navigation/bottom-tabs';

import { useIsWide } from '@/hooks/useLayout';
import { fonts, spacing } from '@/theme/tokens';
import { useTheme } from '@/theme/useTheme';

/**
 * Screen options shared by both tab sets (Player and Scorekeeper Mode).
 * Phones: the usual bottom tab bar. Wide screens: a left sidebar with the
 * label beside each icon, the way desktop apps navigate.
 */
export function useTabScreenOptions(activeTint: string): BottomTabNavigationOptions {
  const { colors } = useTheme();
  const wide = useIsWide();
  return {
    headerShown: false,
    tabBarActiveTintColor: activeTint,
    tabBarInactiveTintColor: colors.textSoft,
    ...(wide
      ? {
          tabBarPosition: 'left',
          tabBarLabelPosition: 'beside-icon',
          tabBarStyle: {
            backgroundColor: colors.card,
            borderRightColor: colors.line,
            paddingTop: spacing.xl,
            minWidth: 220,
          },
          tabBarItemStyle: { borderRadius: 10, marginBottom: spacing.xs },
          tabBarActiveBackgroundColor: colors.bg,
          tabBarLabelStyle: {
            fontFamily: fonts.displayBold,
            fontSize: 17,
            letterSpacing: 1,
            textTransform: 'uppercase',
          },
        }
      : {
          tabBarPosition: 'bottom',
          tabBarStyle: {
            backgroundColor: colors.card,
            borderTopColor: colors.line,
          },
          tabBarLabelStyle: {
            fontFamily: fonts.displayBold,
            fontSize: 11,
            letterSpacing: 0.8,
            textTransform: 'uppercase',
          },
        }),
  };
}
