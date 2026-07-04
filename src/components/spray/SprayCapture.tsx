import * as Haptics from 'expo-haptics';
import { useState } from 'react';
import { Modal, Pressable, StyleSheet, View, type LayoutRectangle } from 'react-native';

import { BigButton } from '@/components/BigButton';
import { Body, Display, Eyebrow } from '@/components/typography';
import { OUTCOME_SPECS, type OutcomeCode } from '@/domain/outcomes';
import { radius, spacing } from '@/theme/tokens';
import { useTheme } from '@/theme/useTheme';

import { SprayField } from './SprayField';

/**
 * The optional one-extra-tap after a ball in play: tap the field to drop
 * the location, or skip (backdrop, button, or hardware back). The at-bat
 * is already saved before this appears — skipping costs nothing.
 */
export function SprayCapture({
  outcome,
  onPlace,
  onSkip,
}: {
  outcome: OutcomeCode | null;
  onPlace: (x: number, y: number) => void;
  onSkip: () => void;
}) {
  const { colors } = useTheme();
  const [layout, setLayout] = useState<LayoutRectangle | null>(null);

  return (
    <Modal visible={outcome !== null} transparent animationType="fade" onRequestClose={onSkip}>
      <Pressable style={styles.backdrop} onPress={onSkip} accessibilityLabel="Skip location" />
      <View style={[styles.sheet, { backgroundColor: colors.bg, borderColor: colors.line }]}>
        {outcome && (
          <View style={{ gap: spacing.l, padding: spacing.l }}>
            <View style={{ alignItems: 'center', gap: spacing.xs }}>
              <Eyebrow>{OUTCOME_SPECS[outcome].name} logged</Eyebrow>
              <Display size={22}>Where did it land?</Display>
              <Body size={13} color={colors.textSoft}>
                One tap on the field — or skip, it&apos;s optional.
              </Body>
            </View>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Field diagram — tap where the ball landed"
              onLayout={(e) => setLayout(e.nativeEvent.layout)}
              onPress={(e) => {
                if (!layout) return;
                const nx = Math.min(1, Math.max(0, e.nativeEvent.locationX / layout.width));
                const ny = Math.min(1, Math.max(0, e.nativeEvent.locationY / layout.height));
                void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                onPlace(nx, ny);
              }}
            >
              <View pointerEvents="none">
                <SprayField points={[]} />
              </View>
            </Pressable>
            <BigButton label="Skip" variant="secondary" onPress={onSkip} />
          </View>
        )}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  sheet: {
    borderTopLeftRadius: radius.l,
    borderTopRightRadius: radius.l,
    borderWidth: 1,
    paddingBottom: spacing.l,
  },
});
