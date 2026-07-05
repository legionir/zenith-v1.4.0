// packages/cli/src/templates.ts
//
// قالب‌های اولیه برای CLI (فاز ۱۰).
//
// این فایل شامل قالب‌های HTML، JS، و config برای:
//   - ساخت پروژه‌ی جدید (create)
//   - ساخت کامپوننت (generate component)
//   - ساخت صفحه (generate page)
//   - ساخت action (generate action)

/**
 * قالب `index.html` برای پروژه‌ی جدید.
 */
export function indexHtmlTemplate(projectName: string): string {
  return `<!DOCTYPE html>
<html lang="fa" dir="rtl">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${projectName}</title>
  <style>
    * { box-sizing: border-box; }
    body {
      font-family: system-ui, -apple-system, sans-serif;
      max-width: 800px;
      margin: 40px auto;
      padding: 20px;
      line-height: 1.6;
      color: #1f2937;
      background: #f9fafb;
    }
    h1 { color: #3b82f6; }
    button {
      padding: 10px 18px;
      font-size: 14px;
      border: 1px solid #d1d5db;
      border-radius: 6px;
      cursor: pointer;
      background: #fff;
    }
    button:hover { background: #f3f4f6; }
    .counter {
      font-size: 3rem;
      font-weight: bold;
      color: #3b82f6;
      font-variant-numeric: tabular-nums;
      margin: 16px 0;
    }
  </style>
</head>
<body>
  <h1>🚀 ${projectName}</h1>
  <p>به فریم‌ورک Zenith خوش آمدید!</p>

  <div id="app">
    <h2>شمارنده</h2>
    <div class="counter"><span zen-text="$count"></span></div>
    <button zen-action="increment">+ ۱</button>
    <button zen-action="decrement">− ۱</button>
  </div>

  <script type="module" src="/main.ts"></script>
</body>
</html>
`;
}

/**
 * قالب `main.ts` برای پروژه‌ی جدید.
 */
export function mainTsTemplate(): string {
  return `import { signal } from '@zenith/state';
import { Zen } from '@zenith/runtime';

// 1. تعریف State
const state = {
  count: signal(0),
};

// 2. ثبت Action ها
Zen.action('increment', ({ state }) => {
  state.count.set(state.count.get() + 1);
});

Zen.action('decrement', ({ state }) => {
  state.count.set(Math.max(0, state.count.get() - 1));
});

// 3. شروع فریم‌ورک
Zen.start(document.getElementById('app')!, state);

// BUG-CLI-01 FIX: اعتبارسنجی runtime برای Action‌های تعریف‌نشده
// اگر دکمه‌ای در HTML دارای zen-action باشد اما handler آن ثبت نشده باشد،
// یک warning در کنسول چاپ می‌شود.
document.addEventListener('click', (e) => {
  const target = e.target as HTMLElement | null;
  const actionName = target?.getAttribute?.('zen-action');
  if (actionName && typeof actionName === 'string') {
    const actions = (window as any).__ZENITH_ACTIONS__;
    if (actions && !actions[actionName]) {
      console.warn(\`[Zenith] Action "\${actionName}" is not registered. ` +
        \`Define it with: Zen.action('\${actionName}', handler)\`);
    }
  }
}, true);

console.log('🚀 App started. Try Zen DevTools: window.__ZENITH__');
`;
}

/**
 * قالب `vite.config.ts` برای پروژه‌ی جدید.
 */
export function viteConfigTemplate(): string {
  return `import { defineConfig } from 'vite';
import { zenithPlugin } from '@zenith/vite-plugin';

export default defineConfig({
  plugins: [
    zenithPlugin(),
  ],
  server: {
    port: 3000,
  },
});
`;
}

/**
 * قالب `package.json` برای پروژه‌ی جدید.
 */
export function packageJsonTemplate(projectName: string): string {
  return `{
  "name": "${projectName}",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "preview": "vite preview"
  },
  "dependencies": {
    "@zenith/state": "workspace:*",
    "@zenith/runtime": "workspace:*",
    "@zenith/vite-plugin": "workspace:*"
  },
  "devDependencies": {
    "vite": "^5.4.0",
    "typescript": "^5.4.0"
  }
}
`;
}

