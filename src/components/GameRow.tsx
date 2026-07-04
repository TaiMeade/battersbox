import { useRouter } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Body, Mono } from '@/components/typography';
import type { Game } from '@/db/schema';
import type { OutcomeCode } from '@/domain/outcomes';
import { gameLine } from '@/domain/stats';
import { formatDate, gameTitle } from '@/lib/format';
import { fonts, radius, spacing } from '@/theme/tokens';
import { useTheme } from '@/theme/useTheme';

/** One game in a list: who/when on the left, the announcer's line on the right. */
export function GameRow({ game, outcomes }: { game: Game; outcomes: OutcomeCode[] }) {
  const { colors } = useTheme();
  const router = useRouter();
  const open = game.endedAt === null;

  return (
    <Pressable
      accessibilityRole="button"
      onPress={() =>
        open
          ? router.push({ pathname: '/game/[id]', params: { id: game.id } })
          : router.push({ pathname: '/game/[id]/summary', params: { id: game.id } })
      }
      style={({ pressed }) => [
        styles.row,
        {
          backgroundColor: pressed ? colors.line : colors.card,
          borderColor: colors.line,
        },
      ]}
    >
      <View style={{ flex: 1, gap: 2 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.s }}>
          <Body size={16} style={{ fontFamily: fonts.bodySemiBold }} numberOfLines={1}>
            {gameTitle(game)}
          </Body>
          {open && (
            <View style={[styles.liveBadge, { backgroundColor: colors.primary }]}>
              <Text style={[styles.liveText, { color: colors.primaryText }]}>Live</Text>
            </View>
          )}
        </View>
        {game.opponent !== null && (
          <Body size={13} color={colors.textSoft}>
            {formatDate(game.playedOn)}
          </Body>
        )}
      </View>
      <Mono size={15} color={outcomes.length > 0 ? colors.text : colors.textSoft}>
        {outcomes.length > 0 ? gameLine(outcomes) : 'no ABs'}
      </Mono>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.m,
    borderRadius: radius.m,
    borderWidth: 1,
    paddingVertical: spacing.m,
    paddingHorizontal: spacing.l,
  },
  liveBadge: {
    borderRadius: radius.s,
    paddingHorizontal: spacing.s,
    paddingVertical: 2,
  },
  liveText: {
    fontFamily: fonts.displayBold,
    fontSize: 11,
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
});
