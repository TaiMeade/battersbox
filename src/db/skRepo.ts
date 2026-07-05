import { randomUUID } from 'expo-crypto';
import { and, asc, desc, eq, isNull, sql } from 'drizzle-orm';

import { db } from './client';
import { getSetting, setSetting, todayISO } from './repo';
import {
  skGames,
  skInningRuns,
  skLineupSlots,
  skPlateAppearances,
  skPlayers,
  skTeams,
  type SkGame,
  type SkLineupSlot,
  type SkPlateAppearance,
  type SkPlayer,
  type SkTeam,
} from './schema';
import type { OutcomeCode } from '@/domain/outcomes';

/**
 * Scorekeeper Mode data access. Deliberately its own module over its own
 * sk_* tables: nothing in here reads or writes the player-mode tables, so
 * team scorekeeping can never contaminate the individual stat line.
 *
 * Invariant: players and lineup slots with plate appearances are archived /
 * scratched, never deleted — so sk_plate_appearances FKs never dangle.
 */

const now = () => Date.now();

const MODE_KEY = 'app.mode';
const ACTIVE_TEAM_KEY = 'sk.activeTeam';

export type AppMode = 'player' | 'scorekeeper';

export async function getAppMode(): Promise<AppMode> {
  return (await getSetting(MODE_KEY)) === 'scorekeeper' ? 'scorekeeper' : 'player';
}

export async function setAppMode(mode: AppMode): Promise<void> {
  await setSetting(MODE_KEY, mode);
}

// ---------------------------------------------------------------- teams

export async function createSkTeam(name: string): Promise<SkTeam> {
  const team: SkTeam = {
    id: randomUUID(),
    name: name.trim() || 'My Team',
    createdAt: now(),
  };
  await db.insert(skTeams).values(team);
  await setSetting(ACTIVE_TEAM_KEY, team.id);
  return team;
}

/** Blank names are ignored rather than clobbering the current one. */
export async function renameSkTeam(id: string, name: string): Promise<void> {
  const trimmed = name.trim();
  if (!trimmed) return;
  await db.update(skTeams).set({ name: trimmed }).where(eq(skTeams.id, id));
}

export async function setActiveSkTeam(id: string): Promise<void> {
  await setSetting(ACTIVE_TEAM_KEY, id);
}

export async function getActiveSkTeamId(): Promise<string | undefined> {
  const id = await getSetting(ACTIVE_TEAM_KEY);
  return id || undefined;
}

/** Deletes a team and everything in it. Points the active team at the newest remaining one. */
export async function deleteSkTeam(id: string): Promise<void> {
  const teamGames = await db.select({ id: skGames.id }).from(skGames).where(eq(skGames.teamId, id));
  for (const g of teamGames) {
    await db.delete(skPlateAppearances).where(eq(skPlateAppearances.gameId, g.id));
    await db.delete(skInningRuns).where(eq(skInningRuns.gameId, g.id));
    await db.delete(skLineupSlots).where(eq(skLineupSlots.gameId, g.id));
  }
  await db.delete(skGames).where(eq(skGames.teamId, id));
  await db.delete(skPlayers).where(eq(skPlayers.teamId, id));
  await db.delete(skTeams).where(eq(skTeams.id, id));

  if ((await getSetting(ACTIVE_TEAM_KEY)) === id) {
    const remaining = await db.select().from(skTeams).orderBy(desc(skTeams.createdAt)).limit(1);
    await setSetting(ACTIVE_TEAM_KEY, remaining[0]?.id ?? '');
  }
}

// ---------------------------------------------------------------- roster

export async function addRosterPlayer(
  teamId: string,
  name: string,
  number?: string,
): Promise<SkPlayer> {
  const [{ maxOrder }] = await db
    .select({ maxOrder: sql<number>`coalesce(max(${skPlayers.rosterOrder}), 0)` })
    .from(skPlayers)
    .where(eq(skPlayers.teamId, teamId));

  const player: SkPlayer = {
    id: randomUUID(),
    teamId,
    name: name.trim() || 'Player',
    number: number?.trim() || null,
    rosterOrder: maxOrder + 1,
    archivedAt: null,
    createdAt: now(),
  };
  await db.insert(skPlayers).values(player);
  return player;
}

export async function updateRosterPlayer(
  id: string,
  fields: { name?: string; number?: string | null },
): Promise<void> {
  const set: Partial<SkPlayer> = {};
  if (fields.name !== undefined && fields.name.trim()) set.name = fields.name.trim();
  if (fields.number !== undefined) set.number = fields.number?.trim() || null;
  if (Object.keys(set).length === 0) return;
  await db.update(skPlayers).set(set).where(eq(skPlayers.id, id));
}

