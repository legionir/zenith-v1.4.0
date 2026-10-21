---
---

#113: dashboard mock API + RBAC wiring (code-first, unrun).

New `dashboard/src/mock-api.js` (same `@zenith/mock` engine as the other
fixtures): deterministic seed (admin/editor/viewer), `token-<username>`
session tokens, login/logout/session/refresh, `GET /api/users` (passwords
stripped), `DELETE /api/users/:id` (401/403/404 + cannot-delete-self) and
`GET /api/admin/stats` (401/403) — every privileged route re-checks token +
permission itself, so UI hiding is never the authorization. Pure policy
(`ROLE_PERMISSIONS`, `permissionsForRole`, `can`, `tokenFor`,
`userFromToken`, `publicUser`, `seedUsers`) exported for tests.

New `dashboard/src/main.js` (ecommerce-demo boot pattern, verified APIs
only): mock `listen()`, `defineStore('dashboard')` session/users/stats/error
state with fetch actions, `createPermissionManager` + `setUserAccess` synced
on login/logout/restore (fail-closed `zen-permission` hides denied buttons),
`Zen.action(login/authLogout/deleteUser)` + `Zen.start(main, { dashboard })`.
Actions delegate to module-level loaders (only `this.state`, the proven
pattern — no sibling-dispatch assumption).

`dashboard/index.html`: page importmap (ecommerce-demo map + mock +
permission), module boot script, login section (seed accounts listed),
stats section store-driven instead of header-less `zen-resource`,
`$auth.*` → `$dashboard.*`, users loop over `$dashboard.users`
(`zen-permission="users:delete"` kept — now backed by a real manager).

Deleted `dashboard/src/store.ts` (12 bytes of binary garbage, referenced
nowhere). New `dashboard/README.md`: one-command run, real-vs-mock table,
explicit frontend-is-not-authorization limitation, demo accounts matrix.

Tests: `scripts/test/dashboard-rbac.test.mjs` (pure matrix + full route
flows IN-PROCESS via `server.handle()` — login 401s, session/refresh guards,
password stripping, delete 401/403/404/self-delete then 200 + list shrink,
seed reset, stats 401/403/200s) + `e2e/dashboard-rbac.spec.ts` (browser
allow/deny: admin rows+buttons+stats, viewer zero delete buttons + API
403/403, wrong-password error + logged-out 401s, logout back to login form,
zero pageErrors everywhere).

NOT done here (validation phase, needs dist builds + e2e server): run the
vitest + Playwright suites on 3 engines, fix whatever the live binding
surfaces (directive/state timing), then extend to SPA route guards.
Validation must: both suites green, deliberate viewer-DELETE stays 403 in
the browser, no console errors on boot/flows.