/**
 * قالب `tsconfig.json` برای پروژه‌ی جدید.
 */
export function tsConfigTemplate(): string {
  return `{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "lib": ["ES2022", "DOM"],
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "noEmit": true
  },
  "include": ["src", "main.ts", "vite.config.ts"]
}
`;
}

/**
 * قالب `README.md` برای پروژه‌ی جدید.
 */
export function readmeTemplate(projectName: string): string {
  return `# ${projectName}

یک اپلیکیشن ساخته‌شده با [فریم‌ورک Zenith](https://github.com/zenith).

## شروع

\`\`\`bash
npm install
npm run dev
\`\`\`

سپس مرورگر را روی http://localhost:3000 باز کنید.

## ساختار

- \`index.html\` — صفحه‌ی اصلی با دایرکتیوهای Zenith
- \`main.ts\` — تعریف State و Action ها
- \`vite.config.ts\` — پیکربندی Vite با پلاگین Zenith

## ابزارهای توسعه

- **HMR:** تغییرات HTML به‌صورت زنده اعمال می‌شوند.
- **DevTools:** در console، \`window.__ZENITH__\` را امتحان کنید.

## یاد بیشتر

- [مستندات Zenith](https://github.com/zenith/docs)
- [CLI Commands](https://github.com/zenith/cli)
`;
}

/**
 * قالب کامپوننت.
 */
export function componentTemplate(name: string): string {
  // تبدیل نام به kebab-case (مثلا UserCard → user-card).
  const kebabName = name
    .replace(/([a-z0-9])([A-Z])/g, '$1-$2')
    .toLowerCase();

  return `<zen-component name="${kebabName}">
  <template>
    <div class="${kebabName}">
      <h2>${name}</h2>
      <slot></slot>
    </div>
  </template>
</zen-component>
`;
}

/**
 * قالب صفحه (برای SPA).
 */
export function pageTemplate(pageName: string): string {
  return `<div class="page page-${pageName.toLowerCase()}">
  <h1>${pageName}</h1>
  <p>این صفحه‌ی ${pageName} است.</p>
</div>
`;
}

/**
 * قالب Action.
 */
export function actionTemplate(actionName: string): string {
  return `// Action: ${actionName}
// این فایل را در main.ts (یا فایل اصلی اپلیکیشن) import کنید.
import { Zen } from '@zenith/runtime';

Zen.action('${actionName}', ({ state, element, event }) => {
  console.log('Action "${actionName}" called:', { state, element, event });
  // TODO: منطق اکشن را اینجا بنویسید.
});
`;
}

/**
 * قالب فایل `.gitignore`.
 */
export function gitignoreTemplate(): string {
  return `node_modules/
dist/
.env
.env.local
*.log
.DS_Store
.vite/
`;
}

// ────────────────────────────────────────────────
// PWA Templates (Production Readiness #32)
// ────────────────────────────────────────────────

/**
 * قالب manifest.json برای PWA.
 *
 * این فایل به مرورگر می‌گوید که اپلیکیشن قابل نصب است و
 * هنگام install روی home screen با این متادیتا نمایش داده می‌شود.
 */
