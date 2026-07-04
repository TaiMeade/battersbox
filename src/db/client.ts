import { drizzle } from 'drizzle-orm/expo-sqlite';
import { openDatabaseSync } from 'expo-sqlite';

import * as schema from './schema';

// enableChangeListener powers Drizzle's useLiveQuery — every screen
// re-renders automatically when a PA is logged, edited, or undone.
export const expoDb = openDatabaseSync('battersbox.db', {
  enableChangeListener: true,
});

expoDb.execSync('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;');

export const db = drizzle(expoDb, { schema });
