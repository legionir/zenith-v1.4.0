// main.ts — Zenith PWA Application Entry Point
import { signal } from '@zenith/state';
import { Zen } from '@zenith/runtime';
import { logger } from '@zenith/logger';

// ── PWA: Register Service Worker ──
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js', { scope: '/' })
      .then((reg) => {
        logger.debug('[Zenith PWA] Service Worker registered.', { scope: reg.scope });

        // گوش دادن به updates
        reg.addEventListener('updatefound', () => {
          const newWorker = reg.installing;
          if (!newWorker) return;
          newWorker.addEventListener('statechange', () => {
            if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
              // یک SW جدید در حال نصب است.
              logger.debug('[Zenith PWA] New version available. Reload to update.');
            }
          });
        });
      })
      .catch((err) => {
        logger.error('[Zenith PWA] SW registration failed.');
      });
  });
}

// ── PWA: Install Prompt ──
let deferredPrompt: unknown = null;
window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  deferredPrompt = e;
  void deferredPrompt;
});

window.addEventListener('appinstalled', () => {
  deferredPrompt = null;
});

// ── PWA: Online/Offline Detection ──
function updateOnlineStatus() {
  const isOnline = navigator.onLine;
  document.body.classList.toggle('offline', !isOnline);
}
window.addEventListener('online', updateOnlineStatus);
window.addEventListener('offline', updateOnlineStatus);
updateOnlineStatus();

// ── Zenith App Setup (#33) ──
const state = {
  count: signal(0),
  appVersion: '1.4.0',
  isPWA: typeof window.matchMedia === 'function'
    ? window.matchMedia('(display-mode: standalone)').matches
    : false,
};

Zen.action('increment', ({ state: s }) => {
  s.count.set(s.count.get() + 1);
});

Zen.action('decrement', ({ state: s }) => {
  s.count.set(Math.max(0, s.count.get() - 1));
});

Zen.start(document.getElementById('app')!, state);
