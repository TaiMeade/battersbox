/**
 * Nightly copy of the server database: `VACUUM INTO` (a consistent snapshot
 * while the server keeps running), newest 30 kept. Only files named the way
 * this writes them are ever pruned.
 */
import { mkdirSync, readdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import type { DatabaseSync } from 'node:sqlite';

const NAME = /^nightly-(\d{4}-\d{2}-\d{2})\.db$/;
export const KEEP = 30;

export function backupName(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `nightly-${y}-${m}-${d}.db`;
}

/** Backup files in `dir`, newest first. */
export function listBackups(dir: string): string[] {
  try {
    return readdirSync(dir).filter((f) => NAME.test(f)).sort().reverse();
  } catch {
    return [];
  }
}

/** Which files to delete so `keep` remain; ignores anything it didn't write. */
export function toPrune(files: string[], keep = KEEP): string[] {
  return files.filter((f) => NAME.test(f)).sort().reverse().slice(keep);
}

export function runBackup(db: DatabaseSync, dir: string, now = new Date()): string {
  mkdirSync(dir, { recursive: true, mode: 0o700 });
  const name = backupName(now);
  const path = join(dir, name);
  rmSync(path, { force: true }); // a second run the same day replaces that day's copy
  db.prepare('VACUUM INTO ?').run(path);
  for (const old of toPrune(listBackups(dir))) rmSync(join(dir, old), { force: true });
  return name;
}

/** Milliseconds until the next `hh:mm`, local time. */
export function msUntil(hour: number, minute: number, now = new Date()): number {
  const next = new Date(now);
  next.setHours(hour, minute, 0, 0);
  if (next <= now) next.setDate(next.getDate() + 1);
  return next.getTime() - now.getTime();
}