export function pwaManifestTemplate(projectName: string): string {
  const shortName = projectName.length > 12 ? projectName.substring(0, 12) : projectName;
  return JSON.stringify({
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
      { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any maskable' },
      { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any maskable' },
    ],
    shortcuts: [
      { name: 'Home', url: '/', icons: [{ src: '/icons/shortcut-home.png', sizes: '96x96' }] },
    ],
    categories: ['productivity', 'utilities'],
  }, null, 2);
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
export function pwaServiceWorkerTemplate(): string {
  return `// Zenith Service Worker — PWA Support
// Production Readiness #32
//
// استراتژی‌های caching:
//   - App Shell (HTML/CSS/JS): stale-while-revalidate
//   - Images: cache-first با expiration
//   - API calls: network-first با offline fallback

const CACHE_VERSION = 'v1';
const STATIC_CACHE = 'zenith-static-' + CACHE_VERSION;
const IMAGE_CACHE = 'zenith-images-' + CACHE_VERSION;
const API_CACHE = 'zenith-api-' + CACHE_VERSION;

const APP_SHELL = [
  '/',
  '/index.html',
  '/manifest.json',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
];

// ── Install: پیش‌cache کردن App Shell ──
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE).then((cache) => cache.addAll(APP_SHELL))
      .then(() => self.skipWaiting())
  );
});

// ── Activate: پاکسازی cacheهای قدیمی ──
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys
          .filter((key) => ![STATIC_CACHE, IMAGE_CACHE, API_CACHE].includes(key))
          .map((key) => caches.delete(key))
      );
    }).then(() => self.clients.claim())
  );
});

// ── Fetch: استراتژی‌های مختلف بر اساس نوع درخواست ──
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // فقط GET requests را cache کن
  if (request.method !== 'GET') return;

  // Same-origin فقط
  if (url.origin !== location.origin) return;

  // ── API calls: network-first ──
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(networkFirst(request, API_CACHE));
    return;
  }

  // ── Images: cache-first ──
  if (request.destination === 'image' || /\\.(png|jpg|jpeg|gif|svg|webp)$/i.test(url.pathname)) {
    event.respondWith(cacheFirst(request, IMAGE_CACHE, 50));
    return;
  }

  // ── App Shell (HTML, CSS, JS): stale-while-revalidate ──
  event.respondWith(staleWhileRevalidate(request, STATIC_CACHE));
});

// ── Helpers ──

async function cacheFirst(request, cacheName, maxEntries) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);
  if (cached) return cached;

  try {
    const response = await fetch(request);
    if (response.ok) {
      await cache.put(request, response.clone());
      await limitCacheSize(cacheName, maxEntries);
    }
    return response;
  } catch (e) {
    // offline fallback
    if (request.destination === 'document') {
      return cache.match('/index.html');
    }
    throw e;
  }
}

async function networkFirst(request, cacheName) {
  const cache = await caches.open(cacheName);
  try {
    const response = await fetch(request);
    if (response.ok) {
      cache.put(request, response.clone());
    }
    return response;
  } catch (e) {
    const cached = await cache.match(request);
    if (cached) return cached;
    throw e;
  }
}

async function staleWhileRevalidate(request, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);

  const fetchPromise = fetch(request).then((response) => {
    if (response.ok) {
      cache.put(request, response.clone());
    }
    return response;
  }).catch(() => cached);

  return cached || fetchPromise;
}

async function limitCacheSize(cacheName, maxEntries) {
  const cache = await caches.open(cacheName);
  const keys = await cache.keys();
  if (keys.length > maxEntries) {
    await cache.delete(keys[0]);
    await limitCacheSize(cacheName, maxEntries);
  }
}

// ── Background Sync (پشتیبانی از ارسال دیتا در زمان reconnect) ──
self.addEventListener('sync', (event) => {
  if (event.tag === 'zenith-sync') {
    event.waitUntil(
      // در اینجا می‌توانید درخواست‌های ذخیره‌شده در IndexedDB را
      // مجدداً ارسال کنید. برای مثال:
      self.clients.matchAll().then((clients) => {
        clients.forEach((client) => {
          client.postMessage({ type: 'zenith-sync' });
        });
      })
    );
  }
});

// ── Push Notifications ──
self.addEventListener('push', (event) => {
  const data = event.data ? event.data.json() : {};
  const title = data.title || 'Zenith Notification';
  const options = {
    body: data.body || '',
    icon: '/icons/icon-192.png',
    badge: '/icons/badge-72.png',
    data: data.url || '/',
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(
    self.clients.matchAll({ type: 'window' }).then((clients) => {
      // اگر tab باز است، focus کن؛ در غیر این صورت باز کن
      for (const client of clients) {
        if (client.url === event.notification.data && 'focus' in client) {
          return client.focus();
        }
      }
      if (self.clients.openWindow) {
        return self.clients.openWindow(event.notification.data);
      }
    })
  );
});
`;
}

/**
 * قالب Vite config با PWA plugin.
 *
 * در حالت PWA، vite-plugin-pwa اضافه می‌شود تا به‌طور خودکار
 * service worker را build و manifest را inject کند.
 */
export function pwaViteConfigTemplate(): string {
  return `import { defineConfig } from 'vite';
import { zenithPlugin } from '@zenith/vite-plugin';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    zenithPlugin({
      compile: { enabled: true, strict: false },
    }),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icons/icon-192.png', 'icons/icon-512.png'],
      manifest: {
        name: process.env.npm_package_name,
        short_name: 'Zenith App',
        theme_color: '#3b82f6',
        background_color: '#ffffff',
        display: 'standalone',
        dir: 'rtl',
        lang: 'fa',
        icons: [
          { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any maskable' },
          { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any maskable' },
        ],
      },
      workbox: {
        // استراتژی‌های caching در خود service worker ما تعریف شده.
        // اینجا فقط globPatterns را تنظیم می‌کنیم تا assets پیش‌cache شوند.
        globPatterns: ['**/*.{js,css,html,svg,png,woff2}'],
        navigateFallback: '/index.html',
      },
    }),
  ],
  server: {
    port: 3000,
    open: true,
  },
  build: {
    outDir: 'dist',
    target: 'es2022',
  },
});
`;
}

/**
 * قالب main.ts با PWA registration.
 */
export function pwaMainTsTemplate(): string {
  return `// main.ts — Zenith PWA Application Entry Point
import { Zen } from '@zenith/runtime';

// ── PWA: Register Service Worker ──
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js', { scope: '/' })
      .then((reg) => {
        console.log('[Zenith PWA] Service Worker registered:', reg.scope);

        // گوش دادن به updates
        reg.addEventListener('updatefound', () => {
          const newWorker = reg.installing;
          if (!newWorker) return;
          newWorker.addEventListener('statechange', () => {
            if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
              // یک SW جدید در حال نصب است.
              console.log('[Zenith PWA] New version available. Reload to update.');
              // می‌توانید یک notification به کاربر نشان دهید.
            }
          });
        });
      })
      .catch((err) => {
        console.error('[Zenith PWA] SW registration failed:', err);
      });
  });
}

// ── PWA: Install Prompt ──
let deferredPrompt: any = null;
window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  deferredPrompt = e;
  console.log('[Zenith PWA] Install prompt available.');
  // می‌توانید دکمه‌ی "Install App" را نشان دهید.
});

window.addEventListener('appinstalled', () => {
  console.log('[Zenith PWA] App installed.');
  deferredPrompt = null;
});

// ── PWA: Online/Offline Detection ──
function updateOnlineStatus() {
  const isOnline = navigator.onLine;
  document.body.classList.toggle('offline', !isOnline);
  console.log(\`[Zenith PWA] \${isOnline ? 'Online' : 'Offline'}\`);
}
window.addEventListener('online', updateOnlineStatus);
window.addEventListener('offline', updateOnlineStatus);
updateOnlineStatus();

// ── Zenith App Setup ──
Zen.start({
  root: document.body,
  context: {
    // اینجا متغیرهای global خود را تعریف کنید.
    $appVersion: '0.1.0',
    $isPWA: window.matchMedia('(display-mode: standalone)').matches,
  },
});

// BUG-CLI-01 FIX: اعتبارسنجی runtime برای Action‌های تعریف‌نشده
document.addEventListener('click', (e) => {
  const target = e.target as HTMLElement | null;
  const actionName = target?.getAttribute?.('zen-action');
  if (actionName && typeof actionName === 'string') {
    const actions = (window as any).__ZENITH_ACTIONS__;
    if (actions && !actions[actionName]) {
      console.warn(`[Zenith] Action "${actionName}" is not registered. ` +
        `Define it with: Zen.action('${actionName}', handler)`);
    }
  }
}, true);

console.log('[Zenith] App started. PWA mode:', window.matchMedia('(display-mode: standalone)').matches);
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

Replace the placeholder icons in \`public/icons/\`:
- \`icon-192.png\` — 192×192 PNG
- \`icon-512.png\` — 512×512 PNG
- \`shortcut-home.png\` — 96×96 PNG
- \`badge-72.png\` — 72×72 PNG (for push notifications)

Use https://realfavicongenerator.net/ to generate all sizes from a single source image.
`;
}

