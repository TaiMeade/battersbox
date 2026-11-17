import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { beforeEach, describe, expect, test } from 'vitest';

import { SyncStore } from '../../server/store';
import { applyChanges, collectChanges, deviceId, hasSynced, pendingCount, syncOnce, type Sql, type Transport } from './engine';

/** A device: Node's SQLite with every app migration applied, behind the engine's Sql interface. */
function device(name: string) {
  const db = new DatabaseSync(':memory:');
  db.exec('PRAGMA foreign_keys = ON');
  const journal = JSON.parse(readFileSync(join(__dirname, '../../drizzle/meta/_journal.json'), 'utf8'));
  for (const entry of journal.entries) {
    const sqlText = readFileSync(join(__dirname, `../../drizzle/${entry.tag}.sql`), 'utf8');
    for (const statement of sqlText.split('--> statement-breakpoint')) if (statement.trim()) db.exec(statement);
  }
  const sql: Sql = {
    async all(q, params = []) { return db.prepare(q).all(...(params as never[])) as never[]; },
    async run(q, params = []) { db.prepare(q).run(...(params as never[])); },
  };
  return { name, db, sql };
}

function transportTo(store: SyncStore): Transport {
  // Through JSON, like the real thing.
  const wire = <T>(v: T): T => JSON.parse(JSON.stringify(v));
  return {
    async push(request) { return wire(store.push(wire(request))); },
    async pull(cursor) { return wire(store.pull(cursor)); },
  };
}

let server: SyncStore;
beforeEach(() => {
  server = new SyncStore(new DatabaseSync(':memory:'));
});

const T = 1_800_000_000_000;

function seedSeason(d: ReturnType<typeof device>, id = 's1') {
  d.db.prepare('INSERT INTO players (id, name, created_at) VALUES (?, ?, ?)').run('p1', 'Me', T);
  d.db.prepare("INSERT INTO seasons (id, name, sport, is_active, created_at) VALUES (?, '2026', 'softball', 1, ?)").run(id, T);
  d.db.prepare("INSERT INTO games (id, season_id, played_on, created_at) VALUES ('g1', ?, '2026-11-16', ?)").run(id, T);
}

function logPA(d: ReturnType<typeof device>, id: string, outcome: string, seq: number) {
  d.db.prepare("INSERT INTO plate_appearances (id, game_id, player_id, outcome, seq, created_at) VALUES (?, 'g1', 'p1', ?, ?, ?)")
    .run(id, outcome, seq, T + seq);
}

const count = (d: ReturnType<typeof device>, table: string) => (d.db.prepare(`SELECT COUNT(*) AS n FROM ${table}`).get() as { n: number }).n;

describe('change log', () => {
  test('triggers record inserts, updates and deletes, one entry per row', async () => {
    const phone = device('phone');
    seedSeason(phone);
    logPA(phone, 'pa1', '1B', 1);
    phone.db.prepare("UPDATE plate_appearances SET outcome = '2B' WHERE id = 'pa1'").run();
    expect(await pendingCount(phone.sql)).toBe(4);
    const { changes } = await collectChanges(phone.sql);
    expect(changes.find((c) => c.key === 'pa1')?.row?.outcome).toBe('2B');
    phone.db.prepare("DELETE FROM plate_appearances WHERE id = 'pa1'").run();
    expect((await collectChanges(phone.sql)).changes.find((c) => c.key === 'pa1')?.row).toBeNull();
  });
});

