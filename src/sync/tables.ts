/**
 * The tables that sync, parents before children, and each one's key column.
 * Shared by the app, the server (server/) and scripts/sync-triggers.mjs,
 * which writes the change-log triggers from this list. Adding a table to the
 * schema means adding it here and generating a migration with that script.
 *
 * No imports: the server loads this file directly.
 */
export const SYNCED_TABLES = [
  { name: 'players', key: 'id' },
  { name: 'seasons', key: 'id' },
  { name: 'games', key: 'id' },
  { name: 'plate_appearances', key: 'id' },
  { name: 'settings', key: 'key' },
  { name: 'sk_teams', key: 'id' },
  { name: 'sk_players', key: 'id' },
  { name: 'sk_games', key: 'id' },
  { name: 'sk_lineup_slots', key: 'id' },
  { name: 'sk_plate_appearances', key: 'id' },
  { name: 'sk_inning_runs', key: 'id' },
] as const;

export type SyncedTable = (typeof SYNCED_TABLES)[number]['name'];

const BY_NAME = new Map<string, { name: string; key: string }>(SYNCED_TABLES.map((t) => [t.name, t]));

export function syncedTable(name: string): { name: string; key: string } | undefined {
  return BY_NAME.get(name);
}

/** One change on the wire: the row as it is now, or `row: null` for a deletion. */
export interface SyncChange {
  tbl: string;
  key: string;
  changedAt: number;
  row: Record<string, unknown> | null;
}

export interface PushRequest {
  device: string;
  changes: SyncChange[];
}

export interface PushResponse {
  accepted: number;
  /** Changes the server already had something newer for. */
  stale: number;
  /**
   * The server's version of each stale row. The device has usually pulled
   * past it already, so without this its losing copy would never be replaced.
   * Optional so an older server still works.
   */
  winners?: SyncChange[];
}

export interface PullResponse {
  changes: SyncChange[];
  cursor: number;
  /** More waiting: pull again from `cursor`. */
  more: boolean;
}

/** Most changes in one push or pull. */
export const BATCH = 500;
