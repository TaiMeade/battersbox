import { asc, desc, eq } from 'drizzle-orm';
import { useLiveQuery } from 'drizzle-orm/expo-sqlite';

import { db } from '@/db/client';
import {
  settings,
  skGames,
  skInningRuns,
  skLineupSlots,
  skPlateAppearances,
  skPlayers,
  skTeams,
  type SkGame,
  type SkInningRun,
  type SkPlateAppearance,
  type SkPlayer,
  type SkTeam,
} from '@/db/schema';
import { isOutcomeCode, type OutcomeCode } from '@/domain/outcomes';

/**
 * Scorekeeper Mode live queries. Same rule as useSeasonData: drizzle's
 * useLiveQuery initializes `data` to [] (not undefined), so
 * `updatedAt === undefined` is the only reliable loading signal — hooks
 * return undefined until the first read lands.
 */

export function useSkTeams(): SkTeam[] | undefined {
  const { data, updatedAt } = useLiveQuery(
    db.select().from(skTeams).orderBy(desc(skTeams.createdAt)),
  );
  return updatedAt === undefined ? undefined : data;
}

/** Active team id. undefined = still loading; null = loaded, none set. */
export function useActiveSkTeamId(): string | null | undefined {
  const { data, updatedAt } = useLiveQuery(
    db.select().from(settings).where(eq(settings.key, 'sk.activeTeam')),
  );
  if (updatedAt === undefined) return undefined;
  return data[0]?.value || null;
}

/** Full roster (archived included — callers split on archivedAt), roster order. */
export function useSkRoster(teamId: string | undefined): SkPlayer[] | undefined {
  const { data, updatedAt } = useLiveQuery(
    db
      .select()
      .from(skPlayers)
      .where(eq(skPlayers.teamId, teamId ?? ''))
      .orderBy(asc(skPlayers.rosterOrder)),
    [teamId],
  );
  if (!teamId) return [];
  return updatedAt === undefined ? undefined : data;
}

export function useSkTeamGames(teamId: string | undefined): SkGame[] | undefined {
  const { data, updatedAt } = useLiveQuery(
    db
      .select()
      .from(skGames)
      .where(eq(skGames.teamId, teamId ?? ''))
      .orderBy(desc(skGames.playedOn), desc(skGames.createdAt)),
    [teamId],
  );
  if (!teamId) return [];
  return updatedAt === undefined ? undefined : data;
}

export function useSkGame(gameId: string | undefined): {
  game: SkGame | undefined;
  loading: boolean;
} {
  const { data, updatedAt } = useLiveQuery(
    db
      .select()
      .from(skGames)
      .where(eq(skGames.id, gameId ?? '')),
    [gameId],
  );
  return { game: data?.[0], loading: updatedAt === undefined };
}

export interface SkLineupRow {
  id: string;
  gameId: string;
  playerId: string;
  battingOrder: number;
  scratchedAt: number | null;
  playerName: string;
  playerNumber: string | null;
}

/** The game's batting order joined with player names, scratched rows included. */
export function useSkLineup(gameId: string | undefined): SkLineupRow[] | undefined {
  const { data, updatedAt } = useLiveQuery(
    db
      .select({
        id: skLineupSlots.id,
        gameId: skLineupSlots.gameId,
        playerId: skLineupSlots.playerId,
        battingOrder: skLineupSlots.battingOrder,
        scratchedAt: skLineupSlots.scratchedAt,
        playerName: skPlayers.name,
        playerNumber: skPlayers.number,
      })
      .from(skLineupSlots)
      .innerJoin(skPlayers, eq(skLineupSlots.playerId, skPlayers.id))
      .where(eq(skLineupSlots.gameId, gameId ?? ''))
      .orderBy(asc(skLineupSlots.battingOrder)),
    [gameId],
  );
  if (!gameId) return [];
  return updatedAt === undefined ? undefined : data;
}

export function useSkGamePAs(gameId: string | undefined): SkPlateAppearance[] | undefined {
  const { data, updatedAt } = useLiveQuery(
    db
      .select()
      .from(skPlateAppearances)
      .where(eq(skPlateAppearances.gameId, gameId ?? ''))
      .orderBy(asc(skPlateAppearances.seq)),
    [gameId],
  );
  if (!gameId) return [];
  return updatedAt === undefined ? undefined : data;
}

export function useSkInningRuns(gameId: string | undefined): SkInningRun[] | undefined {
  const { data, updatedAt } = useLiveQuery(
    db
      .select()
      .from(skInningRuns)
      .where(eq(skInningRuns.gameId, gameId ?? ''))
      .orderBy(asc(skInningRuns.inning)),
    [gameId],
  );
  if (!gameId) return [];
  return updatedAt === undefined ? undefined : data;
}

export interface SkTeamPARow {
  gameId: string;
  playerId: string;
  outcome: OutcomeCode;
}

/** Every PA across the team's games (for cumulative per-player lines). */
export function useSkTeamPAs(teamId: string | undefined): SkTeamPARow[] | undefined {
  const { data, updatedAt } = useLiveQuery(
    db
      .select({
        gameId: skPlateAppearances.gameId,
        playerId: skPlateAppearances.playerId,
        outcome: skPlateAppearances.outcome,
      })
      .from(skPlateAppearances)
      .innerJoin(skGames, eq(skPlateAppearances.gameId, skGames.id))
      .where(eq(skGames.teamId, teamId ?? ''))
      .orderBy(asc(skPlateAppearances.seq)),
    [teamId],
  );
  if (!teamId) return [];
  if (updatedAt === undefined) return undefined;
  return data.filter((row): row is SkTeamPARow => isOutcomeCode(row.outcome));
}

export interface SkTeamRunsRow {
  gameId: string;
  inning: number;
  runsUs: number;
  runsThem: number;
  endedAt: number | null;
}

/** All inning runs across the team's games (for the W-L record and final scores). */
export function useSkAllInningRuns(teamId: string | undefined): SkTeamRunsRow[] | undefined {
  const { data, updatedAt } = useLiveQuery(
    db
      .select({
        gameId: skInningRuns.gameId,
        inning: skInningRuns.inning,
        runsUs: skInningRuns.runsUs,
        runsThem: skInningRuns.runsThem,
        endedAt: skGames.endedAt,
      })
      .from(skInningRuns)
      .innerJoin(skGames, eq(skInningRuns.gameId, skGames.id))
      .where(eq(skGames.teamId, teamId ?? '')),
    [teamId],
  );
  if (!teamId) return [];
  return updatedAt === undefined ? undefined : data;
}
