/**
 * The HTTP side: the web build (with the headers its database needs), and
 * the sync API. Read-only for anything but `POST /api/sync/push`.
 */
import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { extname, join, normalize, sep } from 'node:path';

import { BadRequest, type SyncStore } from './store.ts';

const MAX_BODY = 16 * 1024 * 1024;

const TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json',
  '.webmanifest': 'application/manifest+json',
  '.wasm': 'application/wasm',
  '.css': 'text/css',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.ico': 'image/x-icon',
  '.svg': 'image/svg+xml',
  '.ttf': 'font/ttf',
  '.otf': 'font/otf',
  '.woff2': 'font/woff2',
};

export interface AppOptions {
  store: SyncStore;
  /** The `expo export -p web` output, after scripts/web-postbuild.mjs. */
  webDir: string;
  /** Extra details for /api/status (e.g. the last backup). */
  status?: () => Record<string, unknown>;
  /** Where `POST /api/diag` batches from the web app go. Off when absent. */
  diag?: (batch: unknown) => void;
}

const MAX_DIAG_BODY = 256 * 1024;

function send(res: ServerResponse, status: number, body: unknown) {
  const text = JSON.stringify(body);
  res.writeHead(status, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
  res.end(text);
}

function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks: Buffer[] = [];
    req.on('data', (chunk: Buffer) => {
      size += chunk.length;
      if (size > MAX_BODY) {
        reject(new BadRequest('too large'));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
}

/** A write must come from the app's own page, not some other site the browser has open. */
function sameOrigin(req: IncomingMessage): boolean {
  const origin = req.headers.origin;
  if (!origin) return req.headers['sec-fetch-site'] === undefined || req.headers['sec-fetch-site'] === 'same-origin';
  try {
    return new URL(origin).host === req.headers.host;
  } catch {
    return false;
  }
}

async function serveFile(req: IncomingMessage, res: ServerResponse, webDir: string, path: string) {
  const root = normalize(webDir);
  let file = normalize(join(root, decodeURIComponent(path)));
  if (file !== root && !file.startsWith(root + sep)) {
    res.writeHead(404).end();
    return;
  }
  let info = await stat(file).catch(() => null);
  if (info?.isDirectory()) {
    file = join(file, 'index.html');
    info = await stat(file).catch(() => null);
  }
  if (!info) {
    // A route inside the app (/game/123): the app's page handles it. A missing file: 404.
    if (extname(path)) {
      res.writeHead(404).end();
      return;
    }
    file = join(root, 'index.html');
    info = await stat(file).catch(() => null);
    if (!info) {
      res.writeHead(503, { 'Content-Type': 'text/plain' }).end('The web app has not been built yet.');
      return;
    }
  }
  const name = file.slice(file.lastIndexOf(sep) + 1);
  // Hashed bundles never change; the page, the worker and the file list always might.
  const fresh = name === 'index.html' || name === 'sw.js' || name === 'precache.json' || name === 'manifest.webmanifest';
  res.writeHead(200, {
    'Content-Type': TYPES[extname(file).toLowerCase()] ?? 'application/octet-stream',
    'Content-Length': info.size,
    'Cache-Control': fresh ? 'no-cache' : 'public, max-age=31536000, immutable',
  });
  if (req.method === 'HEAD') res.end();
  else createReadStream(file).pipe(res);
}

export function createApp(options: AppOptions) {
  return async (req: IncomingMessage, res: ServerResponse) => {
    // The browser database needs SharedArrayBuffer, which needs a cross-origin-isolated page.
    res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
    res.setHeader('Cross-Origin-Embedder-Policy', 'require-corp');
    res.setHeader('Cross-Origin-Resource-Policy', 'same-origin');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'no-referrer');

    const url = new URL(req.url ?? '/', 'http://localhost');
    try {
      if (url.pathname === '/api/status' && req.method === 'GET') {
        return send(res, 200, { ok: true, ...options.store.status(), ...(options.status?.() ?? {}) });
      }
      if (url.pathname === '/api/sync/pull' && req.method === 'GET') {
        return send(res, 200, options.store.pull(Number(url.searchParams.get('cursor') ?? 0)));
      }
      if (url.pathname === '/api/sync/push' && req.method === 'POST') {
        if (!sameOrigin(req)) return send(res, 403, { error: 'Not from this app' });
        let body: unknown;
        try {
          body = JSON.parse(await readBody(req));
        } catch (err) {
          throw err instanceof BadRequest ? err : new BadRequest('body must be JSON');
        }
        return send(res, 200, options.store.push(body));
      }
      if (url.pathname === '/api/diag' && req.method === 'POST' && options.diag) {
        if (!sameOrigin(req)) return send(res, 403, { error: 'Not from this app' });
        const text = await readBody(req);
        if (text.length > MAX_DIAG_BODY) throw new BadRequest('too large');
        let batch: unknown;
        try {
          batch = JSON.parse(text);
        } catch {
          throw new BadRequest('body must be JSON');
        }
        if (!batch || typeof batch !== 'object' || Array.isArray(batch)) throw new BadRequest('body must be an object');
        options.diag(batch);
        return send(res, 200, { ok: true });
      }
      if (url.pathname.startsWith('/api/')) return send(res, 404, { error: 'No such endpoint' });
      if (req.method !== 'GET' && req.method !== 'HEAD') return send(res, 405, { error: 'Read only' });
      await serveFile(req, res, options.webDir, url.pathname);
    } catch (err) {
      if (err instanceof BadRequest) return send(res, 400, { error: err.message });
      console.error('[battersbox]', err);
      if (!res.headersSent) send(res, 500, { error: 'Something went wrong on the server' });
    }
  };
}
