import { StyleSheet, Text, View } from 'react-native';

import { Body, Display } from '@/components/typography';
import { spacing } from '@/theme/tokens';
import { useTheme } from '@/theme/useTheme';

/** An empty screen is an invitation to act. */
export function EmptyState({
  icon,
  title,
  message,
}: {
  icon: string;
  title: string;
  message: string;
}) {
  const { colors } = useTheme();
  return (
    <View style={styles.wrap}>
      <Text style={styles.icon}>{icon}</Text>
      <Display size={24}>{title}</Display>
      <Body color={colors.textSoft} style={{ textAlign: 'center', lineHeight: 22 }}>
        {message}
      </Body>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.m,
    paddingHorizontal: spacing.xxl,
    paddingBottom: spacing.xxl,
  },
  icon: { fontSize: 44 },
});
