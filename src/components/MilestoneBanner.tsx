import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import * as Haptics from 'expo-haptics';
import { useEffect, useRef } from 'react';
import { Animated, Easing, Pressable, StyleSheet, Text } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import type { Milestone } from '@/domain/milestones';
import { fonts, palette, radius, spacing } from '@/theme/tokens';

/**
 * The celebration strip: slides down from the top when a milestone lands,
 * lingers four seconds, and leaves. Scoreboard-constant colors, like the
 * panel it echoes — a milestone looks the same day or night.
 */
export function MilestoneBanner({
  milestone,
  onDismiss,
}: {
  milestone: Milestone | null;
  onDismiss: () => void;
}) {
  const insets = useSafeAreaInsets();
  const slide = useRef(new Animated.Value(0)).current; // 0 = hidden, 1 = shown

  const hide = () => {
    Animated.timing(slide, {
      toValue: 0,
      duration: 220,
      easing: Easing.in(Easing.cubic),
      useNativeDriver: true,
    }).start(({ finished }) => {
      if (finished) onDismiss();
    });
  };

  useEffect(() => {
    if (!milestone) return;
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    slide.setValue(0);
    Animated.spring(slide, {
      toValue: 1,
      damping: 14,
      stiffness: 160,
      useNativeDriver: true,
    }).start();
    const timer = setTimeout(hide, 4000);
    return () => clearTimeout(timer);
    // Re-run only for a new milestone, not when the parent re-renders.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [milestone]);

  if (!milestone) return null;

  const translateY = slide.interpolate({ inputRange: [0, 1], outputRange: [-90, 0] });

  return (
    <Animated.View
      pointerEvents="box-none"
      style={[
        styles.wrap,
        { top: insets.top + spacing.s, opacity: slide, transform: [{ translateY }] },
      ]}
    >
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Milestone: ${milestone.title}. Tap to dismiss.`}
        onPress={hide}
        style={styles.banner}
      >
        <MaterialCommunityIcons name="star-four-points" size={20} color={palette.bulb} />
        <Text numberOfLines={2} style={styles.title}>
          {milestone.title}
        </Text>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    left: spacing.l,
    right: spacing.l,
    zIndex: 20,
  },
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.m,
    backgroundColor: palette.monster,
    borderColor: palette.monsterEdge,
    borderWidth: 1,
    borderRadius: radius.m,
    paddingVertical: spacing.m,
    paddingHorizontal: spacing.l,
    shadowColor: '#000',
    shadowOpacity: 0.25,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 8,
  },
  title: {
    flex: 1,
    fontFamily: fonts.displayBold,
    fontSize: 16,
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    color: palette.chalk,
  },
});
