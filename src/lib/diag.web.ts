/**
 * Diagnostics for the web app on a phone, where there are no developer tools
 * to look at. Records what's slow or broken (main-thread stalls, slow or
 * timed-out database calls, errors, sync cycles) next to what was tapped, and
 * sends it to the home server (`POST /api/diag`, written to DATA_DIR/diag.log)
 * every 15 s and when the app leaves the screen. Nothing personal: no stats,
 * names, or row contents are recorded.
 */

type Entry = { t: number; k: string } & Record<string, unknown>;

const MAX_BUFFER = 600;
const STALL_MS = 400;
const TICK_MS = 100;

const session = Math.random().toString(36).slice(2, 8);
const startedAt = Date.now();
let buffer: Entry[] = [];
let lastAction = 'start';
let started = false;

export function diag(k: string, data: Record<string, unknown> = {}): void {
  buffer.push({ t: Date.now() - startedAt, k, ...data });
  if (buffer.length > MAX_BUFFER) buffer = buffer.slice(-MAX_BUFFER);
}

/** What the user just did, so stalls and errors can be tied to it. */
export function diagAction(label: string): void {
  lastAction = label;
  diag('action', { label });
}

function flush(useBeacon = false): void {
  if (!buffer.length) return;
  const entries = buffer;
  buffer = [];
  const body = JSON.stringify({ session, startedAt, entries });
  if (useBeacon && typeof navigator.sendBeacon === 'function') {
    if (navigator.sendBeacon('/api/diag', new Blob([body], { type: 'application/json' }))) return;
  }
  fetch('/api/diag', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body,
    keepalive: body.length < 60_000,
  }).catch(() => {
    buffer = [...entries, ...buffer].slice(-MAX_BUFFER); // try again next time
  });
}

function environment(): Record<string, unknown> {
  let growableSab: boolean | string = false;
  try {
    const Sab = SharedArrayBuffer as unknown as new (n: number, o: object) => { growable?: boolean };
    growableSab = !!new Sab(8, { maxByteLength: 16 }).growable;
  } catch (e) {
    growableSab = `no: ${String(e)}`;
  }
  const script = document.querySelector<HTMLScriptElement>('script[src*="/entry-"]');
  return {
    ua: navigator.userAgent,
    standalone: (navigator as Navigator & { standalone?: boolean }).standalone ?? null,
    crossOriginIsolated: window.crossOriginIsolated,
    atomicsPause: typeof (Atomics as unknown as { pause?: unknown }).pause === 'function',
    growableSab,
    cores: navigator.hardwareConcurrency,
    viewport: `${window.innerWidth}x${window.innerHeight}@${window.devicePixelRatio}`,
    bundle: script?.src.split('/').pop() ?? null,
    swControlled: !!navigator.serviceWorker?.controller,
  };
}

export function startDiagnostics(): void {
  if (started || typeof window === 'undefined') return;
  started = true;
  diag('env', environment());

  // A stalled main thread: the timer fires late by however long it was blocked.
  let last = performance.now();
  setInterval(() => {
    const now = performance.now();
    const late = now - last - TICK_MS;
    if (late > STALL_MS && document.visibilityState === 'visible') {
      diag('stall', { ms: Math.round(late), after: lastAction });
    }
    last = now;
  }, TICK_MS);

  // Hooks the expo-sqlite patch calls (patches/expo-sqlite+*.patch).
  const g = globalThis as Record<string, unknown>;
  g.__battersboxSqliteSlow = (op: string, ms: number, timedOut: boolean) =>
    diag(timedOut ? 'sqlTimeout' : 'sqlSlow', { op, ms, after: lastAction });
  g.__battersboxWorkerSlow = (data: Record<string, unknown>) => diag('workerSlow', data);

  window.addEventListener('error', (e) => diag('error', { msg: String(e.message), after: lastAction }));
  window.addEventListener('unhandledrejection', (e) => {
    const reason = e.reason as { message?: string } | undefined;
    diag('rejection', { msg: String(reason?.message ?? reason), after: lastAction });
  });
  document.addEventListener('visibilitychange', () => {
    diag('visibility', { state: document.visibilityState });
    if (document.visibilityState === 'hidden') flush(true);
  });
  window.addEventListener('pagehide', () => flush(true));
  setInterval(() => flush(), 15_000);
}