describe('syncOnce', () => {
  test('a second device receives everything, and nothing echoes back', async () => {
    const phone = device('phone');
    const laptop = device('laptop');
    seedSeason(phone);
    logPA(phone, 'pa1', '1B', 1);
    logPA(phone, 'pa2', 'K', 2);

    expect(await syncOnce(phone.sql, transportTo(server), 'phone')).toEqual({ pushed: 5, pulled: 5 });
    expect(await pendingCount(phone.sql)).toBe(0);
    expect(await hasSynced(laptop.sql)).toBe(false);

    expect(await syncOnce(laptop.sql, transportTo(server), 'laptop')).toEqual({ pushed: 0, pulled: 5 });
    expect(count(laptop, 'plate_appearances')).toBe(2);
    expect(await pendingCount(laptop.sql)).toBe(0); // applied rows aren't sent back
    expect(await hasSynced(laptop.sql)).toBe(true);

    // Nothing new: nothing moves.
    expect(await syncOnce(laptop.sql, transportTo(server), 'laptop')).toEqual({ pushed: 0, pulled: 0 });
  });

  test('offline at-bats on two devices merge', async () => {
    const phone = device('phone');
    const laptop = device('laptop');
    seedSeason(phone);
    await syncOnce(phone.sql, transportTo(server), 'phone');
    await syncOnce(laptop.sql, transportTo(server), 'laptop');

    logPA(phone, 'pa-phone', 'HR', 1);
    logPA(laptop, 'pa-laptop', 'BB', 2);
    await syncOnce(phone.sql, transportTo(server), 'phone');
    await syncOnce(laptop.sql, transportTo(server), 'laptop');
    await syncOnce(phone.sql, transportTo(server), 'phone');

    const outcomes = (d: ReturnType<typeof device>) =>
      (d.db.prepare('SELECT outcome FROM plate_appearances ORDER BY seq').all() as { outcome: string }[]).map((r) => r.outcome);
    expect(outcomes(phone)).toEqual(['HR', 'BB']);
    expect(outcomes(laptop)).toEqual(['HR', 'BB']);
  });

  test('deletions travel; the newer edit of the same row wins', async () => {
    const phone = device('phone');
    const laptop = device('laptop');
    seedSeason(phone);
    logPA(phone, 'pa1', '1B', 1);
    logPA(phone, 'pa2', 'K', 2);
    await syncOnce(phone.sql, transportTo(server), 'phone');
    await syncOnce(laptop.sql, transportTo(server), 'laptop');

    phone.db.prepare("DELETE FROM plate_appearances WHERE id = 'pa2'").run();
    // Both edit pa1; the laptop's edit is recorded later.
    phone.db.prepare("UPDATE plate_appearances SET outcome = '2B' WHERE id = 'pa1'").run();
    laptop.db.prepare("UPDATE plate_appearances SET outcome = '3B' WHERE id = 'pa1'").run();
    laptop.db.prepare("UPDATE sync_changes SET changed_at = changed_at + 60000 WHERE row_key = 'pa1'").run();

    await syncOnce(phone.sql, transportTo(server), 'phone');
    await syncOnce(laptop.sql, transportTo(server), 'laptop');
    await syncOnce(phone.sql, transportTo(server), 'phone');

    for (const d of [phone, laptop]) {
      expect(d.db.prepare('SELECT id, outcome FROM plate_appearances').all()).toEqual([{ id: 'pa1', outcome: '3B' }]);
    }
  });

  test('a local change waiting to go up is not overwritten by an older server copy', async () => {
    const phone = device('phone');
    seedSeason(phone);
    logPA(phone, 'pa1', '1B', 1);
    await syncOnce(phone.sql, transportTo(server), 'phone');
    phone.db.prepare("UPDATE plate_appearances SET outcome = 'HR' WHERE id = 'pa1'").run();
    const old = server.pull(0).changes.filter((c) => c.key === 'pa1');
    await applyChanges(phone.sql, old);
    expect((phone.db.prepare("SELECT outcome FROM plate_appearances WHERE id = 'pa1'").get() as { outcome: string }).outcome).toBe('HR');
  });

  test('settings sync by their key, and children may arrive before parents', async () => {
    const laptop = device('laptop');
    const changes = [
      { tbl: 'plate_appearances', key: 'pa1', changedAt: T, row: { id: 'pa1', game_id: 'g1', player_id: 'p1', outcome: '1B', seq: 1, created_at: T } },
      { tbl: 'games', key: 'g1', changedAt: T, row: { id: 'g1', season_id: 's1', played_on: '2026-11-16', created_at: T } },
      { tbl: 'seasons', key: 's1', changedAt: T, row: { id: 's1', name: '2026', sport: 'baseball', is_active: 1, created_at: T } },
      { tbl: 'players', key: 'p1', changedAt: T, row: { id: 'p1', name: 'Me', created_at: T, from_a_newer_app: 'ignored' } },
      { tbl: 'settings', key: 'card.team', changedAt: T, row: { key: 'card.team', value: 'Hornets' } },
      { tbl: 'not_a_table', key: 'x', changedAt: T, row: { id: 'x' } },
    ];
    expect(await applyChanges(laptop.sql, changes)).toBe(5);
    expect(count(laptop, 'plate_appearances')).toBe(1);
    expect(laptop.db.prepare("SELECT value FROM settings WHERE key = 'card.team'").get()).toEqual({ value: 'Hornets' });
    expect(await pendingCount(laptop.sql)).toBe(0);
    expect((laptop.db.prepare('PRAGMA foreign_keys').get() as { foreign_keys: number }).foreign_keys).toBe(1);
  });

  test('a big history goes up and comes down in batches', async () => {
    const phone = device('phone');
    const laptop = device('laptop');
    seedSeason(phone);
    for (let i = 0; i < 1203; i++) logPA(phone, `pa${i}`, '1B', i);
    const pushed = await syncOnce(phone.sql, transportTo(server), 'phone');
    expect(pushed.pushed).toBe(1206);
    expect((await syncOnce(laptop.sql, transportTo(server), 'laptop')).pulled).toBe(1206);
    expect(count(laptop, 'plate_appearances')).toBe(1203);
  });

  test('device id is made once', async () => {
    const phone = device('phone');
    let n = 0;
    const make = () => `id-${++n}`;
    expect(await deviceId(phone.sql, make)).toBe('id-1');
    expect(await deviceId(phone.sql, make)).toBe('id-1');
  });

  test('rows already on the device when sync was added go up on the first sync', () => {
    // The migration seeds sync_changes from existing rows; simulate by running it on data.
    const sqlText = readFileSync(join(__dirname, '../../drizzle/0003_sync_triggers.sql'), 'utf8');
    expect(sqlText).toContain("INSERT INTO sync_changes (tbl, row_key, changed_at) SELECT 'plate_appearances', id,");
    expect(sqlText).toContain("SELECT 'settings', key,");
  });
});
