import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { Tabs } from 'expo-router';

import { fonts, palette } from '@/theme/tokens';
import { useTheme } from '@/theme/useTheme';

/**
 * Scorekeeper Mode's own tab set. The amber active tint (vs. the plain
 * text tint in Player Mode) is the at-a-glance cue for which mode you're in.
 */
export default function SkTabLayout() {
  const { colors, isDark } = useTheme();
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: isDark ? palette.bulb : palette.bulbDeep,
        tabBarInactiveTintColor: colors.textSoft,
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
      }}
    >
      <Tabs.Screen
        name="team"
        options={{
          title: 'Team',
          tabBarIcon: ({ color, size }) => (
            <MaterialCommunityIcons name="account-group" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="games"
        options={{
          title: 'Games',
          tabBarIcon: ({ color, size }) => (
            <MaterialCommunityIcons name="history" size={size} color={color} />
          ),
        }}
      />
    </Tabs>
  );
}
