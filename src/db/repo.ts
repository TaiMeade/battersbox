import { randomUUID } from 'expo-crypto';
import { and, asc, desc, eq, isNull, sql } from 'drizzle-orm';

import { db } from './client';
import {
  games,
  plateAppearances,
  players,
  seasons,
  settings,
  type Game,
  type PlateAppearance,
  type Player,
  type Season,
  type Sport,
} from './schema';
import { OUTCOME_SPECS, type OutcomeCode } from '@/domain/outcomes';

const now = () => Date.now();

/** Local calendar date as ISO (YYYY-MM-DD) — game dates are "bleacher time", not UTC. */
export function todayISO(): string {
  const d = new Date();
  const m = `${d.getMonth() + 1}`.padStart(2, '0');
  const day = `${d.getDate()}`.padStart(2, '0');
  return `${d.getFullYear()}-${m}-${day}`;
}

// ---------------------------------------------------------------- players

/** v1 has exactly one player. Creates the "Me" row on first use. */
export async function ensurePlayer(name = 'Me'): Promise<Player> {
  const existing = await db.select().from(players).limit(1);
  if (existing.length > 0) return existing[0];
  const player: Player = { id: randomUUID(), name, createdAt: now() };
  await db.insert(players).values(player);
  return player;
}

export async function renamePlayer(name: string): Promise<void> {
  const player = await ensurePlayer();
  await db.update(players).set({ name: name.trim() || 'Me' }).where(eq(players.id, player.id));
}

// ---------------------------------------------------------------- seasons

export async function createSeason(name: string, sport: Sport): Promise<Season> {
  const season: Season = {
    id: randomUUID(),
    name: name.trim() || `${new Date().getFullYear()} Season`,
    sport,
    isActive: true,
    createdAt: now(),
  };
  await db.update(seasons).set({ isActive: false });
  await db.insert(seasons).values(season);
  return season;
}

export async function setActiveSeason(id: string): Promise<void> {
  await db.update(seasons).set({ isActive: false });
  await db.update(seasons).set({ isActive: true }).where(eq(seasons.id, id));
}

export async function setSeasonSport(id: string, sport: Sport): Promise<void> {
  await db.update(seasons).set({ sport }).where(eq(seasons.id, id));
}

/** Blank names are ignored rather than clobbering the current one. */
export async function renameSeason(id: string, name: string): Promise<void> {
  const trimmed = name.trim();
  if (!trimmed) return;
  await db.update(seasons).set({ name: trimmed }).where(eq(seasons.id, id));
}

/** Deletes a season and everything in it. Reactivates the newest remaining season. */
export async function deleteSeason(id: string): Promise<void> {
  const seasonGames = await db.select({ id: games.id }).from(games).where(eq(games.seasonId, id));
  for (const g of seasonGames) {
    await db.delete(plateAppearances).where(eq(plateAppearances.gameId, g.id));
  }
  await db.delete(games).where(eq(games.seasonId, id));
  await db.delete(seasons).where(eq(seasons.id, id));

  const remaining = await db.select().from(seasons).orderBy(desc(seasons.createdAt)).limit(1);
  if (remaining.length > 0) {
    const anyActive = await db.select().from(seasons).where(eq(seasons.isActive, true)).limit(1);
    if (anyActive.length === 0) await setActiveSeason(remaining[0].id);
  }
}

// ---------------------------------------------------------------- games

export async function getOpenGame(seasonId: string): Promise<Game | undefined> {
  const rows = await db
    .select()
    .from(games)
    .where(and(eq(games.seasonId, seasonId), isNull(games.endedAt)))
    .orderBy(desc(games.createdAt))
    .limit(1);
  return rows[0];
}

export async function startGame(seasonId: string, opponent?: string): Promise<Game> {
  const game: Game = {
    id: randomUUID(),
    seasonId,
    opponent: opponent?.trim() || null,
    playedOn: todayISO(),
    notes: null,
    endedAt: null,
    createdAt: now(),
  };
  await db.insert(games).values(game);
  return game;
}

export async function endGame(gameId: string): Promise<void> {
  await db.update(games).set({ endedAt: now() }).where(eq(games.id, gameId));
}

export async function reopenGame(gameId: string): Promise<void> {
  await db.update(games).set({ endedAt: null }).where(eq(games.id, gameId));
}

export async function setGameOpponent(gameId: string, opponent: string): Promise<void> {
  await db
    .update(games)
    .set({ opponent: opponent.trim() || null })
    .where(eq(games.id, gameId));
}

export async function deleteGame(gameId: string): Promise<void> {
  await db.delete(plateAppearances).where(eq(plateAppearances.gameId, gameId));
  await db.delete(games).where(eq(games.id, gameId));
}

// ---------------------------------------------------------------- plate appearances

export async function logPA(gameId: string, outcome: OutcomeCode): Promise<PlateAppearance> {
  const player = await ensurePlayer();
  const [{ maxSeq }] = await db
    .select({ maxSeq: sql<number>`coalesce(max(${plateAppearances.seq}), 0)` })
    .from(plateAppearances)
    .where(eq(plateAppearances.gameId, gameId));

  const pa: PlateAppearance = {
    id: randomUUID(),
    gameId,
    playerId: player.id,
    outcome,
    seq: maxSeq + 1,
    sprayX: null,
    sprayY: null,
    createdAt: now(),
  };
  await db.insert(plateAppearances).values(pa);
  return pa;
}

export async function undoPA(paId: string): Promise<void> {
  await db.delete(plateAppearances).where(eq(plateAppearances.id, paId));
}

export async function updatePAOutcome(paId: string, outcome: OutcomeCode): Promise<void> {
  // A location only makes sense for a batted ball — drop it if the
  // corrected outcome never put one in play (e.g. 2B edited to K).
  const spray = OUTCOME_SPECS[outcome].inPlay ? {} : { sprayX: null, sprayY: null };
  await db
    .update(plateAppearances)
    .set({ outcome, ...spray })
    .where(eq(plateAppearances.id, paId));
}

/** Batted-ball location, normalized to the field diagram (0..1 of width/height). */
export async function setPASpray(paId: string, x: number, y: number): Promise<void> {
  await db
    .update(plateAppearances)
    .set({ sprayX: x, sprayY: y })
    .where(eq(plateAppearances.id, paId));
}

export async function listPAsForGame(gameId: string): Promise<PlateAppearance[]> {
  return db
    .select()
    .from(plateAppearances)
    .where(eq(plateAppearances.gameId, gameId))
    .orderBy(asc(plateAppearances.seq));
}

// ---------------------------------------------------------------- settings

export async function getSetting(key: string): Promise<string | undefined> {
  const rows = await db.select().from(settings).where(eq(settings.key, key)).limit(1);
  return rows[0]?.value;
}

export async function setSetting(key: string, value: string): Promise<void> {
  await db
    .insert(settings)
    .values({ key, value })
    .onConflictDoUpdate({ target: settings.key, set: { value } });
}
