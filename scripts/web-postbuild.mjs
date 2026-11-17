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

const indexPath = join(dir, 'index.html');
let html = readFileSync(indexPath, 'utf8');
if (!html.includes('rel="manifest"')) {
  html = html
    .replace('</head>', `${HEAD}\n  </head>`)
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
