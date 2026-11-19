/**
 * The service worker (public/sw.js) keeps a copy of the app so it opens
 * instantly, with or without signal. Registered after load so it never slows
 * the first paint.
 *
 * The app opens from that copy, so a new build is picked up in the background
 * and used on the next launch. An iPhone often resumes the home-screen app
 * instead of reloading it, so also look for a new build whenever the app
 * comes back to the screen.
 */
export function registerOfflineSupport(): void {
  if (!('serviceWorker' in navigator) || !window.isSecureContext) return;
  const register = () => {
    navigator.serviceWorker
      .register('/sw.js')
      .then((registration) => {
        document.addEventListener('visibilitychange', () => {
          if (document.visibilityState === 'visible') void registration.update().catch(() => {});
        });
      })
      .catch(() => {
        // No offline copy this time; the app still works online.
      });
  };
  if (document.readyState === 'complete') register();
  else window.addEventListener('load', register, { once: true });
}
