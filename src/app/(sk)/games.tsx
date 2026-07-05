import { useRouter } from 'expo-router';
import { useMemo } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { EmptyState } from '@/components/EmptyState';
import { Screen } from '@/components/Screen';
import { Body, Display, Eyebrow, Mono } from '@/components/typography';
import type { SkGame } from '@/db/schema';
import { gameResult } from '@/domain/skGame';
import { formatDate, gameTitle } from '@/lib/format';
import { useActiveSkTeamId, useSkAllInningRuns, useSkTeamGames, useSkTeams } from '@/hooks/useSkData';
import { radius, spacing } from '@/theme/tokens';
import { useTheme } from '@/theme/useTheme';

/** Every scorekept game for the active team, newest first. */
export default function SkGames() {
  const teams = useSkTeams();
  const activeTeamId = useActiveSkTeamId();
  const team =
    teams === undefined || activeTeamId === undefined
      ? undefined
      : (teams.find((t) => t.id === activeTeamId) ?? teams[0]);

  const games = useSkTeamGames(team?.id);
  const allRuns = useSkAllInningRuns(team?.id);

  const scoreByGame = useMemo(() => {
    const totals = new Map<string, { us: number; them: number }>();
    for (const row of allRuns ?? []) {
      const t = totals.get(row.gameId) ?? { us: 0, them: 0 };
      t.us += row.runsUs;
      t.them += row.runsThem;
      totals.set(row.gameId, t);
    }
    return totals;
  }, [allRuns]);

  return (
    <Screen>
      <View style={{ paddingVertical: spacing.s }}>
        <Eyebrow>Scorekeeper</Eyebrow>
        <Display size={32}>Games</Display>
      </View>

      {games === undefined ? null : games.length === 0 ? (
        <EmptyState
          icon="📋"
          title="No games yet"
          message="Start a game from the Team tab and the box score will show up here."
        />
      ) : (
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ gap: spacing.s, paddingBottom: spacing.xxl }}
        >
          {games.map((game) => (
            <SkGameRow
              key={game.id}
              game={game}
              score={scoreByGame.get(game.id) ?? { us: 0, them: 0 }}
            />
          ))}
        </ScrollView>
      )}
    </Screen>
  );
}

function SkGameRow({ game, score }: { game: SkGame; score: { us: number; them: number } }) {
  const { colors } = useTheme();
  const router = useRouter();
  const open = game.endedAt === null;
  const result = gameResult(score.us, score.them);
  const resultColor =
    result === 'W' ? colors.group.hit.fg : result === 'L' ? colors.group.out.fg : colors.textSoft;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${gameTitle(game)}, ${open ? 'live' : `final ${score.us} to ${score.them}`}`}
      onPress={() =>
        router.push(
          open
            ? { pathname: '/sk-game/[id]', params: { id: game.id } }
            : { pathname: '/sk-game/[id]/summary', params: { id: game.id } },
        )
      }
      style={({ pressed }) => [
        styles.row,
        { backgroundColor: pressed ? colors.line : colors.card, borderColor: colors.line },
      ]}
    >
      <View style={{ flex: 1, gap: 2 }}>
        <Body size={16}>{gameTitle(game)}</Body>
        <Body size={12} color={colors.textSoft}>
          {formatDate(game.playedOn)}
        </Body>
      </View>
      <Mono size={16}>{`${score.us}–${score.them}`}</Mono>
      {open ? (
        <Eyebrow size={11} color={colors.group.onBase.fg}>
          Live
        </Eyebrow>
      ) : (
        <Eyebrow size={11} color={resultColor}>
          {result}
        </Eyebrow>
      )}
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
});