/** Swaps a player with their neighbor in the (non-archived) roster order. */
export async function moveRosterPlayer(
  teamId: string,
  playerId: string,
  dir: -1 | 1,
): Promise<void> {
  const roster = await db
    .select()
    .from(skPlayers)
    .where(and(eq(skPlayers.teamId, teamId), isNull(skPlayers.archivedAt)))
    .orderBy(asc(skPlayers.rosterOrder));
  const index = roster.findIndex((p) => p.id === playerId);
  const neighbor = roster[index + dir];
  if (index === -1 || !neighbor) return;
  const current = roster[index];
  await db
    .update(skPlayers)
    .set({ rosterOrder: neighbor.rosterOrder })
    .where(eq(skPlayers.id, current.id));
  await db
    .update(skPlayers)
    .set({ rosterOrder: current.rosterOrder })
    .where(eq(skPlayers.id, neighbor.id));
}

export async function archiveRosterPlayer(id: string): Promise<void> {
  await db.update(skPlayers).set({ archivedAt: now() }).where(eq(skPlayers.id, id));
}

export async function unarchiveRosterPlayer(id: string): Promise<void> {
  await db.update(skPlayers).set({ archivedAt: null }).where(eq(skPlayers.id, id));
}

/**
 * Hard-deletes only a player with no history (no PAs, no lineup slots);
 * otherwise archives so their stats survive. Returns which happened.
 */
export async function removeRosterPlayer(id: string): Promise<'deleted' | 'archived'> {
  const [pa] = await db
    .select({ id: skPlateAppearances.id })
    .from(skPlateAppearances)
    .where(eq(skPlateAppearances.playerId, id))
    .limit(1);
  const [slot] = await db
    .select({ id: skLineupSlots.id })
    .from(skLineupSlots)
    .where(eq(skLineupSlots.playerId, id))
    .limit(1);
  if (pa || slot) {
    await archiveRosterPlayer(id);
    return 'archived';
  }
  await db.delete(skPlayers).where(eq(skPlayers.id, id));
  return 'deleted';
}

// ---------------------------------------------------------------- games

export async function getOpenSkGame(teamId: string): Promise<SkGame | undefined> {
  const rows = await db
    .select()
    .from(skGames)
    .where(and(eq(skGames.teamId, teamId), isNull(skGames.endedAt)))
    .orderBy(desc(skGames.createdAt))
    .limit(1);
  return rows[0];
}

/** Starts a game and snapshots the active roster into the batting order. */
export async function startSkGame(teamId: string, opponent?: string): Promise<SkGame> {
  const game: SkGame = {
    id: randomUUID(),
    teamId,
    opponent: opponent?.trim() || null,
    playedOn: todayISO(),
    currentInning: 1,
    endedAt: null,
    createdAt: now(),
  };
  await db.insert(skGames).values(game);

  const roster = await db
    .select()
    .from(skPlayers)
    .where(and(eq(skPlayers.teamId, teamId), isNull(skPlayers.archivedAt)))
    .orderBy(asc(skPlayers.rosterOrder));
  if (roster.length > 0) {
    await db.insert(skLineupSlots).values(
      roster.map((player, i) => ({
        id: randomUUID(),
        gameId: game.id,
        playerId: player.id,
        battingOrder: i + 1,
        scratchedAt: null,
        createdAt: now(),
      })),
    );
  }
  return game;
}

export async function endSkGame(gameId: string): Promise<void> {
  await db.update(skGames).set({ endedAt: now() }).where(eq(skGames.id, gameId));
}

export async function reopenSkGame(gameId: string): Promise<void> {
  await db.update(skGames).set({ endedAt: null }).where(eq(skGames.id, gameId));
}

export async function setSkGameOpponent(gameId: string, opponent: string): Promise<void> {
  await db
    .update(skGames)
    .set({ opponent: opponent.trim() || null })
    .where(eq(skGames.id, gameId));
}

export async function setSkGameInning(gameId: string, inning: number): Promise<void> {
  await db
    .update(skGames)
    .set({ currentInning: Math.max(1, Math.round(inning)) })
    .where(eq(skGames.id, gameId));
}

export async function deleteSkGame(gameId: string): Promise<void> {
  await db.delete(skPlateAppearances).where(eq(skPlateAppearances.gameId, gameId));
  await db.delete(skInningRuns).where(eq(skInningRuns.gameId, gameId));
  await db.delete(skLineupSlots).where(eq(skLineupSlots.gameId, gameId));
  await db.delete(skGames).where(eq(skGames.id, gameId));
}

// ---------------------------------------------------------------- lineup

export async function addLineupSlot(gameId: string, playerId: string): Promise<SkLineupSlot> {
  const [{ maxOrder }] = await db
    .select({ maxOrder: sql<number>`coalesce(max(${skLineupSlots.battingOrder}), 0)` })
    .from(skLineupSlots)
    .where(eq(skLineupSlots.gameId, gameId));

  const slot: SkLineupSlot = {
    id: randomUUID(),
    gameId,
    playerId,
    battingOrder: maxOrder + 1,
    scratchedAt: null,
    createdAt: now(),
  };
  await db.insert(skLineupSlots).values(slot);
  return slot;
}

