/**
 * Remove the loading screen that scripts/web-postbuild.mjs puts in
 * index.html, with a short fade. Safe to call more than once.
 */
export function hideBootSplash(): void {
  const splash = document.getElementById('boot-splash');
  if (!splash || splash.dataset.leaving) return;
  splash.dataset.leaving = '1';
  splash.style.opacity = '0';
  splash.style.pointerEvents = 'none';
  setTimeout(() => splash.remove(), 220);
}
