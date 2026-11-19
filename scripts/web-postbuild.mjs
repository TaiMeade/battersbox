/**
 * After `expo export -p web`: make the build an installable, offline-capable
 * home-screen app.
 *  - index.html gets the manifest, iPhone icon and full-screen tags.
 *  - precache.json lists every file, for the service worker's offline copy.
 *  - sw.js gets this build's id, so a new build replaces the old copy.
 *
 *   node scripts/web-postbuild.mjs dist-web
 */
import { createHash } from 'node:crypto';
import { readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { join, relative, sep } from 'node:path';

const dir = process.argv[2] ?? 'dist-web';

const HEAD = `
    <link rel="manifest" href="/manifest.webmanifest" />
    <link rel="apple-touch-icon" sizes="180x180" href="/apple-touch-icon.png" />
    <meta name="apple-mobile-web-app-capable" content="yes" />
    <meta name="apple-mobile-web-app-title" content="BattersBox" />
    <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
    <meta name="theme-color" content="#1E4634" />`;

// iPhone home-screen fix. With the translucent status bar, iOS sizes a
// `height: 100%` page a little shorter than the screen and offsets it, so the
// page's default white background showed as bars above and below the app.
// Pin the app to the whole screen, and paint the page itself in the app's
// background (chalk / night, matching src/theme/tokens.ts) so nothing white
// can ever show, including during the rubber-band bounce.
const FULL_SCREEN_CSS = `
    <style id="battersbox-fullscreen">
      html, body { background-color: #F5F3EA; overscroll-behavior: none; }
      @media (prefers-color-scheme: dark) { html, body { background-color: #0C1510; } }
      #root { position: fixed; top: 0; right: 0; bottom: 0; left: 0; height: auto; }
    </style>`;

// Shown from the very first paint until the app is ready (the database,
// fonts and first sync take a moment on a phone), so start-up reads as
// "loading" rather than a screen that ignores taps. The app removes it
// (src/lib/bootSplash.web.ts). Same green as the phone build's splash.
const BOOT_SPLASH = `
    <div id="boot-splash" role="progressbar" aria-label="Loading BattersBox" style="position:fixed;top:0;right:0;bottom:0;left:0;z-index:10;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:18px;background:#1E4634;color:#F5F3EA;font:700 30px/1 system-ui,-apple-system,sans-serif;letter-spacing:3px;text-transform:uppercase;transition:opacity .18s ease-out">
      <img src="/icon-192.png" width="88" height="88" alt="" style="border-radius:20px" />
      <div>Batter&#8217;s Box</div>
    </div>`;

const indexPath = join(dir, 'index.html');
let html = readFileSync(indexPath, 'utf8');
if (!html.includes('rel="manifest"')) {
  html = html
    .replace('</head>', `${HEAD}${FULL_SCREEN_CSS}\n  </head>`)
    .replace('<div id="root"></div>', `${BOOT_SPLASH.trim()}\n    <div id="root"></div>`)
    // Edge to edge on iPhones with a notch; the app's safe-area handling does the rest.
    .replace('shrink-to-fit=no', 'shrink-to-fit=no, viewport-fit=cover');
  writeFileSync(indexPath, html);
}

const files = [];
const walk = (d) => {
  for (const name of readdirSync(d)) {
    const path = join(d, name);
    if (statSync(path).isDirectory()) walk(path);
    else files.push('/' + relative(dir, path).split(sep).join('/'));
  }
};
walk(dir);
const precache = files.filter((f) => f !== '/sw.js' && f !== '/precache.json' && !f.endsWith('.map')).sort();

const hash = createHash('sha256');
for (const f of precache) hash.update(f).update(readFileSync(join(dir, f)));
const build = hash.digest('hex').slice(0, 12);

writeFileSync(join(dir, 'precache.json'), JSON.stringify(precache));
const swPath = join(dir, 'sw.js');
writeFileSync(swPath, readFileSync(swPath, 'utf8').replace('__BUILD_ID__', build));
console.log(`web build ${build}: ${precache.length} files for offline`);