/** Mid-game walk-up: adds a brand-new roster player AND bats them last. */
export async function addNewPlayerToLineup(
  gameId: string,
  teamId: string,
  name: string,
  number?: string,
): Promise<SkLineupSlot> {
  const player = await addRosterPlayer(teamId, name, number);
  return addLineupSlot(gameId, player.id);
}

/** Swaps a slot with its neighbor in the batting order (scratched rows included). */
export async function moveLineupSlot(gameId: string, slotId: string, dir: -1 | 1): Promise<void> {
  const slots = await db
    .select()
    .from(skLineupSlots)
    .where(eq(skLineupSlots.gameId, gameId))
    .orderBy(asc(skLineupSlots.battingOrder));
  const index = slots.findIndex((s) => s.id === slotId);
  const neighbor = slots[index + dir];
  if (index === -1 || !neighbor) return;
  const current = slots[index];
  await db
    .update(skLineupSlots)
    .set({ battingOrder: neighbor.battingOrder })
    .where(eq(skLineupSlots.id, current.id));
  await db
    .update(skLineupSlots)
    .set({ battingOrder: current.battingOrder })
    .where(eq(skLineupSlots.id, neighbor.id));
}

export async function scratchLineupSlot(slotId: string): Promise<void> {
  await db.update(skLineupSlots).set({ scratchedAt: now() }).where(eq(skLineupSlots.id, slotId));
}

export async function unscratchLineupSlot(slotId: string): Promise<void> {
  await db.update(skLineupSlots).set({ scratchedAt: null }).where(eq(skLineupSlots.id, slotId));
}

/**
 * Deletes a slot that never batted; scratches one that did (their PAs must
 * stay in the box score). Returns which happened. Batting order is
 * renumbered 1..N after a delete so slot numbers stay gapless.
 */
export async function removeLineupSlot(slotId: string): Promise<'deleted' | 'scratched'> {
  const [pa] = await db
    .select({ id: skPlateAppearances.id })
    .from(skPlateAppearances)
    .where(eq(skPlateAppearances.lineupSlotId, slotId))
    .limit(1);
  if (pa) {
    await scratchLineupSlot(slotId);
    return 'scratched';
  }

  const [slot] = await db.select().from(skLineupSlots).where(eq(skLineupSlots.id, slotId));
  await db.delete(skLineupSlots).where(eq(skLineupSlots.id, slotId));
  if (slot) {
    const rest = await db
      .select()
      .from(skLineupSlots)
      .where(eq(skLineupSlots.gameId, slot.gameId))
      .orderBy(asc(skLineupSlots.battingOrder));
    for (let i = 0; i < rest.length; i += 1) {
      if (rest[i].battingOrder !== i + 1) {
        await db
          .update(skLineupSlots)
          .set({ battingOrder: i + 1 })
          .where(eq(skLineupSlots.id, rest[i].id));
      }
    }
  }
  return 'deleted';
}

// ---------------------------------------------------------------- plate appearances

/** Logs an at-bat for a lineup slot. The inning is read fresh from the game row. */
export async function logSkPA(
  gameId: string,
  slotId: string,
  playerId: string,
  outcome: OutcomeCode,
): Promise<SkPlateAppearance> {
  const [game] = await db.select().from(skGames).where(eq(skGames.id, gameId)).limit(1);
  const [{ maxSeq }] = await db
    .select({ maxSeq: sql<number>`coalesce(max(${skPlateAppearances.seq}), 0)` })
    .from(skPlateAppearances)
    .where(eq(skPlateAppearances.gameId, gameId));

  const pa: SkPlateAppearance = {
    id: randomUUID(),
    gameId,
    playerId,
    lineupSlotId: slotId,
    outcome,
    inning: game?.currentInning ?? 1,
    seq: maxSeq + 1,
    createdAt: now(),
  };
  await db.insert(skPlateAppearances).values(pa);
  return pa;
}

export async function undoSkPA(paId: string): Promise<void> {
  await db.delete(skPlateAppearances).where(eq(skPlateAppearances.id, paId));
}

export async function updateSkPAOutcome(paId: string, outcome: OutcomeCode): Promise<void> {
  await db.update(skPlateAppearances).set({ outcome }).where(eq(skPlateAppearances.id, paId));
}

// ---------------------------------------------------------------- inning runs

/** Nudges an inning's run total up or down (never below zero). Upserts the row. */
export async function bumpInningRuns(
  gameId: string,
  inning: number,
  side: 'us' | 'them',
  delta: 1 | -1,
): Promise<void> {
  const initial = Math.max(0, delta);
  await db
    .insert(skInningRuns)
    .values({
      id: randomUUID(),
      gameId,
      inning,
      runsUs: side === 'us' ? initial : 0,
      runsThem: side === 'them' ? initial : 0,
    })
    .onConflictDoUpdate({
      target: [skInningRuns.gameId, skInningRuns.inning],
      set:
        side === 'us'
          ? { runsUs: sql`max(0, ${skInningRuns.runsUs} + ${delta})` }
          : { runsThem: sql`max(0, ${skInningRuns.runsThem} + ${delta})` },
    });
}
