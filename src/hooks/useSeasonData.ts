import { desc, eq } from 'drizzle-orm';
import { useLiveQuery } from 'drizzle-orm/expo-sqlite';

import { db } from '@/db/client';
import { games, plateAppearances, seasons, type Game, type Season } from '@/db/schema';
import { isOutcomeCode, type OutcomeCode } from '@/domain/outcomes';

/**
 * The season currently being tracked. `loading` distinguishes "not yet read"
 * from "none". NOTE: drizzle's useLiveQuery initializes `data` to [] (not
 * undefined) — `updatedAt === undefined` is the only reliable loading signal.
 */
export function useActiveSeason(): { season: Season | undefined; loading: boolean } {
  const { data, updatedAt } = useLiveQuery(
    db.select().from(seasons).where(eq(seasons.isActive, true)).limit(1),
  );
  return { season: data?.[0], loading: updatedAt === undefined };
}

export function useSeasons(): Season[] {
  const { data } = useLiveQuery(db.select().from(seasons).orderBy(desc(seasons.createdAt)));
  return data ?? [];
}

/** All games in a season, newest first. `undefined` = first read hasn't landed yet. */
export function useSeasonGames(seasonId: string | undefined): Game[] | undefined {
  const { data, updatedAt } = useLiveQuery(
    db
      .select()
      .from(games)
      .where(eq(games.seasonId, seasonId ?? ''))
      .orderBy(desc(games.playedOn), desc(games.createdAt)),
    [seasonId],
  );
  if (!seasonId) return [];
  return updatedAt === undefined ? undefined : data;
}

export interface SeasonPARow {
  gameId: string;
  outcome: OutcomeCode;
}

/** Every PA in a season (joined through games), for stats + grouping. */
export function useSeasonPAs(seasonId: string | undefined): SeasonPARow[] | undefined {
  const { data, updatedAt } = useLiveQuery(
    db
      .select({ gameId: plateAppearances.gameId, outcome: plateAppearances.outcome })
      .from(plateAppearances)
      .innerJoin(games, eq(plateAppearances.gameId, games.id))
      .where(eq(games.seasonId, seasonId ?? ''))
      .orderBy(plateAppearances.seq),
    [seasonId],
  );
  if (!seasonId) return [];
  if (updatedAt === undefined) return undefined;
  return data.filter((row): row is SeasonPARow => isOutcomeCode(row.outcome));
}

/** Every PA ever logged — the career line. */
export function useCareerOutcomes(): OutcomeCode[] | undefined {
  const { data, updatedAt } = useLiveQuery(
    db.select({ outcome: plateAppearances.outcome }).from(plateAppearances),
  );
  if (updatedAt === undefined) return undefined;
  return data.map((r) => r.outcome).filter(isOutcomeCode);
}

export function groupOutcomesByGame(rows: SeasonPARow[]): Map<string, OutcomeCode[]> {
  const byGame = new Map<string, OutcomeCode[]>();
  for (const row of rows) {
    const list = byGame.get(row.gameId);
    if (list) list.push(row.outcome);
    else byGame.set(row.gameId, [row.outcome]);
  }
  return byGame;
}
