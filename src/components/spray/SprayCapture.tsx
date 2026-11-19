import * as Haptics from 'expo-haptics';
import { useState } from 'react';
import {
  Platform,
  Pressable,
  View,
  type GestureResponderEvent,
  type LayoutRectangle,
} from 'react-native';

import { BigButton } from '@/components/BigButton';
import { Sheet } from '@/components/Sheet';
import { Body, Display, Eyebrow } from '@/components/typography';
import { OUTCOME_SPECS, type OutcomeCode } from '@/domain/outcomes';
import { spacing } from '@/theme/tokens';
import { useTheme } from '@/theme/useTheme';

import { SprayField } from './SprayField';

const clamp01 = (n: number) => Math.min(1, Math.max(0, n));

/**
 * Where on the field the tap landed, as 0..1 fractions of the diagram.
 *
 * On the web, react-native-web hands onPress the browser's click event,
 * which has no locationX/locationY (those exist only on native), so the old
 * maths gave NaN and no location was ever saved. There the click's position
 * is measured against the field's own box instead.
 */
export function tapFraction(
  e: GestureResponderEvent,
  layout: LayoutRectangle | null,
): { x: number; y: number } | null {
  const ne = e.nativeEvent as unknown as {
    locationX?: number;
    locationY?: number;
    clientX?: number;
    clientY?: number;
  };
  let x: number | undefined;
  let y: number | undefined;
  if (Platform.OS === 'web') {
    const rect = (e.currentTarget as unknown as Element | null)?.getBoundingClientRect?.();
    if (!rect || rect.width === 0 || rect.height === 0) return null;
    if (typeof ne.clientX !== 'number' || typeof ne.clientY !== 'number') return null;
    x = (ne.clientX - rect.left) / rect.width;
    y = (ne.clientY - rect.top) / rect.height;
  } else {
    if (!layout || layout.width === 0 || layout.height === 0) return null;
    if (typeof ne.locationX !== 'number' || typeof ne.locationY !== 'number') return null;
    x = ne.locationX / layout.width;
    y = ne.locationY / layout.height;
  }
  if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
  return { x: clamp01(x), y: clamp01(y) };
}

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
    <Sheet
      visible={outcome !== null}
      onClose={onSkip}
      closeLabel="Skip location"
      animationType="fade"
      maxHeight="92%"
    >
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
              const at = tapFraction(e, layout);
              if (!at) return;
              void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              onPlace(at.x, at.y);
            }}
            style={Platform.OS === 'web' ? ({ cursor: 'crosshair' } as object) : undefined}
          >
            <View pointerEvents="none">
              <SprayField points={[]} />
            </View>
          </Pressable>
          <BigButton label="Skip" variant="secondary" onPress={onSkip} />
        </View>
      )}
    </Sheet>
  );
}
