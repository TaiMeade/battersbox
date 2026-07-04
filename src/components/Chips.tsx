import { Pressable, ScrollView, StyleSheet, Text } from 'react-native';

import { fonts, radius, spacing } from '@/theme/tokens';
import { useTheme } from '@/theme/useTheme';

export interface ChipOption<K extends string> {
  key: K;
  label: string;
}

/** Horizontal chip row for filters (seasons, season/career). */
export function Chips<K extends string>({
  options,
  value,
  onChange,
}: {
  options: ChipOption<K>[];
  value: K;
  onChange: (key: K) => void;
}) {
  const { colors } = useTheme();
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={{ gap: spacing.s }}
    >
      {options.map((option) => {
        const selected = option.key === value;
        return (
          <Pressable
            key={option.key}
            accessibilityRole="button"
            accessibilityState={{ selected }}
            onPress={() => onChange(option.key)}
            style={[
              styles.chip,
              {
                backgroundColor: selected ? colors.panel : 'transparent',
                borderColor: selected ? colors.panel : colors.line,
              },
            ]}
          >
            <Text
              style={{
                fontFamily: fonts.bodySemiBold,
                fontSize: 14,
                color: selected ? colors.panelText : colors.textSoft,
              }}
            >
              {option.label}
            </Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  chip: {
    borderRadius: radius.l,
    borderWidth: 1.5,
    paddingVertical: spacing.s,
    paddingHorizontal: spacing.l,
  },
});
