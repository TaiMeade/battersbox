import { asc, eq } from 'drizzle-orm';
import * as DocumentPicker from 'expo-document-picker';
import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';

import { db } from '@/db/client';
import {
  games,
  plateAppearances,
  players,
  seasons,
  settings,
  type Season,
} from '@/db/schema';
import { todayISO } from '@/db/repo';
import { buildSeasonCSV } from '@/domain/seasonCsv';

const BACKUP_VERSION = 1;

// ---------------------------------------------------------------- CSV export

function slugify(name: string): string {
  return (
    name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '') || 'season'
  );
}

async function writeAndShare(filename: string, content: string, mimeType: string): Promise<void> {
  const file = new File(Paths.cache, filename);
  if (file.exists) file.delete();
  file.write(content);
  await Sharing.shareAsync(file.uri, { mimeType, dialogTitle: filename });
}

/**
 * One row per plate appearance, each carrying the season line to that point,
 * plus season totals and an outcome tally at the bottom.
 */
export async function exportSeasonCSV(season: Season): Promise<void> {
  const rows = await db
    .select({
      playedOn: games.playedOn,
      opponent: games.opponent,
      seq: plateAppearances.seq,
      outcome: plateAppearances.outcome,
    })
    .from(plateAppearances)
    .innerJoin(games, eq(plateAppearances.gameId, games.id))
    .where(eq(games.seasonId, season.id))
    .orderBy(asc(games.playedOn), asc(games.createdAt), asc(plateAppearances.seq));

  await writeAndShare(
    `battersbox-${slugify(season.name)}.csv`,
    buildSeasonCSV(season.name, rows),
    'text/csv',
  );
}

// ---------------------------------------------------------------- JSON backup

interface BackupPayload {
  app: 'battersbox';
  version: number;
  exportedAt: string;
  players: (typeof players.$inferSelect)[];
  seasons: (typeof seasons.$inferSelect)[];
  games: (typeof games.$inferSelect)[];
  plateAppearances: (typeof plateAppearances.$inferSelect)[];
  settings: (typeof settings.$inferSelect)[];
}

/** Full-database dump. This is the v1 backup story — no cloud, just a file you keep. */
export async function exportBackup(): Promise<void> {
  const payload: BackupPayload = {
    app: 'battersbox',
    version: BACKUP_VERSION,
    exportedAt: new Date().toISOString(),
    players: await db.select().from(players),
    seasons: await db.select().from(seasons),
    games: await db.select().from(games),
    plateAppearances: await db.select().from(plateAppearances),
    settings: await db.select().from(settings),
  };
  await writeAndShare(
    `battersbox-backup-${todayISO()}.json`,
    JSON.stringify(payload),
    'application/json',
  );
}

function isBackupPayload(data: unknown): data is BackupPayload {
  if (typeof data !== 'object' || data === null) return false;
  const p = data as Record<string, unknown>;
  return (
    p.app === 'battersbox' &&
    p.version === BACKUP_VERSION &&
    Array.isArray(p.players) &&
    Array.isArray(p.seasons) &&
    Array.isArray(p.games) &&
    Array.isArray(p.plateAppearances) &&
    Array.isArray(p.settings)
  );
}

function* chunks<T>(items: T[], size: number): Generator<T[]> {
  for (let i = 0; i < items.length; i += size) yield items.slice(i, i + size);
}

export type RestoreResult = 'restored' | 'canceled' | 'invalid';

/** Replaces the entire database with a previously exported backup file. */
export async function restoreBackup(): Promise<RestoreResult> {
  const picked = await DocumentPicker.getDocumentAsync({
    type: 'application/json',
    copyToCacheDirectory: true,
  });
  if (picked.canceled || picked.assets.length === 0) return 'canceled';

  let data: unknown;
  try {
    data = JSON.parse(await new File(picked.assets[0].uri).text());
  } catch {
    return 'invalid';
  }
  if (!isBackupPayload(data)) return 'invalid';

  // Children first on the way out, parents first on the way back in.
  await db.delete(plateAppearances);
  await db.delete(games);
  await db.delete(seasons);
  await db.delete(players);
  await db.delete(settings);

  if (data.players.length > 0) await db.insert(players).values(data.players);
  if (data.seasons.length > 0) await db.insert(seasons).values(data.seasons);
  for (const chunk of chunks(data.games, 100)) await db.insert(games).values(chunk);
  for (const chunk of chunks(data.plateAppearances, 100)) {
    await db.insert(plateAppearances).values(chunk);
  }
  if (data.settings.length > 0) await db.insert(settings).values(data.settings);

  return 'restored';
}
