/**
 * The server's copy: the newest version of every synced row (or the fact it
 * was deleted), each stamped with a sequence number so devices can ask for
 * "everything after N". Last change wins, by the time the device recorded it.
 */
import type { DatabaseSync } from 'node:sqlite';

import { BATCH, syncedTable, type PullResponse, type PushRequest, type PushResponse, type SyncChange } from '../src/sync/tables.ts';

export const MAX_ROW_BYTES = 512 * 1024; // a card photo is ~100 KB

export class BadRequest extends Error {}

export interface StoreStatus {
  rows: number;
  deleted: number;
  devices: { id: string; lastSeenAt: number }[];
  lastChangeAt: number | null;
}

function validate(change: unknown): SyncChange {
  const c = change as Partial<SyncChange> | null;
  if (!c || typeof c !== 'object') throw new BadRequest('change must be an object');
  if (typeof c.tbl !== 'string' || !syncedTable(c.tbl)) throw new BadRequest(`unknown table ${String(c.tbl)}`);
  if (typeof c.key !== 'string' || !c.key || c.key.length > 200) throw new BadRequest('bad key');
  if (typeof c.changedAt !== 'number' || !Number.isFinite(c.changedAt)) throw new BadRequest('bad changedAt');
  if (c.row !== null && (typeof c.row !== 'object' || Array.isArray(c.row))) throw new BadRequest('row must be an object or null');
  return c as SyncChange;
}

export class SyncStore {
  private db: DatabaseSync;

  constructor(db: DatabaseSync) {
    this.db = db;
    db.exec(`
      PRAGMA journal_mode = WAL;
      CREATE TABLE IF NOT EXISTS rows (
        tbl TEXT NOT NULL,
        row_key TEXT NOT NULL,
        data TEXT,                 -- the row as JSON; NULL once deleted
        changed_at INTEGER NOT NULL,
        device TEXT NOT NULL,
        seq INTEGER NOT NULL UNIQUE,
        PRIMARY KEY (tbl, row_key)
      );
      CREATE TABLE IF NOT EXISTS devices (
        id TEXT PRIMARY KEY,
        last_seen_at INTEGER NOT NULL
      );
    `);
  }

  private seen(device: string) {
    this.db.prepare('INSERT INTO devices (id, last_seen_at) VALUES (?, ?) ON CONFLICT(id) DO UPDATE SET last_seen_at = excluded.last_seen_at')
      .run(device, Date.now());
  }

  push(request: unknown): PushResponse {
    const r = request as Partial<PushRequest> | null;
    if (!r || typeof r.device !== 'string' || !r.device || r.device.length > 100) throw new BadRequest('bad device');
    if (!Array.isArray(r.changes) || r.changes.length > BATCH) throw new BadRequest(`changes must be a list of at most ${BATCH}`);
    const changes = r.changes.map(validate);
    for (const c of changes) {
      if (c.row && JSON.stringify(c.row).length > MAX_ROW_BYTES) throw new BadRequest(`row ${c.tbl}/${c.key} is too large`);
    }

    const current = this.db.prepare('SELECT changed_at AS changedAt, device FROM rows WHERE tbl = ? AND row_key = ?');
    const write = this.db.prepare(`INSERT INTO rows (tbl, row_key, data, changed_at, device, seq) VALUES (?, ?, ?, ?, ?, ?)
      ON CONFLICT(tbl, row_key) DO UPDATE SET data = excluded.data, changed_at = excluded.changed_at,
        device = excluded.device, seq = excluded.seq`);
    let accepted = 0;
    let stale = 0;
    this.db.exec('BEGIN IMMEDIATE');
    try {
      let seq = Number((this.db.prepare('SELECT COALESCE(MAX(seq), 0) AS s FROM rows').get() as { s: number }).s);
      for (const c of changes) {
        const have = current.get(c.tbl, c.key) as { changedAt: number; device: string } | undefined;
        // Newer wins; a tie goes to the larger device id, so every server decides the same way.
        if (have && (have.changedAt > c.changedAt || (have.changedAt === c.changedAt && have.device > r.device))) {
          stale++;
          continue;
        }
        write.run(c.tbl, c.key, c.row === null ? null : JSON.stringify(c.row), c.changedAt, r.device, ++seq);
        accepted++;
      }
      this.seen(r.device);
      this.db.exec('COMMIT');
    } catch (err) {
      this.db.exec('ROLLBACK');
      throw err;
    }
    return { accepted, stale };
  }

  pull(cursor: number, limit = BATCH): PullResponse {
    if (!Number.isSafeInteger(cursor) || cursor < 0) throw new BadRequest('bad cursor');
    const rows = this.db.prepare('SELECT tbl, row_key AS key, data, changed_at AS changedAt, seq FROM rows WHERE seq > ? ORDER BY seq LIMIT ?')
      .all(cursor, limit + 1) as { tbl: string; key: string; data: string | null; changedAt: number; seq: number }[];
    const page = rows.slice(0, limit);
    return {
      changes: page.map((r) => ({ tbl: r.tbl, key: r.key, changedAt: Number(r.changedAt), row: r.data === null ? null : JSON.parse(r.data) })),
      cursor: page.length ? Number(page[page.length - 1]!.seq) : cursor,
      more: rows.length > limit,
    };
  }

  status(): StoreStatus {
    const counts = this.db.prepare('SELECT COUNT(*) AS n, SUM(data IS NULL) AS d, MAX(changed_at) AS last FROM rows').get() as { n: number; d: number | null; last: number | null };
    const devices = this.db.prepare('SELECT id, last_seen_at AS lastSeenAt FROM devices ORDER BY last_seen_at DESC').all() as { id: string; lastSeenAt: number }[];
    return {
      rows: Number(counts.n) - Number(counts.d ?? 0),
      deleted: Number(counts.d ?? 0),
      devices: devices.map((d) => ({ id: d.id, lastSeenAt: Number(d.lastSeenAt) })),
      lastChangeAt: counts.last === null ? null : Number(counts.last),
    };
  }
}
