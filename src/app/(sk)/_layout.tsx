import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { Tabs } from 'expo-router';

import { useTabScreenOptions } from '@/components/tabBarOptions';
import { palette } from '@/theme/tokens';
import { useTheme } from '@/theme/useTheme';

/**
 * Scorekeeper Mode's own tab set. The amber active tint (vs. the plain
 * text tint in Player Mode) is the at-a-glance cue for which mode you're in.
 */
export default function SkTabLayout() {
  const { isDark } = useTheme();
  const screenOptions = useTabScreenOptions(isDark ? palette.bulb : palette.bulbDeep);
  return (
    <Tabs screenOptions={screenOptions}>
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
