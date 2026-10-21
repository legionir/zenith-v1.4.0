# @zenith/auth

One canonical `Auth` engine, with instance-first and legacy functional entry points.

> Code-first remediation candidate (#118/#139/#145). New unit/browser tests have
> been written, **not run**. This README is a contract description, not production
> readiness, audit, package-size or cross-browser acceptance evidence.

## Instance-first usage

```ts
import { createAuth } from '@zenith/auth';

const session = createAuth({
  loginUrl: '/api/auth/login',
  registerUrl: '/api/auth/register',
  logoutUrl: '/api/auth/logout',
  refreshUrl: '/api/auth/refresh',
  meUrl: '/api/auth/me',
  // memory is the default. No browser persistence is read on construction.
  tokenStorage: 'memory',
});

await session.login({ email: 'user@example.test', password: 'provided-by-user' });
const headers = session.authHeaders();
await session.logout(); // synchronous local invalidation; best-effort server POST
session.dispose();     // abort requests, stop timers/listeners, release memory
```

`AuthConfig` is the engine's configuration contract. `new Auth(config)` and
`createAuth(config)` create the same engine. `configure(partial)` updates that
instance, invalidates older requests and returns no replacement instance.
`getConfig()` returns detached headers/configuration snapshots.

### A separate engine per App/request

```ts
import { createApp } from '@zenith/runtime-core';
import { authPlugin, getAppAuth } from '@zenith/auth';

const app = createApp();
app.use(authPlugin({ loginUrl: '/api/auth/login', meUrl: '/api/auth/me' }));
const session = getAppAuth(app)!;
await session.login({ email: 'user@example.test', password: 'provided-by-user' });
app.dispose(); // disposes only this App's session
```

The plugin creates its engine at installation, not at module import. The same
plugin descriptor installed in two Apps creates two engines. A named installation
uses `authPlugin(config, { name: 'admin' })` and `getAppAuth(app, 'admin')`.

`createAuthRegistry(app.registries.auth)` adapts an explicit reference store;
`createAuthRegistry()` creates an isolated standalone store. Both implement
`register/get/has/list/unregister/dispose`. Registration cleanup is tied to a
registration token, even if the exact same value is registered twice. Removing a
reference does **not** dispose a borrowed client; its creator owns disposal.
A plugin installation refuses to overwrite another owner's registered name.

### Legacy runtime default ownership

Calling the Auth facade/helpers from `@zenith/runtime` installs a **lazy** L3 bridge:
legacy `registerAuth/getAuth/...` and functional helpers then use the actual
`defaultApp().registries.auth`. Merely importing the runtime or importing only
`signal` does not create an App, restore persistence or start auth. Using only
`@zenith/auth` retains an isolated standalone fallback until the runtime facade is
used; the lower Auth layer does not import runtime-core.

Pre-bootstrap registrations are adopted at first access. Their original cleanup
still follows the adopted registration; stale cleanup cannot remove a replacement,
even when the same value is reused. An existing explicit App registration wins a
bootstrap collision. Automatically created defaults are disposed with their App,
on replacement or removal; manually registered clients remain borrowed references.
Direct App inventory changes also update reactive functional views through name-only
registry notifications. Exceptions in an inventory observer cannot undo or make a
completed reference registration appear failed.

`resetForTesting` releases existing Auth leases without resolving/creating another
App. Disposing the default App detaches it before callbacks execute, so reentrant
legacy calls cannot receive the disposed owner. Subsequent calls use a fresh default
App, not a captured former instance. Explicit `authPlugin` installations in other
Apps remain isolated. Use explicit App engines for SSR/concurrent requests, never
the legacy default helpers. Other #118 singleton domains still need migration;
these Auth contracts and tests have **not** been validated in this phase.

## Legacy compatibility and migration

The functional exports no longer have their own user/token state, timer, HTTP
engine or persistence implementation. Writable views delegate `get/peek/set/update`
to the canonical default engine. Existing `User` roles/permissions are normalized
to arrays; custom fields are `unknown` and must be narrowed.

| Existing export / option | Canonical equivalent |
| --- | --- |
| `new Auth(config)` | `createAuth(config)`; same implementation |
| `configureAuth({ endpoints: { login, logout, register, refresh, me } })` | `getDefaultAuth().configure({ loginUrl, logoutUrl, registerUrl, refreshUrl, meUrl })` |
| `configureAuth({ storageKey, autoRefresh, loginRedirect, logoutRedirect, loginPath })` | Same fields on `AuthConfig` |
| `getAuthConfig()` | Legacy-shaped snapshot of `getDefaultAuth().getConfig()` |
| `initAuth()` | `getDefaultAuth().init()` |
| `login(credentials)` / `auth.login` | `getDefaultAuth().login(credentials, { remember })`, returning normalized user or `null` |
| `register(data)` / `auth.register` | `getDefaultAuth().register(data)`, returning user or `null` |
| `logout(notifyServer)` | `getDefaultAuth().logout(notifyServer)` |
| `refreshToken()` | `getDefaultAuth().refresh()`, returning tokens or `null`; missing token in token mode still throws |
| `fetchCurrentUser()` / `auth.fetchUser` | `getDefaultAuth().fetchUser()`, returning user or `null` |
| `auth.user/tokens/isLoading/error` | Writable views of the canonical `signal` |
| `auth.isAuthenticated/roles/permissions` | Read-only views of canonical state |
| `hasRole/hasAnyRole/hasAllRoles/hasPermission/hasAnyPermission` | Checks against canonical default user |
| `canActivateRoute(guard)` | UI-only policy check on the same default user; server authorization is still required |
| `registerAuth('default', instance)` | Select an existing canonical engine for the functional helpers |
| `destroy()` / `clearAuth()` | Deprecated aliases for `dispose()` / testing reset respectively |

Legacy exports remain available; this migration does not silently remove them.
`FunctionalAuthConfig` and its schema remain compatibility input adapters, not a
second engine configuration/state machine. New code should use `AuthConfig` and
explicit instances. Inherited signal-inspection internals are not the view's
subscription inventory; observe the canonical `session.signal` for devtools.

### Observable security/error changes

- All auth endpoints are HTTP(S), same-origin in a browser, and reject URL userinfo
  before sending credentials. Cross-origin APIs need a reviewed same-origin proxy;
  arbitrary `@zenith/http` interceptors no longer intercept functional Auth calls.
  Configure explicit `AuthConfig.headers` instead.
- Error bodies/foreign exception messages are not copied into auth state or logs.
  User/refresh helpers return `null` on operational failure. Transient refresh
  failures retain the session; automatic refresh retries after 30 seconds.
- Registration is now memory-only by default (the former functional registration
  always persisted). Remember-me requires explicit `login(..., { remember: true })`
  or functional `login({ ..., remember: true })`.
- Requests are aborted on logout/dispose/reconfiguration/new login. Session
  generation checks also reject late fetch/body responses when transport ignores
  abort. Concurrent refreshes share one lease; old work cannot release a newer one.

## Storage and restore

Both public styles use `@zenith/storage` versioned, validated records. The canonical
key is `storageKey`, or `${tokenKey}_session` when omitted. Legacy functional callers
retain the exact `zenith_auth_tokens` key. A successful restore migrates former raw
functional JSON and former class token/refresh/expiry keys; new class writes are a
single record, **not raw strings under `tokenKey`**. External raw-storage readers
must migrate to the public Auth API. Cookie records are encoded by the storage
package; client cookies remain readable by JavaScript, never HttpOnly.

Memory clients do not restore persistent data on construction. Explicit `init()`
with a nonempty `storageKey` (including legacy `initAuth`) opts into restoring a
previous remember-me record; keep this key empty if persistent restore is unwanted.
`localStorage/sessionStorage/cookie` clients restore on construction; `init()`
shares that in-flight work. Unverified restored tokens do not authenticate the
user until `/me` or refresh succeeds. A configured SSR request always uses memory,
including when browser globals are present with `document.__zenithSSR__` set.

`logout` clears local state/storage before any server response and emits logout
once per call. `secureLogout` also clears immediately and uses beacon or a
keepalive fetch fallback. Neither can guarantee server revocation while offline.
`dispose` clears memory and owned resources but does not delete persisted records
or notify the server. Storage failures cannot make the in-memory logout wait.

## Cross-tab synchronization

Opt in with `session.enableCrossTabSync()` or `authPlugin(config, { crossTab: true })`.
The returned cleanup is idempotent; disposal owns it automatically. Messages carry
only `{ version: 1, scope: storageKey, type: 'logout' | 'refresh' }`, never tokens,
users, passwords or OTPs. Configure separate storage keys/channels for separate
authentication domains. Receiving logout invalidates pending requests and timers
without echoing the message. A persistent/remembered peer reads the refreshed
record and revalidates `/me`. Memory-only peers do not import credentials on refresh;
there is no token sharing and no cross-tab refresh lock. Applications still need a
server refresh-rotation/reuse policy that handles simultaneous tabs.

BroadcastChannel carries invalidations; native storage events provide a fallback
for shared localStorage records. SessionStorage is not a shared cross-tab session.
There is no guarantee of cookie refresh notifications when BroadcastChannel is
unavailable. Without a `/me` endpoint, a remotely restored session remains
unauthenticated until explicitly validated by the server.

## HttpOnly cookies and MFA limitations

Use `refreshMode: 'cookie'` to refresh without a JSON refresh token:

```ts
const session = createAuth({
  loginUrl: '/api/auth/login', refreshUrl: '/api/auth/refresh',
  refreshMode: 'cookie', tokenStorage: 'memory',
  headers: { 'X-CSRF-Token': 'value-issued-by-your-server' },
});
await session.refresh(); // explicit boot refresh; same-origin cookie + empty JSON body
```

The server sets `HttpOnly; Secure; SameSite` cookies, verifies Origin/CSRF, and returns
an access token. Default `refreshMode: 'token'` retains legacy JSON-token behavior.
`verifyMfa(code, url?)` is only a same-origin endpoint adapter accepting a valid
server session response. It rejects tokenless success and stale results, but is
**not** a complete challenge, pending-session, OTP recovery or anti-replay protocol.
Those optional provider hooks still need a separate documented protocol/review.

See [the security guide](../../docs/security/auth.md). No independent audit or
production acceptance is implied by the unrun tests in this candidate.
