/**
 * BattersBox sync server: the web app plus the sync API. Listens on loopback
 * only; `tailscale serve` provides the HTTPS the web app requires.
 *
 *   node server/index.ts
 *
 * Settings (environment):
 *   PORT=3700  HOST=127.0.0.1  DATA_DIR=./data  WEB_DIR=./dist-web
 *   BACKUP_DIR=<DATA_DIR>/backups   BACKUP_AT=03:15 (or "off")
 */
import { appendFileSync, mkdirSync, renameSync, statSync } from 'node:fs';
import { createServer } from 'node:http';
import { join, resolve } from 'node:path';
import { DatabaseSync } from 'node:sqlite';

import { createApp } from './app.ts';
import { listBackups, msUntil, runBackup } from './backup.ts';
import { SyncStore } from './store.ts';

const port = Number(process.env.PORT ?? 3700);
const host = process.env.HOST ?? '127.0.0.1';
const dataDir = resolve(process.env.DATA_DIR ?? './data');
const webDir = resolve(process.env.WEB_DIR ?? './dist-web');
const backupDir = resolve(process.env.BACKUP_DIR ?? join(dataDir, 'backups'));
const backupAt = process.env.BACKUP_AT ?? '03:15';

mkdirSync(dataDir, { recursive: true, mode: 0o700 });
const db = new DatabaseSync(join(dataDir, 'battersbox-sync.db'));
const store = new SyncStore(db);

let lastBackup: { name: string; at: string } | { error: string; at: string } | null = null;
function backup() {
  try {
    lastBackup = { name: runBackup(db, backupDir), at: new Date().toISOString() };
    console.info(`[battersbox] backup: ${lastBackup.name}`);
  } catch (err) {
    lastBackup = { error: (err as Error).message, at: new Date().toISOString() };
    console.error(`[battersbox] backup failed: ${(err as Error).message}`);
  }
}

if (backupAt !== 'off') {
  const [h, m] = backupAt.split(':').map(Number);
  const schedule = () => setTimeout(() => {
    backup();
    schedule();
  }, msUntil(h!, m!)).unref();
  schedule();
  // Missed last night's (server was off)? Do one now.
  const newest = listBackups(backupDir)[0];
  const yesterday = new Date(Date.now() - 36 * 3600_000);
  if (!newest || newest < `nightly-${yesterday.toISOString().slice(0, 10)}.db`) backup();
}

// Diagnostics sent by the web app (src/lib/diag.web.ts): one JSON line per
// batch in DATA_DIR/diag.log, rolled over to diag.log.1 at 2 MB.
const diagFile = join(dataDir, 'diag.log');
function writeDiag(batch: unknown) {
  try {
    if ((statSync(diagFile, { throwIfNoEntry: false })?.size ?? 0) > 2 * 1024 * 1024) {
      renameSync(diagFile, `${diagFile}.1`);
    }
    appendFileSync(diagFile, JSON.stringify({ at: new Date().toISOString(), ...(batch as object) }) + '\n', { mode: 0o600 });
  } catch (err) {
    console.error(`[battersbox] diag log failed: ${(err as Error).message}`);
  }
}

const server = createServer(
  createApp({ store, webDir, status: () => ({ backup: lastBackup }), diag: writeDiag }),
);
server.listen(port, host, () => console.info(`[battersbox] listening on http://${host}:${port}, web app from ${webDir}`));

for (const signal of ['SIGTERM', 'SIGINT'] as const) {
  process.on(signal, () => {
    server.close();
    db.close();
    process.exit(0);
  });
}
