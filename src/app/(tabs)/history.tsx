import { useMemo, useState } from 'react';
import { ScrollView, View } from 'react-native';

import { Chips } from '@/components/Chips';
import { EmptyState } from '@/components/EmptyState';
import { GameRow } from '@/components/GameRow';
import { Screen } from '@/components/Screen';
import { Display } from '@/components/typography';
import {
  groupOutcomesByGame,
  useSeasonGames,
  useSeasonPAs,
  useSeasons,
} from '@/hooks/useSeasonData';
import { spacing } from '@/theme/tokens';

/** Every game, newest first, filterable by season. */
export default function History() {
  const seasons = useSeasons();
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const activeId = seasons.find((s) => s.isActive)?.id ?? seasons[0]?.id;
  const seasonId = selectedId ?? activeId;

  const games = useSeasonGames(seasonId);
  const paRows = useSeasonPAs(seasonId);
  const byGame = useMemo(() => groupOutcomesByGame(paRows ?? []), [paRows]);

  return (
    <Screen>
      <View style={{ paddingVertical: spacing.s, gap: spacing.m }}>
        <Display size={32}>Games</Display>
        {seasons.length > 1 && (
          <Chips
            options={seasons.map((s) => ({ key: s.id, label: s.name }))}
            value={seasonId ?? ''}
            onChange={setSelectedId}
          />
        )}
      </View>

      {games === undefined ? null : games.length === 0 ? (
        <EmptyState
          icon="📋"
          title="No games yet"
          message="Start a game from the Dashboard and it will show up here with its box-score line."
        />
      ) : (
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ gap: spacing.s, paddingBottom: spacing.xxl }}
        >
          {games.map((game) => (
            <GameRow key={game.id} game={game} outcomes={byGame.get(game.id) ?? []} />
          ))}
        </ScrollView>
      )}
    </Screen>
  );
}
