/**
 * The service worker (public/sw.js) keeps a copy of the app so it opens with
 * no signal. Registered after load so it never slows the first paint.
 */
export function registerOfflineSupport(): void {
  if (!('serviceWorker' in navigator) || !window.isSecureContext) return;
  const register = () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {
      // No offline copy this time; the app still works online.
    });
  };
  if (document.readyState === 'complete') register();
  else window.addEventListener('load', register, { once: true });
}
