# __PROJECT_NAME__ (PWA)

A Progressive Web App built with the Zenith Framework.

## Features

- ✅ Installable (Add to Home Screen)
- ✅ Offline Support (Service Worker caching)
- ✅ Push Notifications ready
- ✅ Background Sync ready
- ✅ RTL Persian UI

## Getting Started

```bash
npm install
npm run dev
```

Open http://localhost:3000

## PWA Setup

The PWA is automatically configured with:
- `manifest.json` — App metadata (name, icons, theme)
- `sw.js` — Service Worker with caching strategies:
  - App Shell (HTML/CSS/JS): stale-while-revalidate
  - Images: cache-first with expiration
  - API calls: network-first with offline fallback
- `vite-plugin-pwa` — Build-time PWA asset generation

### Install on Desktop

Click the install icon (⊕) in the address bar.

### Install on Mobile

Open the app in the browser, tap the menu, and select "Add to Home Screen".

## Build

```bash
npm run build
npm run preview
```

## Testing Offline Mode

1. Open DevTools → Application → Service Workers
2. Check "Offline"
3. Reload the page — it should load from cache

## Icons

The generated `public/icons/app.svg` is a working starter icon. Replace it with
production artwork and optional 192px/512px PNG icons, updating public/manifest.json.
The manifest and one custom service worker have a single registration path.
