import { asc, eq } from 'drizzle-orm';

import { db } from '@/db/client';
import { games, plateAppearances } from '@/db/schema';
import { milestonesForLastPA, type Milestone } from '@/domain/milestones';
import { isOutcomeCode, type OutcomeCode } from '@/domain/outcomes';

/**
 * The top milestone unlocked by the PA that was just logged, if any.
 * Reads the DB directly — live queries can lag a render behind, and this
 * must see the write that just happened.
 */
export async function milestoneAfterPA(seasonId: string, gameId: string): Promise<Milestone | null> {
  const careerRows = await db
    .select({ outcome: plateAppearances.outcome })
    .from(plateAppearances);
  const seasonRows = await db
    .select({ gameId: plateAppearances.gameId, outcome: plateAppearances.outcome })
    .from(plateAppearances)
    .innerJoin(games, eq(plateAppearances.gameId, games.id))
    .where(eq(games.seasonId, seasonId))
    .orderBy(asc(games.playedOn), asc(games.createdAt), asc(plateAppearances.seq));

  const byGame = new Map<string, OutcomeCode[]>();
  for (const row of seasonRows) {
    if (!isOutcomeCode(row.outcome)) continue;
    const list = byGame.get(row.gameId);
    if (list) list.push(row.outcome);
    else byGame.set(row.gameId, [row.outcome]);
  }

  // The game being logged must sit last even if a reopened game is being
  // backfilled while a newer one exists — the detector reads the last
  // outcome of the last game as "just logged".
  const current = byGame.get(gameId);
  if (!current) return null;
  const seasonGames = [...byGame.keys()]
    .filter((id) => id !== gameId)
    .map((id) => byGame.get(id)!);
  seasonGames.push(current);

  const found = milestonesForLastPA({
    careerOutcomes: careerRows.map((r) => r.outcome).filter(isOutcomeCode),
    seasonGames,
  });
  return found[0] ?? null;
}
