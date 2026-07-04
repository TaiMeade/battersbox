import { index, integer, real, sqliteTable, text } from 'drizzle-orm/sqlite-core';

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

export type Player = typeof players.$inferSelect;
export type Season = typeof seasons.$inferSelect;
export type Sport = Season['sport'];
export type Game = typeof games.$inferSelect;
export type PlateAppearance = typeof plateAppearances.$inferSelect;
