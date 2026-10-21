// #95 — scope-holder service worker for the degradation matrix fixture.
// Deliberately trivial: NO fetch handler, so even if the scope ever matched a
// real page it could serve nothing stale. Controls only
// /e2e/__degradation_scope__/ (a path with no pages) and unregisters itself
// after the fixture records the registration.
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()));
