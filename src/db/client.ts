import { drizzle, type ExpoSQLiteDatabase } from 'drizzle-orm/expo-sqlite';
import { openDatabaseAsync, openDatabaseSync, type SQLiteDatabase } from 'expo-sqlite';
import { Platform } from 'react-native';

import * as schema from './schema';

export const DB_NAME = 'battersbox.db';

type Db = ExpoSQLiteDatabase<typeof schema> & { $client: SQLiteDatabase };

let opened: { raw: SQLiteDatabase; db: Db } | null = null;

function open() {
  if (!opened) {
    // enableChangeListener powers Drizzle's useLiveQuery — every screen
    // re-renders automatically when a PA is logged, edited, or undone.
    const raw = openDatabaseSync(DB_NAME, { enableChangeListener: true });
    // WAL needs shared memory the browser's storage doesn't have; there it
    // quietly stays in its default journal mode.
    raw.execSync('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;');
    opened = { raw, db: drizzle(raw, { schema }) };
  }
  return opened;
}

/**
 * Opened on first use rather than at import, because on the web the
 * database lives in a worker that must be started first (see
 * `prepareDatabase`). Everything else uses `db` exactly as before.
 */
export const db: Db = new Proxy({} as Db, {
  get(_target, prop) {
    const real = open().db as unknown as Record<string | symbol, unknown>;
    const value = real[prop];
    return typeof value === 'function' ? (value as (...a: unknown[]) => unknown).bind(real) : value;
  },
});

export function rawDb(): SQLiteDatabase {
  return open().raw;
}

/**
 * Call (and await) once before anything touches `db`. On the web, the
 * synchronous database calls wait on a worker; a worker can't start while
 * the page is blocked waiting for it, so an async call starts it first.
 * On phones it does nothing.
 */
export async function prepareDatabase(onWaitingForOtherTab: () => void = () => {}): Promise<void> {
  if (Platform.OS !== 'web') return;
  const { askToKeepStorage, holdPageLock, waitForStorageRelease } = await import('./webStartup');
  await holdPageLock(onWaitingForOtherTab);
  await waitForStorageRelease();
  askToKeepStorage();
  const warmUp = await openDatabaseAsync(':memory:');
  await warmUp.closeAsync();
}

