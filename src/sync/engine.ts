/**
 * One sync cycle: send this device's changes, then take everything new from
 * the server. Works on any SQLite through the small `Sql` interface, so it is
 * tested against Node's SQLite with the app's real migrations.
 *
 * Local changes are recorded by triggers in `sync_changes` (see
 * scripts/sync-triggers.mjs). The server keeps the newest version of every
 * row; this side applies whatever the server sends, except rows with local
 * changes still waiting to go up (those win or lose on the next push).
 */
import { BATCH, syncedTable, type PullResponse, type PushRequest, type PushResponse, type SyncChange } from './tables';

export interface Sql {
  all<T = Record<string, unknown>>(sql: string, params?: unknown[]): Promise<T[]>;
  run(sql: string, params?: unknown[]): Promise<void>;
}

export interface Transport {
  push(request: PushRequest): Promise<PushResponse>;
  pull(cursor: number): Promise<PullResponse>;
}

export interface SyncResult {
  pushed: number;
  pulled: number;
}

const quote = (identifier: string) => `"${identifier.replace(/"/g, '""')}"`;

async function getState(sql: Sql, key: string): Promise<string | null> {
  const rows = await sql.all<{ value: string }>('SELECT value FROM sync_state WHERE key = ?', [key]);
  return rows[0]?.value ?? null;
}

async function setState(sql: Sql, key: string, value: string): Promise<void> {
  await sql.run('INSERT OR REPLACE INTO sync_state (key, value) VALUES (?, ?)', [key, value]);
}

/** A random id for this device, made once. */
export async function deviceId(sql: Sql, makeId: () => string): Promise<string> {
  const existing = await getState(sql, 'device');
  if (existing) return existing;
  const id = makeId();
  await setState(sql, 'device', id);
  return id;
}

export async function pendingCount(sql: Sql): Promise<number> {
  const rows = await sql.all<{ n: number }>('SELECT COUNT(DISTINCT tbl || char(31) || row_key) AS n FROM sync_changes');
  return Number(rows[0]?.n ?? 0);
}

interface Pending {
  tbl: string;
  rowKey: string;
  changedAt: number;
  maxSeq: number;
}

/** Up to BATCH changed rows, each as it is now (or a deletion), oldest first. */
export async function collectChanges(sql: Sql): Promise<{ changes: SyncChange[]; pending: Pending[] }> {
  const pending = await sql.all<Pending>(
    `SELECT tbl, row_key AS rowKey, MAX(changed_at) AS changedAt, MAX(seq) AS maxSeq
     FROM sync_changes GROUP BY tbl, row_key ORDER BY MIN(seq) LIMIT ${BATCH}`,
  );
  const changes: SyncChange[] = [];
  for (const p of pending) {
    const table = syncedTable(p.tbl);
    if (!table) continue;
    const rows = await sql.all(`SELECT * FROM ${quote(table.name)} WHERE ${quote(table.key)} = ?`, [p.rowKey]);
    changes.push({ tbl: p.tbl, key: p.rowKey, changedAt: Number(p.changedAt), row: rows[0] ?? null });
  }
  return { changes, pending };
}

/** The server has these: forget them (but keep any change made since). */
async function acknowledge(sql: Sql, pending: Pending[]): Promise<void> {
  for (const p of pending) {
    await sql.run('DELETE FROM sync_changes WHERE tbl = ? AND row_key = ? AND seq <= ?', [p.tbl, p.rowKey, p.maxSeq]);
  }
}

const columnCache = new Map<string, Set<string>>();
async function columnsOf(sql: Sql, table: string): Promise<Set<string>> {
  let cols = columnCache.get(table);
  if (!cols) {
    cols = new Set((await sql.all<{ name: string }>(`PRAGMA table_info(${quote(table)})`)).map((c) => c.name));
    columnCache.set(table, cols);
  }
  return cols;
}

/**
 * Apply the server's changes. Deliberately not one transaction: the app
 * shares this connection, so a tap logged meanwhile would land inside it
 * (and vanish on a rollback). Each step can be repeated safely instead, and
 * the cursor only moves once the page is applied.
 *
 * The triggers record these writes like any other; those records are removed
 * afterwards by key, so they don't echo back to the server. A row edited on
 * this device in that same instant keeps its local value but isn't re-sent:
 * a rare, harmless loss of one edit's sync, never of a new row.
 *
 * Foreign keys are off meanwhile: the server sends rows in the order they
 * changed, not parents first.
 */
export async function applyChanges(sql: Sql, changes: SyncChange[]): Promise<number> {
  if (!changes.length) return 0;
  const waiting = new Set(
    (await sql.all<{ k: string }>("SELECT DISTINCT tbl || char(31) || row_key AS k FROM sync_changes")).map((r) => r.k),
  );
  let applied = 0;
  const before = Number((await sql.all<{ s: number | null }>('SELECT MAX(seq) AS s FROM sync_changes'))[0]?.s ?? 0);
  const touched: [string, string][] = [];
  await sql.run('PRAGMA foreign_keys = OFF');
  try {
    for (const change of changes) {
      const table = syncedTable(change.tbl);
      if (!table || waiting.has(`${change.tbl}\u001f${change.key}`)) continue;
      if (change.row === null) {
        await sql.run(`DELETE FROM ${quote(table.name)} WHERE ${quote(table.key)} = ?`, [change.key]);
      } else {
        const known = await columnsOf(sql, table.name);
        const cols = Object.keys(change.row).filter((c) => known.has(c));
        if (!cols.includes(table.key)) continue;
        await sql.run(
          `INSERT OR REPLACE INTO ${quote(table.name)} (${cols.map(quote).join(', ')}) VALUES (${cols.map(() => '?').join(', ')})`,
          cols.map((c) => change.row![c] ?? null),
        );
      }
      touched.push([change.tbl, change.key]);
      applied++;
    }
  } finally {
    await sql.run('PRAGMA foreign_keys = ON');
    for (const [tbl, key] of touched) {
      await sql.run('DELETE FROM sync_changes WHERE seq > ? AND tbl = ? AND row_key = ?', [before, tbl, key]);
    }
  }
  return applied;
}

/** Push everything waiting, then pull everything new. */
export async function syncOnce(sql: Sql, transport: Transport, device: string): Promise<SyncResult> {
  let pushed = 0;
  for (;;) {
    const { changes, pending } = await collectChanges(sql);
    if (!pending.length) break;
    await transport.push({ device, changes });
    await acknowledge(sql, pending);
    pushed += changes.length;
    if (pending.length < BATCH) break;
  }

  let pulled = 0;
  let cursor = Number((await getState(sql, 'cursor')) ?? 0);
  for (;;) {
    const page = await transport.pull(cursor);
    pulled += await applyChanges(sql, page.changes);
    cursor = page.cursor;
    await setState(sql, 'cursor', String(cursor));
    if (!page.more) break;
  }
  return { pushed, pulled };
}

/** True once this device has pulled from the server at least once. */
export async function hasSynced(sql: Sql): Promise<boolean> {
  return (await getState(sql, 'cursor')) !== null;
}
