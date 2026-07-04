import { asc, eq } from 'drizzle-orm';
import { useLiveQuery } from 'drizzle-orm/expo-sqlite';
import { useMemo } from 'react';

import { db } from '@/db/client';
import { games, plateAppearances, seasons, settings } from '@/db/schema';
import type { CardGameFacts } from '@/domain/cardFacts';
import { isOutcomeCode, type OutcomeCode } from '@/domain/outcomes';
import { CARD_KEYS } from '@/lib/cardProfile';

export interface CardProfile {
  loading: boolean;
  photoUri: string | null;
  team: string;
  position: string;
  number: string;
}

export function useCardProfile(): CardProfile {
  const { data, updatedAt } = useLiveQuery(db.select().from(settings));
  const kv = new Map((data ?? []).map((row) => [row.key, row.value]));
  return {
    loading: updatedAt === undefined,
    photoUri: kv.get(CARD_KEYS.photo) || null,
    team: kv.get(CARD_KEYS.team) ?? '',
    position: kv.get(CARD_KEYS.position) ?? '',
    number: kv.get(CARD_KEYS.number) ?? '',
  };
}

export interface CardSeasonLine {
  id: string;
  name: string;
  /** Games with at least one plate appearance — the card back's G column. */
  games: number;
  outcomes: OutcomeCode[];
}

export interface CardStats {
  seasonLines: CardSeasonLine[];
  gameFacts: CardGameFacts[];
}

/** The whole career, grouped for the card back. `undefined` while loading. */
export function useCardStats(): CardStats | undefined {
  const { data: seasonRows, updatedAt: seasonsAt } = useLiveQuery(
    db.select().from(seasons).orderBy(asc(seasons.createdAt)),
  );
  const { data: paRows, updatedAt: pasAt } = useLiveQuery(
    db
      .select({
        seasonId: games.seasonId,
        gameId: plateAppearances.gameId,
        opponent: games.opponent,
        playedOn: games.playedOn,
        outcome: plateAppearances.outcome,
      })
      .from(plateAppearances)
      .innerJoin(games, eq(plateAppearances.gameId, games.id))
      .orderBy(asc(games.playedOn), asc(games.createdAt), asc(plateAppearances.seq)),
  );

  return useMemo(() => {
    if (seasonsAt === undefined || pasAt === undefined) return undefined;

    const bySeason = new Map<string, { gameIds: Set<string>; outcomes: OutcomeCode[] }>();
    const byGame = new Map<string, CardGameFacts>();
    for (const row of paRows) {
      if (!isOutcomeCode(row.outcome)) continue;
      let seasonBucket = bySeason.get(row.seasonId);
      if (!seasonBucket) {
        seasonBucket = { gameIds: new Set(), outcomes: [] };
        bySeason.set(row.seasonId, seasonBucket);
      }
      seasonBucket.gameIds.add(row.gameId);
      seasonBucket.outcomes.push(row.outcome);

      let gameBucket = byGame.get(row.gameId);
      if (!gameBucket) {
        gameBucket = { opponent: row.opponent, playedOn: row.playedOn, outcomes: [] };
        byGame.set(row.gameId, gameBucket);
      }
      gameBucket.outcomes.push(row.outcome);
    }

    const seasonLines: CardSeasonLine[] = [];
    for (const season of seasonRows) {
      const bucket = bySeason.get(season.id);
      if (!bucket) continue; // a season without an at-bat doesn't earn a printed row
      seasonLines.push({
        id: season.id,
        name: season.name,
        games: bucket.gameIds.size,
        outcomes: bucket.outcomes,
      });
    }
    return { seasonLines, gameFacts: [...byGame.values()] };
  }, [seasonRows, paRows, seasonsAt, pasAt]);
}
