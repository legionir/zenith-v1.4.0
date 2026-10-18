export function pwaManifestTemplate(projectName: string): string {
  const shortName = projectName.length > 12 ? projectName.substring(0, 12) : projectName;
  return JSON.stringify(
    {
      name: projectName,
      short_name: shortName,
      description: `A Zenith PWA application: ${projectName}`,
      start_url: '/',
      display: 'standalone',
      orientation: 'portrait',
      background_color: '#ffffff',
      theme_color: '#3b82f6',
      dir: 'rtl',
      lang: 'fa',
      icons: [
        {
          src: '/icons/icon-192.png',
          sizes: '192x192',
          type: 'image/png',
          purpose: 'any maskable',
        },
        {
          src: '/icons/icon-512.png',
          sizes: '512x512',
          type: 'image/png',
          purpose: 'any maskable',
        },
      ],
      shortcuts: [
        { name: 'Home', url: '/', icons: [{ src: '/icons/shortcut-home.png', sizes: '96x96' }] },
      ],
      categories: ['productivity', 'utilities'],
    },
    null,
    2,
  );
}

/**
 * قالب Service Worker برای PWA.
 *
 * استراتژی‌های caching:
 *   - App Shell (HTML/CSS/JS): stale-while-revalidate
 *   - Images: cache-first با expiration
 *   - API calls: network-first با offline fallback
 *
 * این فایل در root پروژه قرار می‌گیرد و در build به dist/ کپی می‌شود.
 */
export function pwaViteConfigTemplate(): string {
  return `import { defineConfig } from 'vite';
import { zenithPlugin } from '@zenith/vite-plugin';
import { VitePWA } from 'vite-plugin-pwa';
export default defineConfig({
  plugins: [zenithPlugin(), VitePWA({ strategies: 'injectManifest', srcDir: 'public', filename: 'sw.js', injectRegister: false, manifest: false, injectManifest: { injectionPoint: undefined } })],
  server: { host: '0.0.0.0', port: 3000 }, build: { target: 'es2022' },
});
`;
}

export function pwaMainTsTemplate(): string {
  return `// main.ts — Zenith PWA Application Entry Point
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
`;
}

/**
 * قالب README برای پروژه‌ی PWA.
 */
export function pwaReadmeTemplate(projectName: string): string {
  return `# ${projectName} (PWA)

A Progressive Web App built with the Zenith Framework.

## Features

- ✅ Installable (Add to Home Screen)
- ✅ Offline Support (Service Worker caching)
- ✅ Push Notifications ready
- ✅ Background Sync ready
- ✅ RTL Persian UI

## Getting Started

\`\`\`bash
npm install
npm run dev
\`\`\`

Open http://localhost:3000

## PWA Setup

The PWA is automatically configured with:
- \`manifest.json\` — App metadata (name, icons, theme)
- \`sw.js\` — Service Worker with caching strategies:
  - App Shell (HTML/CSS/JS): stale-while-revalidate
  - Images: cache-first with expiration
  - API calls: network-first with offline fallback
- \`vite-plugin-pwa\` — Build-time PWA asset generation

### Install on Desktop

Click the install icon (⊕) in the address bar.

### Install on Mobile

Open the app in the browser, tap the menu, and select "Add to Home Screen".

## Build

\`\`\`bash
npm run build
npm run preview
\`\`\`

## Testing Offline Mode

1. Open DevTools → Application → Service Workers
2. Check "Offline"
3. Reload the page — it should load from cache

## Icons

The generated \`public/icons/app.svg\` is a working starter icon. Replace it with
production artwork and optional 192px/512px PNG icons, updating public/manifest.json.
The manifest and one custom service worker have a single registration path.
`;
}

