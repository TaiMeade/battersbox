/**
 * Getting the browser's database open safely. Only used on the web.
 *
 * expo-sqlite keeps the database in the browser's private file storage
 * (OPFS), where only one page at a time may hold its files, and a failed
 * first open leaves its worker unusable until reload. So before touching
 * it: hold a lock for as long as this page lives (a second tab waits), then
 * make sure a page that was just closed or reloaded has let go of the files.
 */

const LOCK_NAME = 'battersbox-db';
const STORAGE_DIR = 'expo-sqlite'; // AccessHandlePoolVFS's folder

/** Resolves once this page holds the lock, which it keeps until it closes. */
export function holdPageLock(onWaiting: () => void): Promise<void> {
  const locks = (navigator as Navigator & { locks?: LockManager }).locks;
  if (!locks) return Promise.resolve();
  return new Promise((resolve) => {
    let acquired = false;
    const timer = setTimeout(() => {
      if (!acquired) onWaiting();
    }, 600);
    void locks.request(LOCK_NAME, () => {
      acquired = true;
      clearTimeout(timer);
      resolve();
      return new Promise<never>(() => {}); // never released by us
    });
  });
}

// Runs in a throwaway worker: sync access handles only exist in workers.
const PROBE = `
onmessage = async () => {
  try {
    const root = await navigator.storage.getDirectory();
    let dir;
    try { dir = await root.getDirectoryHandle(${JSON.stringify(STORAGE_DIR)}); }
    catch { postMessage(true); return; } // nothing stored yet
    for await (const handle of dir.values()) {
      if (handle.kind !== 'file') continue;
      const access = await handle.createSyncAccessHandle();
      access.close();
    }
    postMessage(true);
  } catch (e) {
    postMessage(false);
  }
};`;

/** Waits (up to ~10 s) until no other page holds the database files. */
export async function waitForStorageRelease(attempts = 60, delayMs = 150): Promise<void> {
  if (typeof Worker === 'undefined' || !navigator.storage?.getDirectory) return;
  const url = URL.createObjectURL(new Blob([PROBE], { type: 'text/javascript' }));
  const worker = new Worker(url);
  try {
    for (let i = 0; i < attempts; i++) {
      const free = await new Promise<boolean>((resolve) => {
        worker.onmessage = (e) => resolve(e.data === true);
        worker.onerror = () => resolve(true); // can't check: let the real open report any problem
        worker.postMessage(null);
      });
      if (free) return;
      await new Promise((r) => setTimeout(r, delayMs));
    }
  } finally {
    worker.terminate();
    URL.revokeObjectURL(url);
  }
}

/** Ask the browser not to clear our storage when space runs low. */
export function askToKeepStorage(): void {
  void navigator.storage?.persist?.().catch(() => {});
}
