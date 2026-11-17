import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, readdirSync, writeFileSync } from 'node:fs';
import { createServer, type Server } from 'node:http';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { after, before, describe, test } from 'node:test';

import { createApp } from './app.ts';
import { backupName, msUntil, runBackup, toPrune } from './backup.ts';
import { SyncStore } from './store.ts';

const T = 1_800_000_000_000;
const pa = (key: string, outcome: string) => ({ tbl: 'plate_appearances', key, changedAt: T, row: { id: key, outcome } });

describe('SyncStore', () => {
  test('newest change wins; a tie goes to the larger device id', () => {
    const store = new SyncStore(new DatabaseSync(':memory:'));
    assert.deepEqual(store.push({ device: 'b', changes: [pa('x', '1B')] }), { accepted: 1, stale: 0 });
    assert.deepEqual(store.push({ device: 'a', changes: [pa('x', 'K')] }), { accepted: 0, stale: 1 });
    assert.deepEqual(store.push({ device: 'c', changes: [pa('x', '2B')] }), { accepted: 1, stale: 0 });
    assert.deepEqual(store.push({ device: 'a', changes: [{ ...pa('x', 'HR'), changedAt: T - 1 }] }), { accepted: 0, stale: 1 });
    assert.equal(store.pull(0).changes[0]?.row?.outcome, '2B');
  });

  test('pull pages through in order, and a deletion is a null row', () => {
    const store = new SyncStore(new DatabaseSync(':memory:'));
    store.push({ device: 'a', changes: [pa('1', '1B'), pa('2', 'K'), pa('3', 'BB')] });
    store.push({ device: 'a', changes: [{ tbl: 'plate_appearances', key: '2', changedAt: T + 1, row: null }] });
    const first = store.pull(0, 2);
    assert.deepEqual(first.changes.map((c) => c.key), ['1', '3']);
    assert.equal(first.more, true);
    const second = store.pull(first.cursor, 2);
    assert.deepEqual(second.changes, [{ tbl: 'plate_appearances', key: '2', changedAt: T + 1, row: null }]);
    assert.equal(second.more, false);
    assert.deepEqual(store.pull(second.cursor), { changes: [], cursor: second.cursor, more: false });
    assert.equal(store.status().rows, 2);
    assert.equal(store.status().deleted, 1);
  });

  test('refuses what it should', () => {
    const store = new SyncStore(new DatabaseSync(':memory:'));
    assert.throws(() => store.push({ device: '', changes: [] }), /device/);
    assert.throws(() => store.push({ device: 'a', changes: [{ ...pa('x', '1B'), tbl: 'sync_state' }] }), /unknown table/);
    assert.throws(() => store.push({ device: 'a', changes: [{ ...pa('x', '1B'), changedAt: 'soon' }] }), /changedAt/);
    assert.throws(() => store.push({ device: 'a', changes: [{ ...pa('x', '1B'), row: [1] }] }), /row/);
    assert.throws(() => store.push({ device: 'a', changes: [pa('x', 'y'.repeat(600_000))] }), /too large/);
    assert.throws(() => store.pull(-1), /cursor/);
  });
});

describe('backups', () => {
  test('names by day, keeps the newest 30, ignores files it did not write', () => {
    assert.equal(backupName(new Date(2026, 10, 6)), 'nightly-2026-11-06.db');
    const files = Array.from({ length: 33 }, (_, i) => backupName(new Date(2026, 0, i + 1))).concat(['notes.txt', 'nightly-old.db']);
    assert.deepEqual(toPrune(files), ['nightly-2026-01-03.db', 'nightly-2026-01-02.db', 'nightly-2026-01-01.db']);
  });

  test('runBackup writes a readable copy', () => {
    const db = new DatabaseSync(':memory:');
    const store = new SyncStore(db);
    store.push({ device: 'a', changes: [pa('1', '1B')] });
    const dir = mkdtempSync(join(tmpdir(), 'bb-backup-'));
    const name = runBackup(db, dir, new Date(2026, 10, 16));
    assert.deepEqual(readdirSync(dir), ['nightly-2026-11-16.db']);
    const copy = new SyncStore(new DatabaseSync(join(dir, name)));
    assert.equal(copy.status().rows, 1);
  });

  test('msUntil the next run', () => {
    assert.equal(msUntil(3, 15, new Date(2026, 10, 16, 3, 0)), 15 * 60_000);
    assert.equal(msUntil(3, 15, new Date(2026, 10, 16, 3, 15)), 24 * 3600_000);
  });
});

describe('HTTP', () => {
  let server: Server;
  let base: string;
  before(async () => {
    const web = mkdtempSync(join(tmpdir(), 'bb-web-'));
    writeFileSync(join(web, 'index.html'), '<html>app</html>');
    mkdirSync(join(web, '_expo'));
    writeFileSync(join(web, '_expo', 'entry-abc.js'), 'console.log(1)');
    server = createServer(createApp({ store: new SyncStore(new DatabaseSync(':memory:')), webDir: web }));
    await new Promise<void>((r) => server.listen(0, '127.0.0.1', r));
    base = `http://127.0.0.1:${(server.address() as { port: number }).port}`;
  });
  after(() => server.close());

  test('pages carry the isolation headers the browser database needs', async () => {
    const res = await fetch(`${base}/`);
    assert.equal(res.headers.get('cross-origin-opener-policy'), 'same-origin');
    assert.equal(res.headers.get('cross-origin-embedder-policy'), 'require-corp');
    assert.equal(res.headers.get('cache-control'), 'no-cache');
    assert.equal(await res.text(), '<html>app</html>');
  });

  test('app routes get the page; hashed files are cached for good; missing files and escapes are 404', async () => {
    assert.equal(await (await fetch(`${base}/game/123`)).text(), '<html>app</html>');
    const js = await fetch(`${base}/_expo/entry-abc.js`);
    assert.match(js.headers.get('content-type')!, /javascript/);
    assert.match(js.headers.get('cache-control')!, /immutable/);
    assert.equal((await fetch(`${base}/_expo/nope.js`)).status, 404);
    assert.equal((await fetch(`${base}/..%2f..%2fpackage.json`)).status, 404);
  });

  test('push and pull round trip; writes from another site are refused', async () => {
    const body = JSON.stringify({ device: 'phone', changes: [pa('1', 'HR')] });
    const push = await fetch(`${base}/api/sync/push`, { method: 'POST', body, headers: { Origin: base, 'Content-Type': 'application/json' } });
    assert.deepEqual(await push.json(), { accepted: 1, stale: 0 });
    const pull = await (await fetch(`${base}/api/sync/pull?cursor=0`)).json();
    assert.equal(pull.changes[0].row.outcome, 'HR');
    const evil = await fetch(`${base}/api/sync/push`, { method: 'POST', body, headers: { Origin: 'https://evil.example' } });
    assert.equal(evil.status, 403);
    const bad = await fetch(`${base}/api/sync/push`, { method: 'POST', body: 'nope', headers: { Origin: base } });
    assert.equal(bad.status, 400);
    const status = await (await fetch(`${base}/api/status`)).json();
    assert.equal(status.ok, true);
    assert.equal(status.rows, 1);
    assert.equal(status.devices[0].id, 'phone');
    assert.equal((await fetch(`${base}/`, { method: 'DELETE' })).status, 405);
  });
});
