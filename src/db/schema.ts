import { index, integer, real, sqliteTable, text, uniqueIndex } from 'drizzle-orm/sqlite-core';

/**
 * Everything in BattersBox reduces to a plate appearance (PA).
 * Stats are always derived from stored PAs — never persisted as totals —
 * so undo/edit/delete stay trivially correct.
 *
 * A `players` table exists from day one even though v1 (Player Mode)
 * auto-creates a single "Me" row: Scorekeeper Mode bolts on later
 * without a schema rewrite.
 */

export const players = sqliteTable('players', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  createdAt: integer('created_at').notNull(),
});

export const seasons = sqliteTable('seasons', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  sport: text('sport', { enum: ['baseball', 'softball'] }).notNull(),
  isActive: integer('is_active', { mode: 'boolean' }).notNull().default(false),
  createdAt: integer('created_at').notNull(),
});

export const games = sqliteTable(
  'games',
  {
    id: text('id').primaryKey(),
    seasonId: text('season_id')
      .notNull()
      .references(() => seasons.id),
    opponent: text('opponent'),
    playedOn: text('played_on').notNull(), // ISO date, defaults to today
    notes: text('notes'),
    endedAt: integer('ended_at'), // null = game still open ("Resume Game")
    createdAt: integer('created_at').notNull(),
  },
  (t) => [index('games_season_idx').on(t.seasonId)],
);

export const plateAppearances = sqliteTable(
  'plate_appearances',
  {
    id: text('id').primaryKey(),
    gameId: text('game_id')
      .notNull()
      .references(() => games.id),
    playerId: text('player_id')
      .notNull()
      .references(() => players.id),
    outcome: text('outcome').notNull(), // OutcomeCode, validated in domain layer
    seq: integer('seq').notNull(), // order within the game
    sprayX: real('spray_x'), // reserved for the spray-chart stretch goal
    sprayY: real('spray_y'),
    createdAt: integer('created_at').notNull(),
  },
  (t) => [index('pa_game_idx').on(t.gameId)],
);

export const settings = sqliteTable('settings', {
  key: text('key').primaryKey(),
  value: text('value').notNull(),
});

// ------------------------------------------------------------- scorekeeper
// Scorekeeper Mode lives in its own sk_* tables on purpose: player-mode
// queries never scan or join these, so team scorekeeping can never leak
// into (or out of) the individual stat line.

export const skTeams = sqliteTable('sk_teams', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  createdAt: integer('created_at').notNull(),
});

export const skPlayers = sqliteTable(
  'sk_players',
  {
    id: text('id').primaryKey(),
    teamId: text('team_id')
      .notNull()
      .references(() => skTeams.id),
    name: text('name').notNull(),
    number: text('number'), // jersey number as text — "00" survives
    rosterOrder: integer('roster_order').notNull(), // default batting order for new games
    archivedAt: integer('archived_at'), // players with PAs are archived, never deleted
    createdAt: integer('created_at').notNull(),
  },
  (t) => [index('sk_players_team_idx').on(t.teamId)],
);

export const skGames = sqliteTable(
  'sk_games',
  {
    id: text('id').primaryKey(),
    teamId: text('team_id')
      .notNull()
      .references(() => skTeams.id),
    opponent: text('opponent'),
    playedOn: text('played_on').notNull(), // ISO date, defaults to today
    currentInning: integer('current_inning').notNull().default(1), // persisted so resume works
    endedAt: integer('ended_at'), // null = game still open ("Resume game")
    createdAt: integer('created_at').notNull(),
  },
  (t) => [index('sk_games_team_idx').on(t.teamId)],
);

export const skLineupSlots = sqliteTable(
  'sk_lineup_slots',
  {
    id: text('id').primaryKey(),
    gameId: text('game_id')
      .notNull()
      .references(() => skGames.id),
    playerId: text('player_id')
      .notNull()
      .references(() => skPlayers.id),
    battingOrder: integer('batting_order').notNull(), // 1-based, renumbered on edits
    scratchedAt: integer('scratched_at'), // slots with PAs are scratched, never deleted
    createdAt: integer('created_at').notNull(),
  },
  (t) => [index('sk_lineup_game_idx').on(t.gameId)],
);

export const skPlateAppearances = sqliteTable(
  'sk_plate_appearances',
  {
    id: text('id').primaryKey(),
    gameId: text('game_id')
      .notNull()
      .references(() => skGames.id),
    playerId: text('player_id')
      .notNull()
      .references(() => skPlayers.id), // cumulative team stats group by this
    lineupSlotId: text('lineup_slot_id')
      .notNull()
      .references(() => skLineupSlots.id), // due-up tracking anchors to this
    outcome: text('outcome').notNull(), // OutcomeCode, same taxonomy as player mode
    inning: integer('inning').notNull(), // snapshot of currentInning at log time
    seq: integer('seq').notNull(), // order within the game
    createdAt: integer('created_at').notNull(),
  },
  (t) => [index('sk_pa_game_idx').on(t.gameId), index('sk_pa_player_idx').on(t.playerId)],
);

export const skInningRuns = sqliteTable(
  'sk_inning_runs',
  {
    id: text('id').primaryKey(),
    gameId: text('game_id')
      .notNull()
      .references(() => skGames.id),
    inning: integer('inning').notNull(),
    runsUs: integer('runs_us').notNull().default(0),
    runsThem: integer('runs_them').notNull().default(0),
  },
  // Unique so the run steppers can upsert on (game, inning).
  (t) => [uniqueIndex('sk_runs_game_inning_idx').on(t.gameId, t.inning)],
);

export type Player = typeof players.$inferSelect;
export type Season = typeof seasons.$inferSelect;
export type Sport = Season['sport'];
export type Game = typeof games.$inferSelect;
export type PlateAppearance = typeof plateAppearances.$inferSelect;
export type SkTeam = typeof skTeams.$inferSelect;
export type SkPlayer = typeof skPlayers.$inferSelect;
export type SkGame = typeof skGames.$inferSelect;
export type SkLineupSlot = typeof skLineupSlots.$inferSelect;
export type SkPlateAppearance = typeof skPlateAppearances.$inferSelect;
export type SkInningRun = typeof skInningRuns.$inferSelect;
