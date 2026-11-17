/**
 * When and how the web app syncs with the home server. Phones (Expo build)
 * don't sync: `syncEnabled` is false there and nothing here runs.
 *
 * A cycle runs at start-up, when the app comes back to the screen or the
 * connection returns, a few seconds after a change, and every 2 minutes.
 * Only one runs at a time.
 */
import { randomUUID } from 'expo-crypto';
import { Platform } from 'react-native';
import { create } from 'zustand';

import { rawDb } from '@/db/client';

import { deviceId, hasSynced, pendingCount, syncOnce, type Sql, type Transport } from './engine';
import type { PullResponse, PushResponse } from './tables';

export const syncEnabled = Platform.OS === 'web';

const EVERY_MS = 2 * 60_000;
const CHECK_CHANGES_MS = 4_000;
const REQUEST_TIMEOUT_MS = 20_000;

export type SyncState = 'idle' | 'syncing' | 'offline' | 'error';

interface SyncStatus {
  state: SyncState;
  lastSyncedAt: number | null;
  pending: number;
  message: string | null;
}

export const useSyncStatus = create<SyncStatus>(() => ({ state: 'idle', lastSyncedAt: null, pending: 0, message: null }));

const sql: Sql = {
  all: (q, params = []) => rawDb().getAllAsync(q, params as never[]),
  run: async (q, params = []) => {
    await rawDb().runAsync(q, params as never[]);
  },
};

class Offline extends Error {}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let response: Response;
  try {
    response = await fetch(path, { ...init, signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS), cache: 'no-store' });
  } catch {
    throw new Offline('Can’t reach your server');
  }
  if (!response.ok) {
    const body = await response.text().catch(() => '');
    throw new Error(`The server said ${response.status}${body ? `: ${body.slice(0, 200)}` : ''}`);
  }
  return response.json() as Promise<T>;
}

const transport: Transport = {
  push: (body) =>
    request<PushResponse>('/api/sync/push', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }),
  pull: (cursor) => request<PullResponse>(`/api/sync/pull?cursor=${cursor}`),
};

let running: Promise<void> | null = null;
let device: string | null = null;

/** Run one cycle now (or join the one already running). */
export function syncNow(): Promise<void> {
  if (!syncEnabled) return Promise.resolve();
  running ??= (async () => {
    useSyncStatus.setState({ state: 'syncing' });
    try {
      device ??= await deviceId(sql, randomUUID);
      await syncOnce(sql, transport, device);
      useSyncStatus.setState({ state: 'idle', lastSyncedAt: Date.now(), message: null });
    } catch (err) {
      const offline = err instanceof Offline;
      useSyncStatus.setState({ state: offline ? 'offline' : 'error', message: (err as Error).message });
    } finally {
      useSyncStatus.setState({ pending: await pendingCount(sql).catch(() => 0) });
      running = null;
    }
  })();
  return running;
}

/**
 * The first time this browser opens the app, try to bring down what's on the
 * server before first-run setup decides there's nothing here. Gives up after
 * `timeoutMs` (setup then runs as normal and sync merges later).
 */
export async function firstSync(timeoutMs: number): Promise<void> {
  if (!syncEnabled || (await hasSynced(sql))) return;
  await Promise.race([syncNow(), new Promise((r) => setTimeout(r, timeoutMs))]);
}

let started = false;

/** Start the schedule. Call once, after the database is ready. */
export function startSync(): void {
  if (!syncEnabled || started) return;
  started = true;
  void syncNow();
  setInterval(() => void syncNow(), EVERY_MS);
  // A change a few seconds ago that hasn't gone up yet.
  setInterval(() => {
    if (running) return;
    void pendingCount(sql).then((n) => {
      useSyncStatus.setState({ pending: n });
      if (n > 0 && useSyncStatus.getState().state !== 'offline') void syncNow();
    });
  }, CHECK_CHANGES_MS);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') void syncNow();
  });
  window.addEventListener('online', () => void syncNow());
}
